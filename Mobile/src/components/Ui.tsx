import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../theme/ThemeProvider';
import { cardShadow, fonts, gradient, radii, space } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

const maxWidth = 520;

export function Screen({
  children,
  title,
  subtitle,
  right,
  padded = true,
  dense = false
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  right?: ReactNode;
  padded?: boolean;
  dense?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <View pointerEvents="none" style={[styles.glow, { backgroundColor: colors.primarySoft }]} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          padded ? styles.padded : null,
          dense ? styles.contentDense : null,
          { maxWidth, width: '100%', alignSelf: 'center' }
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {title ? (
          <View style={[styles.header, dense ? styles.headerDense : null]}>
            <View style={styles.titleRow}>
              <Text
                style={[styles.title, dense ? styles.titleDense : null, { color: colors.text }]}
                numberOfLines={2}
              >
                {title}
              </Text>
              {right}
            </View>
            {subtitle ? (
              <Text
                style={[
                  styles.subtitle,
                  dense ? styles.subtitleDense : null,
                  { color: colors.textSecondary }
                ]}
              >
                {subtitle}
              </Text>
            ) : null}
          </View>
        ) : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Banner({
  text,
  kind = 'danger'
}: {
  text: string;
  kind?: 'danger' | 'success';
}) {
  const { colors } = useTheme();
  const background = kind === 'success' ? colors.successSoft : colors.dangerSoft;
  const color = kind === 'success' ? colors.success : colors.danger;
  const icon = kind === 'success' ? 'checkmark-circle' : 'alert-circle';

  if (!text) {
    return null;
  }

  return (
    <View style={[styles.banner, { backgroundColor: background }]}>
      <Icon name={icon} size={20} color={color} />
      <Text style={[styles.bannerText, { color }]}>{text}</Text>
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled,
  variant = 'primary',
  size = 'md',
  icon,
  style
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  icon?: IconName;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const compact = size === 'sm';
  const background =
    variant === 'secondary'
      ? colors.surface2
      : variant === 'danger'
        ? colors.danger
        : variant === 'ghost'
          ? 'transparent'
          : 'transparent';
  const color =
    variant === 'secondary' || variant === 'ghost' ? colors.text : '#fff';
  const borderColor =
    variant === 'ghost' || variant === 'secondary' ? colors.border : 'transparent';

  const content = (
    <>
      {icon ? <Icon name={icon} size={compact ? 13 : 18} color={color} /> : null}
      <Text
        numberOfLines={1}
        style={[styles.buttonText, compact ? styles.buttonTextSm : null, { color }]}
      >
        {label}
      </Text>
    </>
  );

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        {
          opacity: disabled ? 0.55 : pressed ? 0.88 : 1,
          minHeight: compact ? 38 : 56,
          justifyContent: 'center'
        },
        style
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={[...gradient.colors]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={[styles.button, compact ? styles.buttonSm : null, styles.buttonFill]}
        >
          {content}
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.button,
            compact ? styles.buttonSm : null,
            styles.buttonFill,
            { backgroundColor: background, borderColor }
          ]}
        >
          {content}
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  label
}: {
  icon: IconName;
  onPress: () => void;
  label?: string;
}) {
  const { colors, theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.iconButton,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.8 : 1
        },
        cardShadow(theme)
      ]}
    >
      <Icon name={icon} size={20} color={colors.text} />
    </Pressable>
  );
}

export function Field({
  label,
  dense,
  ...props
}: TextInputProps & { label: string; dense?: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={styles.field}>
      <Text style={[styles.label, dense ? styles.labelDense : null, { color: colors.textSecondary }]}>
        {label}
      </Text>
      <TextInput
        {...props}
        placeholderTextColor={colors.textMuted}
        style={[
          styles.input,
          dense ? styles.inputDense : null,
          {
            backgroundColor: colors.surface2,
            borderColor: colors.border,
            color: colors.text
          },
          props.style
        ]}
      />
    </View>
  );
}

export function Card({
  children,
  onPress,
  style
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { colors, theme } = useTheme();
  const body = (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border
        },
        cardShadow(theme),
        style
      ]}
    >
      {children}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1, transform: [{ scale: pressed ? 0.99 : 1 }] })}>
      {body}
    </Pressable>
  );
}

export function Badge({
  label,
  tone = 'primary'
}: {
  label: string;
  tone?: 'primary' | 'violet' | 'success';
}) {
  const { colors } = useTheme();
  const background =
    tone === 'violet' ? colors.violetSoft : tone === 'success' ? colors.successSoft : colors.primarySoft;
  const color = tone === 'violet' ? colors.violet : tone === 'success' ? colors.success : colors.primary;

  return (
    <View style={[styles.badge, { backgroundColor: background }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'primary'
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: IconName;
  tone?: 'primary' | 'violet' | 'success';
}) {
  const { colors } = useTheme();
  const iconBg =
    tone === 'violet' ? colors.violetSoft : tone === 'success' ? colors.successSoft : colors.primarySoft;
  const iconColor = tone === 'violet' ? colors.violet : tone === 'success' ? colors.success : colors.primary;

  return (
    <Card style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: iconBg }]}>
        <Icon name={icon} size={22} color={iconColor} />
      </View>
      <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Text style={[styles.statValue, { color: colors.text }]}>{value}</Text>
      {hint ? <Text style={[styles.statHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </Card>
  );
}

export function MenuRow({
  title,
  subtitle,
  icon,
  onPress,
  danger
}: {
  title: string;
  subtitle?: string;
  icon: IconName;
  onPress: () => void;
  danger?: boolean;
}) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.primary;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.88 : 1 }]}>
      <View style={[styles.menuRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.menuIcon, { backgroundColor: danger ? colors.dangerSoft : colors.primarySoft }]}>
          <Icon name={icon} size={20} color={tint} />
        </View>
        <View style={styles.menuCopy}>
          <Text style={[styles.menuTitle, { color: danger ? colors.danger : colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.menuSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
          ) : null}
        </View>
        <Icon name="chevron-back" size={18} color={colors.textMuted} />
      </View>
    </Pressable>
  );
}

export function ListRow({
  title,
  subtitle,
  selected,
  onPress,
  trailing
}: {
  title: string;
  subtitle?: string;
  selected?: boolean;
  onPress?: () => void;
  trailing?: ReactNode;
}) {
  const { colors } = useTheme();
  const mark = title.trim().charAt(0) || '•';

  const body = (
    <View
      style={[
        styles.listRow,
        {
          backgroundColor: selected ? colors.primarySoft : colors.surface,
          borderColor: selected ? colors.primary : colors.border
        }
      ]}
    >
      <View style={[styles.listMark, { backgroundColor: colors.primarySoft }]}>
        <Text style={[styles.listMarkText, { color: colors.primary }]}>{mark}</Text>
      </View>
      <View style={styles.listCopy}>
        <Text style={[styles.listTitle, { color: selected ? colors.primary : colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.listSubtitle, { color: colors.textMuted }]} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {trailing}
    </View>
  );

  if (!onPress) {
    return body;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {body}
    </Pressable>
  );
}

export function SectionTitle({ title }: { title: string }) {
  const { colors } = useTheme();

  return <Text style={[styles.sectionTitle, { color: colors.text }]}>{title}</Text>;
}

export function Empty({ text }: { text: string }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.primarySoft }]}>
        <Icon name="file-tray-outline" size={28} color={colors.primary} />
      </View>
      <Text style={[styles.emptyText, { color: colors.textSecondary }]}>{text}</Text>
    </View>
  );
}

export function Loader() {
  const { colors } = useTheme();

  return (
    <View style={styles.loader}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1
  },
  glow: {
    position: 'absolute',
    top: -80,
    right: -40,
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.55
  },
  content: {
    gap: 12,
    paddingBottom: 128,
    flexGrow: 1
  },
  contentDense: {
    gap: 10,
    paddingBottom: 112
  },
  padded: {
    paddingHorizontal: 22,
    paddingTop: 12
  },
  header: {
    gap: 6,
    marginBottom: space[1]
  },
  headerDense: {
    marginBottom: 0,
    gap: 4
  },
  titleRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10
  },
  kicker: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    letterSpacing: 0.4,
    textAlign: 'right'
  },
  title: {
    flex: 1,
    fontFamily: fonts.bold,
    fontSize: 32,
    lineHeight: 42,
    writingDirection: 'rtl',
    textAlign: 'right'
  },
  titleDense: {
    fontSize: 22,
    lineHeight: 30
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 15,
    lineHeight: 26,
    writingDirection: 'rtl',
    textAlign: 'right'
  },
  subtitleDense: {
    fontSize: 13,
    lineHeight: 20
  },
  banner: {
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8
  },
  bannerText: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  button: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 22,
    flexDirection: 'row',
    gap: 8,
    borderWidth: 1,
    borderColor: 'transparent',
    width: '100%'
  },
  buttonFill: {
    alignSelf: 'stretch'
  },
  buttonSm: {
    minHeight: 38,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 4
  },
  buttonText: {
    fontFamily: fonts.bold,
    fontSize: 17
  },
  buttonTextSm: {
    fontSize: 12
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center'
  },
  field: {
    gap: 8
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right',
    writingDirection: 'rtl'
  },
  labelDense: {
    fontSize: 12
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: space[4],
    fontSize: 16,
    fontFamily: fonts.regular,
    textAlign: 'right'
  },
  inputDense: {
    minHeight: 42,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    gap: 5
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 3
  },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: 11
  },
  statCard: {
    flex: 1,
    minWidth: 140,
    gap: 8
  },
  statIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end'
  },
  statLabel: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right'
  },
  statValue: {
    fontFamily: fonts.bold,
    fontSize: 28,
    textAlign: 'right'
  },
  statHint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  },
  menuRow: {
    minHeight: 58,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  menuIcon: {
    width: 34,
    height: 34,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center'
  },
  menuCopy: {
    flex: 1,
    gap: 1
  },
  menuTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    textAlign: 'right'
  },
  menuSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  },
  listRow: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  listMark: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  listMarkText: {
    fontFamily: fonts.bold,
    fontSize: 13
  },
  listCopy: {
    flex: 1,
    gap: 1
  },
  listTitle: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right'
  },
  listSubtitle: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'right'
  },
  sectionTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right',
    marginTop: 2
  },
  empty: {
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderRadius: 16,
    borderStyle: 'dashed'
  },
  emptyIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    writingDirection: 'rtl'
  },
  loader: {
    paddingVertical: space[10],
    alignItems: 'center'
  }
});
