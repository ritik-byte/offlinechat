export const colors = {
  background: '#0D0E15',      // Deep Space Blue
  surface: '#1A1C29',         // Lighter Deep Space
  surfaceLight: '#232636',    // Even lighter surface
  primary: '#00F0FF',         // Neon Cyan
  primaryDark: '#00B8C4',     // Darker Cyan
  primaryMuted: 'rgba(0, 240, 255, 0.1)', // Subtle primary bg
  text: '#FFFFFF',            // White
  textSecondary: '#A0A4B8',   // Slate Gray
  textMuted: '#6B6F85',       // Muted text
  border: '#2A2D40',          // Subtle Border
  divider: '#1E2033',         // List separator
  error: '#FF3366',           // Neon Pink/Red
  success: '#00FF9D',         // Neon Green
  online: '#00FF9D',          // Green dot for online
  offline: '#6B6F85',         // Gray for offline
  unreadBadge: '#FF3366',     // Notification badge
  searchBar: '#1E2033',       // Search input bg
  messageMe: '#004A52',       // Outgoing message (tinted cyan)
  messageThem: '#1A1C29',     // Incoming message (surface)
  messageMeAlt: '#005F6A',    // Alt outgoing
  avatarColors: [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
    '#BB8FCE', '#85C1E9', '#F1948A', '#82E0AA',
    '#F8C471', '#AED6F1', '#D2B4DE', '#A3E4D7',
  ],
};

// Generate a consistent avatar color from a name string
export function getAvatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % colors.avatarColors.length;
  return colors.avatarColors[index];
}

// Get initials from a name (max 2 chars)
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}
