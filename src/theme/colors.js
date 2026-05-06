export const colors = {
  background: '#000000',      // Pure Black
  surface: '#0A0A0A',         // Near Black
  surfaceLight: '#141414',    // Slightly lighter
  primary: '#FFFFFF',         // Pure White
  primaryDark: '#E0E0E0',     // Off-white
  primaryMuted: 'rgba(255, 255, 255, 0.06)',
  accent: '#FFFFFF',          // White accent
  accentMuted: 'rgba(255, 255, 255, 0.04)',
  text: '#FFFFFF',            // White
  textSecondary: '#999999',   // Gray
  textMuted: '#444444',       // Dark gray
  border: '#1A1A1A',          // Subtle border
  divider: '#111111',         // List separator
  error: '#FF3333',           // Red alert
  success: '#FFFFFF',         // White
  online: '#4ADE80',          // Green dot for online
  offline: '#333333',         // Dark gray
  unreadBadge: '#FFFFFF',     // White badge
  searchBar: '#0F0F0F',       // Search input bg
  messageMe: '#1A1A1A',       // Outgoing message
  messageThem: '#0A0A0A',     // Incoming message
  messageMeAlt: '#1F1F1F',    // Alt outgoing
  avatarColors: [
    '#FFFFFF', '#CCCCCC', '#999999', '#FFFFFF',
    '#E0E0E0', '#BBBBBB', '#FFFFFF', '#CCCCCC',
    '#999999', '#FFFFFF', '#E0E0E0', '#BBBBBB',
    '#FFFFFF', '#CCCCCC', '#999999', '#E0E0E0',
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
