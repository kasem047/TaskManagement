export const fonts = {
  regular: 'IBMPlexSansArabic_400Regular',
  semibold: 'IBMPlexSansArabic_600SemiBold',
  bold: 'IBMPlexSansArabic_700Bold'
};

export const gradient = {
  start: '#7B5CFF',
  end: '#4F8CFF',
  colors: ['#7B5CFF', '#5B6CFF', '#4F8CFF'] as const
};

const dark = {
  bg: '#0D0D17',
  surface: '#16161F',
  surface2: '#1C1C28',
  surface3: '#22222F',
  border: 'rgba(255,255,255,0.08)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#FFFFFF',
  textSecondary: '#A8A8C2',
  textMuted: '#7A7A96',
  primary: '#8B73FF',
  primaryHover: '#9D88FF',
  primarySoft: 'rgba(123, 92, 255, 0.18)',
  violet: '#A78BFA',
  violetSoft: 'rgba(167, 139, 250, 0.16)',
  rose: '#FF6B8A',
  roseSoft: 'rgba(255, 107, 138, 0.14)',
  success: '#4ADE80',
  successSoft: 'rgba(74, 222, 128, 0.14)',
  warning: '#FBBF24',
  warningSoft: 'rgba(251, 191, 36, 0.14)',
  danger: '#F87171',
  dangerSoft: 'rgba(248, 113, 113, 0.14)',
  sidebar: '#12121C',
  sidebarText: '#8B8BA3',
  overlay: 'rgba(255,255,255,0.04)',
  shadow: 'rgba(0,0,0,0.45)'
};

export const darkColors = dark;

export const lightColors = {
  bg: '#F4F3FB',
  surface: '#FFFFFF',
  surface2: '#F7F6FC',
  surface3: '#EEEAF8',
  border: '#E4E0F0',
  borderStrong: '#D4CDE8',
  text: '#16151F',
  textSecondary: '#5E5A72',
  textMuted: '#8B87A0',
  primary: '#6D54F0',
  primaryHover: '#5C45E0',
  primarySoft: '#EDE8FF',
  violet: '#7C5CFF',
  violetSoft: '#EEE9FF',
  rose: '#E45D78',
  roseSoft: '#FDE8ED',
  success: '#16A34A',
  successSoft: '#E8F8EE',
  warning: '#D97706',
  warningSoft: '#FEF3E2',
  danger: '#DC2626',
  dangerSoft: '#FDECEC',
  sidebar: '#16161F',
  sidebarText: '#A8A8C2',
  overlay: 'rgba(22, 21, 31, 0.04)',
  shadow: 'rgba(40, 20, 90, 0.10)'
};

export type ThemeColors = typeof darkColors;
export type ThemeName = 'light' | 'dark';

export const radii = {
  sm: 14,
  md: 18,
  lg: 24,
  xl: 32,
  pill: 999
};

export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40
};

export function cardShadow(theme: ThemeName) {
  return {
    shadowColor: theme === 'dark' ? '#000' : '#4B2DB8',
    shadowOpacity: theme === 'dark' ? 0.4 : 0.08,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6
  };
}
