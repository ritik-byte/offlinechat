import TcpSocket from 'react-native-tcp-socket';
import { NetworkInfo } from 'react-native-network-info';

const PORT = 12345;
const DELIMITER = '\n<<END>>\n';
const SCAN_TIMEOUT = 3000; // 3s for router reliability
const HEARTBEAT_INTERVAL = 5000;

/**
 * Enhanced SocketService with multi-user protocol support.
 *
 * Protocol envelope:
 * { type: "register"|"message"|"userList"|"ping"|"pong"|"typing"|"disconnect", payload: {...} }
 *
 * The server (host) maintains a registry of connected users and routes
 * messages between specific clients or broadcasts to all.
 */
class SocketService {
  constructor() {
    this.server = null;
    this.client = null;
    this.clients = [];           // Server: array of { socket, deviceId, deviceName, ip }
    this.isHost = false;
    this.deviceName = '';
    this.deviceRank = '';
    this.deviceId = '';
    this.deviceAvatar = null;

    // Listeners
    this.messageListeners = [];
    this.statusListeners = [];
    this.userListListeners = [];
    this.typingListeners = [];
    this.callListeners = [];

    // Connected users (client-side view)
    this.connectedUsers = [];

    // Heartbeat
    this.heartbeatTimer = null;

    // Buffer for TCP message fragmentation
    this.buffers = new Map(); // socketId -> partial data string
    this.scanSockets = [];    // Track sockets during discovery
  }

  setAvatar(avatar) {
    this.deviceAvatar = avatar;
  }

  // ─── Listener Management ──────────────────────────────────

  addMessageListener(cb) { this.messageListeners.push(cb); }
  removeMessageListener(cb) { this.messageListeners = this.messageListeners.filter(l => l !== cb); }

  addStatusListener(cb) { this.statusListeners.push(cb); }
  removeStatusListener(cb) { this.statusListeners = this.statusListeners.filter(l => l !== cb); }

  addUserListListener(cb) { this.userListListeners.push(cb); }
  removeUserListListener(cb) { this.userListListeners = this.userListListeners.filter(l => l !== cb); }

  addTypingListener(cb) { this.typingListeners.push(cb); }
  removeTypingListener(cb) { this.typingListeners = this.typingListeners.filter(l => l !== cb); }

  addCallListener(cb) { this.callListeners.push(cb); }
  removeCallListener(cb) { this.callListeners = this.callListeners.filter(l => l !== cb); }

  notifyStatus(status) {
    this.statusListeners.forEach(l => l(status));
  }

  notifyMessage(msg) {
    this.messageListeners.forEach(l => l(msg));
  }

  notifyUserList(users) {
    this.connectedUsers = users;
    this.userListListeners.forEach(l => l(users));
  }

  notifyTyping(data) {
    this.typingListeners.forEach(l => l(data));
  }

  notifyCallSignal(signal) {
    this.callListeners.forEach(l => l(signal));
  }

  // ─── Network Helpers ──────────────────────────────────────

  async getIpAddress() {
    try {
      const ip = await NetworkInfo.getIPV4Address();
      console.log('Detected IP:', ip);
      return ip;
    } catch (e) {
      console.error('Failed to get IP:', e);
      return null;
    }
  }

  async getGatewayIp() {
    try {
      const gateway = await NetworkInfo.getGatewayIPAddress();
      console.log('Detected Gateway:', gateway);
      return gateway;
    } catch (e) {
      return null;
    }
  }

  async getSubnetBase(targetIp = null) {
    const ip = targetIp || await this.getIpAddress();
    if (!ip) return null;
    const parts = ip.split('.');
    if (parts.length < 3) return null;
    return `${parts[0]}.${parts[1]}.${parts[2]}`;
  }

  /**
   * Helper to check if an IP is likely a local/hotspot IP
   */
  isLocalIp(ip) {
    if (!ip) return false;
    // Local ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
    return (
      ip.startsWith('192.168.') ||
      ip.startsWith('10.') ||
      (ip.startsWith('172.') && parseInt(ip.split('.')[1]) >= 16 && parseInt(ip.split('.')[1]) <= 31)
    );
  }

  // ─── Message Framing ─────────────────────────────────────

  /**
   * Encode a message with delimiter for TCP framing
   */
  encode(obj) {
    return JSON.stringify(obj) + DELIMITER;
  }

  /**
   * Process incoming data buffer, handling fragmentation
   */
  processBuffer(socketId, data) {
    let buffer = (this.buffers.get(socketId) || '') + data;
    const messages = [];
    let delimIdx;

    while ((delimIdx = buffer.indexOf(DELIMITER)) !== -1) {
      const raw = buffer.substring(0, delimIdx);
      buffer = buffer.substring(delimIdx + DELIMITER.length);
      try {
        messages.push(JSON.parse(raw));
      } catch (e) {
        console.error('Failed to parse message:', raw, e);
      }
    }

    this.buffers.set(socketId, buffer);
    return messages;
  }

  // ─── SERVER (HOST) ────────────────────────────────────────

  async startServer(deviceName, deviceId, deviceRank = 'Active', retryCount = 0, avatar = null) {
    // Force disconnect any previous instances to free up the port
    this.disconnect();

    // Give the OS a moment to release the port
    await new Promise(resolve => setTimeout(resolve, retryCount > 0 ? 1000 : 300));

    this.isHost = true;
    this.deviceName = deviceName;
    this.deviceId = deviceId;
    this.deviceRank = deviceRank || 'Active';
    this.deviceAvatar = avatar || this.deviceAvatar || null;
    const ip = await this.getIpAddress();
    this.myIp = ip; // Store own IP

    return new Promise((resolve, reject) => {
      try {
        console.log(`SERVER: Starting server on port ${PORT} (Attempt ${retryCount + 1})...`);
        this.server = TcpSocket.createServer((socket) => {
          const socketId = `${socket.remoteAddress}:${socket.remotePort}`;
          console.log(`SERVER: New connection from ${socketId}`);
          this.buffers.set(socketId, '');

          socket.on('data', (rawData) => {
            const client = this.clients.find(c => c.socketId === socketId);
            if (client) {
              client.lastPong = Date.now();
            }
            const messages = this.processBuffer(socketId, rawData.toString());
            messages.forEach(envelope => {
              this.handleServerMessage(envelope, socket, socketId);
            });
          });

          socket.on('error', (error) => {
            console.log('Client socket error:', error);
            this.removeClient(socketId);
          });

          socket.on('close', () => {
            this.removeClient(socketId);
            this.buffers.delete(socketId);
          });
        }).listen({ port: PORT, host: '0.0.0.0' }, () => {
          console.log(`SERVER: Listening on 0.0.0.0:${PORT}`);
          this.notifyStatus(`Hosting on ${ip}:${PORT}`);
          this.startHeartbeat();
          // Immediately broadcast to show host in their own UI
          this.broadcastUserList();
          resolve(ip);
        });

        this.server.on('error', (error) => {
          const msg = error.message || JSON.stringify(error);
          console.error('SERVER error:', msg);

          if (msg.includes('EADDRINUSE') && retryCount < 3) {
            console.log(`SERVER: Port ${PORT} busy, retrying in 1s...`);
            this.server.close();
            this.startServer(deviceName, deviceId, deviceRank, retryCount + 1, avatar).then(resolve).catch(reject);
            return;
          }

          this.notifyStatus(`Server Error: ${msg}`);
          if (msg.includes('EADDRINUSE')) {
            console.error('SERVER: Port in use. Please wait or restart app.');
          }
          reject(error);
        });

        this.server.on('close', () => {
          console.log('SERVER: Server instance closed');
          this.notifyStatus('Server closed');
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Handle an incoming protocol message on the server
   */
  handleServerMessage(envelope, socket, socketId) {
    const { type, payload } = envelope;

    switch (type) {
      case 'register': {
        console.log(`SERVER: Received registration from ${payload.deviceName} (${payload.deviceId})`);
        // Register the new client
        const existing = this.clients.find(c => c.deviceId === payload.deviceId);
        if (existing) {
          // Re-register (reconnection)
          existing.socket = socket;
          existing.socketId = socketId;
          existing.deviceName = payload.deviceName;
          existing.avatar = payload.avatar || existing.avatar || null;
        } else {
          this.clients.push({
            socket,
            socketId,
            deviceId: payload.deviceId,
            deviceName: payload.deviceName,
            deviceRank: payload.deviceRank || 'Active',
            avatar: payload.avatar || null,
            ip: socket.remoteAddress,
            lastPong: Date.now(),
          });
        }
        this.notifyStatus(`${payload.deviceName} joined`);
        this.broadcastUserList();
        break;
      }

      case 'message': {
        const msg = payload;
        if (msg.targetId === 'general') {
          // Group message — broadcast to all except sender + notify host
          this.notifyMessage(msg);
          this.clients.forEach(c => {
            if (c.deviceId !== msg.senderId) {
              try { c.socket.write(this.encode(envelope)); } catch (e) { }
            }
          });
        } else if (msg.targetId === this.deviceId) {
          // Message directed to host
          this.notifyMessage(msg);
        } else {
          // Route to specific client
          const target = this.clients.find(c => c.deviceId === msg.targetId);
          if (target) {
            try { target.socket.write(this.encode(envelope)); } catch (e) { }
          }
          // Also echo back to sender for confirmation (if sender isn't host)
          if (msg.senderId !== this.deviceId) {
            // Sender already added to their local UI via notifyMessage
          }
        }
        break;
      }

      case 'typing': {
        const { senderId, targetId } = payload;
        if (targetId === 'general') {
          // Broadcast typing to all except sender
          this.notifyTyping(payload);
          this.clients.forEach(c => {
            if (c.deviceId !== senderId) {
              try { c.socket.write(this.encode(envelope)); } catch (e) { }
            }
          });
        } else if (targetId === this.deviceId) {
          this.notifyTyping(payload);
        } else {
          const target = this.clients.find(c => c.deviceId === targetId);
          if (target) {
            try { target.socket.write(this.encode(envelope)); } catch (e) { }
          }
        }
        break;
      }

      case 'call_signal': {
        const client = this.clients.find(c => c.socketId === socketId);
        if (client) client.lastPong = Date.now();
        const { targetId } = payload;
        if (targetId === this.deviceId) {
          // Addressed to host
          this.notifyCallSignal(payload);
        } else {
          // Route to matching client
          const target = this.clients.find(c => c.deviceId === targetId);
          if (target) {
            try { target.socket.write(this.encode(envelope)); } catch (e) { }
          } else if (!targetId || targetId === 'general') {
            // Target was not specified or was general: forward to other clients and host
            this.clients.forEach(c => {
              if (c.socketId !== socketId) {
                try { c.socket.write(this.encode(envelope)); } catch (e) { }
              }
            });
            this.notifyCallSignal(payload);
          }
        }
        break;
      }

      case 'pong': {
        // Client responded to heartbeat
        const client = this.clients.find(c => c.socketId === socketId);
        if (client) client.lastPong = Date.now();
        break;
      }

      case 'disconnect': {
        this.removeClient(socketId);
        break;
      }

      default:
        console.log('Unknown message type from client:', type);
    }
  }

  /**
   * Remove a client and broadcast updated user list
   */
  removeClient(socketId) {
    const client = this.clients.find(c => c.socketId === socketId);
    if (client) {
      this.notifyStatus(`${client.deviceName} left`);
    }
    this.clients = this.clients.filter(c => c.socketId !== socketId);
    this.broadcastUserList();
  }

  /**
   * Broadcast the full user list to all clients
   * Includes the host itself in the list
   */
  broadcastUserList() {
    const users = [
      // Host entry
      {
        deviceId: this.deviceId,
        deviceName: this.deviceName,
        deviceRank: this.deviceRank,
        avatar: this.deviceAvatar || null,
        isHost: true,
        online: true,
      },
      // Connected clients
      ...this.clients.map(c => ({
        deviceId: c.deviceId,
        deviceName: c.deviceName,
        deviceRank: c.deviceRank,
        avatar: c.avatar || null,
        isHost: false,
        online: true,
      })),
    ];

    const envelope = this.encode({
      type: 'userList',
      payload: users,
    });

    this.clients.forEach(c => {
      try { c.socket.write(envelope); } catch (e) { }
    });

    // Also notify host's own UI
    this.notifyUserList(users);
  }

  // ─── CLIENT (JOIN) ────────────────────────────────────────

  async connectToServer(hostIp = null, deviceName, deviceId, deviceRank = 'Active', avatar = null) {
    this.isHost = false;
    this.deviceName = deviceName;
    this.deviceRank = deviceRank;
    this.deviceId = deviceId;
    this.deviceAvatar = avatar || this.deviceAvatar || null;

    let ipToConnect = hostIp;
    if (!ipToConnect) {
      const gateway = await this.getGatewayIp();
      const ip = await this.getIpAddress();

      // Try gateway first
      if (gateway && gateway !== '0.0.0.0' && gateway !== ip) {
        ipToConnect = gateway;
      } else {
        // Fallback to common Android hotspot IP
        ipToConnect = '192.168.43.1';
      }
    }

    return new Promise((resolve, reject) => {
      let resolved = false;

      const timeoutTimer = setTimeout(() => {
        if (!resolved) {
          console.error(`CLIENT: Connection to ${ipToConnect} timed out (manual)`);
          this.notifyStatus('Connection Timed Out');
          try { this.client.destroy(); } catch (e) { }
          reject(new Error('Connection timed out'));
        }
      }, 10000); // Increased to 10s for slow routers

      try {
        const socketId = 'client_main';
        this.buffers.set(socketId, '');

        console.log(`CLIENT: Attempting connection to ${ipToConnect}:${PORT}...`);

        this.client = TcpSocket.createConnection(
          {
            port: PORT,
            host: ipToConnect,
          },
          () => {
            console.log(`CLIENT: createConnection callback triggered for ${ipToConnect}`);
          }
        );

        this.client.on('connect', () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutTimer);
          console.log(`CLIENT: 'connect' event successful with ${ipToConnect}`);
          this.notifyStatus(`Connected to ${ipToConnect}`);

          // Small delay before sending registration to ensure buffer is ready
          setTimeout(() => {
            if (this.client) {
              this.client.write(this.encode({
                type: 'register',
                payload: {
                  deviceName,
                  deviceId,
                  deviceRank,
                  avatar: this.deviceAvatar || null,
                },
              }));
            }
          }, 100);

          resolve(ipToConnect);
        });

        this.client.on('data', (rawData) => {
          const messages = this.processBuffer(socketId, rawData.toString());
          messages.forEach(envelope => {
            this.handleClientMessage(envelope);
          });
        });

        this.client.on('error', (error) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutTimer);
          const msg = error.message || JSON.stringify(error);
          console.error(`CLIENT: Socket error with ${ipToConnect}:`, msg);
          this.notifyStatus(`Connection Error: ${msg}`);
          reject(error);
        });

        this.client.on('timeout', () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeoutTimer);
          console.error(`CLIENT: Connection to ${ipToConnect} timed out (socket event)`);
          this.notifyStatus('Connection Timed Out');
          try { this.client.destroy(); } catch (e) { }
          reject(new Error('Connection timed out'));
        });

        this.client.on('close', () => {
          console.log(`CLIENT: Connection to ${ipToConnect} closed`);
          if (!resolved) {
            resolved = true;
            clearTimeout(timeoutTimer);
            reject(new Error('Connection closed prematurely'));
          }
          this.notifyStatus('Disconnected from server');
          this.notifyUserList([]);
        });
      } catch (err) {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeoutTimer);
          reject(err);
        }
      }
    });
  }

  /**
   * Handle incoming protocol message on the client
   */
  handleClientMessage(envelope) {
    const { type, payload } = envelope;

    switch (type) {
      case 'userList':
        this.notifyUserList(payload);
        break;

      case 'message':
        this.notifyMessage(payload);
        break;

      case 'typing':
        this.notifyTyping(payload);
        break;

      case 'call_signal':
        this.notifyCallSignal(payload);
        break;

      case 'ping':
        // Respond with pong
        if (this.client) {
          try {
            this.client.write(this.encode({ type: 'pong', payload: {} }));
          } catch (e) { }
        }
        break;

      default:
        console.log('Unknown message type from server:', type);
    }
  }

  // ─── Sending Messages ─────────────────────────────────────

  /**
   * Send a message to a specific user or 'general' for group chat
   */
  sendMessage(text, targetId, image = null, replyTo = null, audio = null, audioDuration = 0) {
    const messageObj = {
      id: `${this.deviceId}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text,
      image, // Base64 string
      audio, // Base64 audio string or URI
      audioDuration, // Audio duration in seconds
      replyTo, // { id, senderName, text }
      senderId: this.deviceId,
      senderName: this.deviceName,
      senderRank: this.deviceRank,
      senderAvatar: this.deviceAvatar || null,
      targetId,
      timestamp: new Date().toISOString(),
    };

    const envelope = { type: 'message', payload: messageObj };

    if (this.isHost) {
      // Host: route message directly
      if (targetId === 'general') {
        // Send to all clients
        this.clients.forEach(c => {
          try { c.socket.write(this.encode(envelope)); } catch (e) { }
        });
      } else {
        // Send to specific client
        const target = this.clients.find(c => c.deviceId === targetId);
        if (target) {
          try { target.socket.write(this.encode(envelope)); } catch (e) { }
        }
      }
      // Notify own UI
      this.notifyMessage(messageObj);
    } else if (this.client) {
      // Client: send to server for routing
      this.client.write(this.encode(envelope));
      // Notify own UI
      this.notifyMessage(messageObj);
    }

    return messageObj;
  }

  /**
   * Send real-time call signal (invite, accept, decline, end, audio_chunk)
   */
  sendCallSignal(signal) {
    const envelope = {
      type: 'call_signal',
      payload: {
        ...signal,
        callerId: signal.callerId || this.deviceId,
        callerName: signal.callerName || this.deviceName,
        callerAvatar: signal.callerAvatar || this.deviceAvatar || null,
        senderId: this.deviceId,
        senderName: this.deviceName,
        senderAvatar: this.deviceAvatar || null,
        timestamp: Date.now(),
      },
    };

    if (this.isHost) {
      if (signal.targetId && signal.targetId !== 'general') {
        const target = this.clients.find(c => c.deviceId === signal.targetId);
        if (target) {
          try { target.socket.write(this.encode(envelope)); } catch (e) { }
        }
      } else {
        this.clients.forEach(c => {
          try { c.socket.write(this.encode(envelope)); } catch (e) { }
        });
      }
    } else if (this.client) {
      try { this.client.write(this.encode(envelope)); } catch (e) { }
    }
  }

  /**
   * Send typing indicator
   */
  sendTyping(targetId) {
    const envelope = {
      type: 'typing',
      payload: {
        senderId: this.deviceId,
        senderName: this.deviceName,
        targetId,
      },
    };

    if (this.isHost) {
      if (targetId === 'general') {
        this.clients.forEach(c => {
          try { c.socket.write(this.encode(envelope)); } catch (e) { }
        });
      } else {
        const target = this.clients.find(c => c.deviceId === targetId);
        if (target) {
          try { target.socket.write(this.encode(envelope)); } catch (e) { }
        }
      }
    } else if (this.client) {
      this.client.write(this.encode(envelope));
    }
  }

  // ─── Network Discovery ────────────────────────────────────

  /**
   * Scan the local subnet for active NexusChat hosts
   * Returns an array of { ip, port } for reachable hosts
   */
  async scanNetwork() {
    const found = [];
    const ip = await this.getIpAddress();
    const gateway = await this.getGatewayIp();

    // Cleanup any leftover scan sockets
    this.scanSockets.forEach(s => { try { s.destroy(); } catch (e) { } });
    this.scanSockets = [];

    const subnet = await this.getSubnetBase(ip);
    if (!subnet) {
      this.notifyStatus('Cannot determine subnet');
      return found;
    }

    console.log(`SCAN: My IP=${ip}, Gateway=${gateway}`);

    // 1. Check Gateway first — on hotspot, the gateway IS the host phone
    if (gateway && gateway !== '0.0.0.0' && gateway !== ip) {
      console.log(`SCAN: Checking Gateway ${gateway} first...`);
      this.notifyStatus(`Checking gateway ${gateway}...`);
      const res = await this.checkIp(gateway, 5000);
      if (res) {
        console.log(`SCAN: Found host at Gateway ${gateway}!`);
        found.push(res);
        this.notifyStatus('Found host via Gateway');
        // Cleanup
        this.scanSockets.forEach(s => { try { s.destroy(); } catch (e) { } });
        this.scanSockets = [];
        return found;
      }
    }

    // PHASE 1: Check priority IPs ONE AT A TIME (1-20) with long timeout
    // This is slow but 100% reliable on routers
    this.notifyStatus('Scanning priority IPs...');
    for (let i = 1; i <= 20; i++) {
      const addr = `${subnet}.${i}`;
      if (addr === ip || addr === gateway) continue;

      console.log(`SCAN: Checking ${addr}...`);
      const res = await this.checkIp(addr, 5000); // 5s timeout per IP
      if (res) {
        found.push(res);
        console.log(`SCAN: Found host at ${addr}!`);
        this.notifyStatus(`Found host: ${addr}`);
        return found;
      }
    }

    // PHASE 2: Check remaining IPs in small batches
    this.notifyStatus('Scanning remaining IPs...');
    for (let i = 21; i <= 254; i += 5) {
      const batch = [];
      for (let j = i; j < Math.min(i + 5, 255); j++) {
        const addr = `${subnet}.${j}`;
        if (addr !== ip) batch.push(addr);
      }
      const results = await Promise.all(batch.map(a => this.checkIp(a, 3000)));
      results.forEach(res => { if (res) found.push(res); });
      if (found.length > 0) break;
    }

    // Cleanup
    this.scanSockets.forEach(s => { try { s.destroy(); } catch (e) { } });
    this.scanSockets = [];

    this.notifyStatus(found.length > 0 ? `Found ${found.length} host(s)` : 'No hosts found');
    return found;
  }

  checkIp(ip, timeout = SCAN_TIMEOUT) {
    return new Promise((resolve) => {
      let settled = false;

      const done = (result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.scanSockets = this.scanSockets.filter(s => s !== sock);
        if (sock) { try { sock.destroy(); } catch (e) { } }
        resolve(result);
      };

      const timer = setTimeout(() => done(null), timeout);

      let sock;
      try {
        sock = TcpSocket.createConnection(
          { port: PORT, host: ip },
          () => {
            console.log(`SCAN: Found host at ${ip}`);
            done({ ip, port: PORT });
          }
        );
        this.scanSockets.push(sock);
        sock.on('error', () => done(null));
      } catch (e) {
        done(null);
      }
    });
  }

  // ─── Heartbeat ─────────────────────────────────────────────

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.isHost) return;
      const now = Date.now();
      // Send ping to all clients
      const pingEnvelope = this.encode({ type: 'ping', payload: {} });
      this.clients.forEach(c => {
        try { c.socket.write(pingEnvelope); } catch (e) { }
      });

      // Remove clients that haven't sent any data or responded to heartbeat in 60 seconds
      const stale = this.clients.filter(c => c.lastPong && (now - c.lastPong) > 60000);
      stale.forEach(c => {
        try { c.socket.destroy(); } catch (e) { }
        this.removeClient(c.socketId);
      });
    }, HEARTBEAT_INTERVAL);
  }

  stopHeartbeat() {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ─── Disconnect ────────────────────────────────────────────

  disconnect() {
    this.stopHeartbeat();

    if (this.client) {
      try {
        this.client.write(this.encode({ type: 'disconnect', payload: {} }));
      } catch (e) { }
      try { this.client.destroy(); } catch (e) { }
      this.client = null;
    }

    if (this.server) {
      this.clients.forEach(c => {
        try { c.socket.destroy(); } catch (e) { }
      });
      try { this.server.close(); } catch (e) { }
      this.server = null;
    }

    // NEW: Cleanup any pending scan sockets
    this.scanSockets.forEach(s => {
      try { s.destroy(); } catch (e) { }
    });
    this.scanSockets = [];

    this.clients = [];
    this.connectedUsers = [];
    this.buffers.clear();
    this.notifyStatus('Disconnected');
    this.notifyUserList([]);
  }

  /**
   * Get the current connected users list
   */
  getConnectedUsers() {
    return this.connectedUsers;
  }
}

export default new SocketService();
