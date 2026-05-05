import SocketService from '../src/services/SocketService';
import TcpSocket from 'react-native-tcp-socket';
import { NetworkInfo } from 'react-native-network-info';

// Mock dependencies
jest.mock('react-native-tcp-socket', () => {
  const mockSocket = {
    write: jest.fn(),
    on: jest.fn(),
    destroy: jest.fn(),
    close: jest.fn(),
  };
  
  const mockServer = {
    listen: jest.fn().mockImplementation((options, callback) => {
      if (callback) callback();
      return mockServer;
    }),
    on: jest.fn(),
    close: jest.fn(),
  };

  return {
    createServer: jest.fn((callback) => {
      if (callback) {
        // Expose a way to simulate client connection to server
        mockServer.simulateConnection = (socket) => callback(socket);
      }
      return mockServer;
    }),
    createConnection: jest.fn((options, callback) => {
      if (callback) callback();
      return mockSocket;
    }),
  };
});

jest.mock('react-native-network-info', () => ({
  NetworkInfo: {
    getIPV4Address: jest.fn().mockResolvedValue('192.168.1.100'),
    getGatewayIPAddress: jest.fn().mockResolvedValue('192.168.1.1'),
  }
}));

describe('SocketService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    SocketService.disconnect();
    SocketService.messageListeners = [];
    SocketService.statusListeners = [];
  });

  describe('Server (Host)', () => {
    it('should start a server and listen on correct port', async () => {
      const ip = await SocketService.startServer();
      
      expect(ip).toBe('192.168.1.100');
      expect(TcpSocket.createServer).toHaveBeenCalled();
      expect(SocketService.isHost).toBe(true);
    });

    it('should send messages to clients when acting as host', async () => {
      await SocketService.startServer();
      
      // Simulate client connecting
      const mockClientSocket = { write: jest.fn(), on: jest.fn(), destroy: jest.fn() };
      const serverInstance = TcpSocket.createServer.mock.results[0].value;
      serverInstance.simulateConnection(mockClientSocket);
      
      // Send message
      SocketService.sendMessage('Hello Clients', 'Host');
      
      expect(mockClientSocket.write).toHaveBeenCalled();
      const callArg = mockClientSocket.write.mock.calls[0][0];
      const parsed = JSON.parse(callArg);
      
      expect(parsed.text).toBe('Hello Clients');
      expect(parsed.senderId).toBe('Host');
    });
  });

  describe('Client (Join)', () => {
    it('should connect to server', async () => {
      const ip = await SocketService.connectToServer();
      
      expect(ip).toBe('192.168.1.1'); // Uses mocked gateway IP
      expect(TcpSocket.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ port: 12345, host: '192.168.1.1' }),
        expect.any(Function)
      );
      expect(SocketService.isHost).toBe(false);
    });

    it('should connect to specific IP if provided', async () => {
      const specificIp = '10.0.0.5';
      await SocketService.connectToServer(specificIp);
      
      expect(TcpSocket.createConnection).toHaveBeenCalledWith(
        expect.objectContaining({ host: specificIp }),
        expect.any(Function)
      );
    });

    it('should send messages to server when acting as client', async () => {
      await SocketService.connectToServer();
      
      const mockClientInstance = TcpSocket.createConnection.mock.results[0].value;
      
      SocketService.sendMessage('Hello Host', 'Client1');
      
      expect(mockClientInstance.write).toHaveBeenCalled();
      const callArg = mockClientInstance.write.mock.calls[0][0];
      const parsed = JSON.parse(callArg);
      
      expect(parsed.text).toBe('Hello Host');
      expect(parsed.senderId).toBe('Client1');
    });
  });

  describe('Event Listeners', () => {
    it('should notify message listeners when sendMessage is called', () => {
      const mockListener = jest.fn();
      SocketService.addMessageListener(mockListener);
      
      SocketService.sendMessage('Test Message', 'Me');
      
      expect(mockListener).toHaveBeenCalled();
      const msgArg = mockListener.mock.calls[0][0];
      expect(msgArg.text).toBe('Test Message');
      expect(msgArg.senderId).toBe('Me');
      expect(msgArg).toHaveProperty('id');
      expect(msgArg).toHaveProperty('timestamp');
    });
  });
});
