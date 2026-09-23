import { Text, type StyleProp, type TextStyle } from 'react-native';

export type IconName =
  | 'home'
  | 'home-outline'
  | 'grid'
  | 'grid-outline'
  | 'checkbox'
  | 'checkbox-outline'
  | 'notifications'
  | 'notifications-outline'
  | 'ellipsis-horizontal'
  | 'ellipsis-horizontal-outline'
  | 'add'
  | 'arrow-back'
  | 'log-in-outline'
  | 'log-out-outline'
  | 'moon-outline'
  | 'sunny-outline'
  | 'refresh-outline'
  | 'briefcase-outline'
  | 'people-outline'
  | 'person-circle-outline'
  | 'time-outline'
  | 'shield-outline'
  | 'checkmark-circle'
  | 'alert-circle'
  | 'chevron-back'
  | 'file-tray-outline'
  | 'menu'
  | 'menu-outline';

const glyphs: Record<IconName, string> = {
  home: '⌂',
  'home-outline': '⌂',
  grid: '▦',
  'grid-outline': '▦',
  checkbox: '☑',
  'checkbox-outline': '☐',
  notifications: '●',
  'notifications-outline': '○',
  'ellipsis-horizontal': '⋯',
  'ellipsis-horizontal-outline': '⋯',
  add: '+',
  'arrow-back': '→',
  'log-in-outline': '→',
  'log-out-outline': '←',
  'moon-outline': '☾',
  'sunny-outline': '☼',
  'refresh-outline': '↻',
  'briefcase-outline': '▣',
  'people-outline': '♟',
  'person-circle-outline': '☺',
  'time-outline': '◷',
  'shield-outline': '◈',
  'checkmark-circle': '✓',
  'alert-circle': '!',
  'chevron-back': '‹',
  'file-tray-outline': '▢',
  menu: '☰',
  'menu-outline': '☰'
};

export function Icon({
  name,
  size = 20,
  color = '#fff',
  style
}: {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text style={[{ fontSize: size, color, lineHeight: size + 4, fontWeight: '700' }, style]}>
      {glyphs[name] ?? '•'}
    </Text>
  );
}
