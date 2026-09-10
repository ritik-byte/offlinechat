// Dark Palette (WhatsApp Dark / Telegram Dark Caliber)
export const darkColors = {
  background: '#0B141A',        // WhatsApp Dark background
  surface: '#111B21',           // WhatsApp Dark top header & bar
  surfaceElevated: '#1F2C34',   // WhatsApp Dark modal & sheet elevated
  surfaceInput: '#202C33',      // WhatsApp Dark message input & search
  surfaceActive: '#2A3942',     // WhatsApp Dark active button state

  primary: '#00A884',           // WhatsApp Green accent
  primaryDark: '#008069',       // WhatsApp Dark Teal/Green
  primaryLight: '#25D366',      // WhatsApp Vibrant Green
  primaryMuted: 'rgba(0, 168, 132, 0.15)',

  online: '#00A884',
  offline: '#8696A0',
  error: '#EA0038',
  errorMuted: 'rgba(234, 0, 56, 0.15)',
  warning: '#F7A531',

  textPrimary: '#E9EDEF',       // High contrast clean text
  textSecondary: '#8696A0',     // Secondary slate text
  textMuted: '#667781',         // Subtle text / timestamps
  textLink: '#53BDEB',          // WhatsApp link blue

  border: '#222E35',            // Subtle border
  borderSubtle: 'rgba(233, 237, 239, 0.06)',
  divider: '#202C33',

  messageMe: '#005C4B',         // WhatsApp sent bubble (deep emerald teal)
  messageMeText: '#E9EDEF',
  messageThem: '#202C33',       // WhatsApp received bubble (slate dark)
  messageThemText: '#E9EDEF',
  unreadBadge: '#00A884',
};

// Light Palette (Apple / Telegram Light caliber)
export const lightColors = {
  background: '#F6F8FA',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  surfaceInput: '#EAEEF2',
  surfaceActive: '#E1E4E8',

  primary: '#0969DA',
  primaryDark: '#0550AE',
  primaryLight: '#218BFF',
  primaryMuted: 'rgba(9, 105, 218, 0.1)',

  online: '#1A7F37',
  offline: '#6E7781',
  error: '#CF222E',
  errorMuted: 'rgba(207, 34, 46, 0.1)',
  warning: '#9A6700',

  textPrimary: '#1F2328',
  textSecondary: '#57606A',
  textMuted: '#6E7781',
  textLink: '#0969DA',

  border: '#D0D7DE',
  borderSubtle: 'rgba(31, 35, 40, 0.08)',
  divider: '#D8DEE4',

  messageMe: '#0969DA',
  messageMeText: '#FFFFFF',
  messageThem: '#EAEFF5',
  messageThemText: '#1F2328',
  unreadBadge: '#0969DA',
};

// Default export (Dark) for backward compatibility
export const colors = darkColors;

// Curated avatar palettes
export const avatarPalette = [
  '#1F6FEB', // Sapphire
  '#238636', // Emerald
  '#8957E5', // Violet
  '#DA3633', // Crimson
  '#BF4B8A', // Magenta
  '#316DCA', // Steel Blue
  '#B08800', // Ochre
  '#1B7C83', // Deep Teal
];

// Generates consistent avatar color from a string
export function getAvatarColor(name) {
  if (!name) return avatarPalette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % avatarPalette.length;
  return avatarPalette[index];
}

// Generates 1-2 letter initials
export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.trim().substring(0, Math.min(2, name.trim().length)).toUpperCase();
}
