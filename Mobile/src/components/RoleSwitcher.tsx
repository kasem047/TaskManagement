import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  roleModeLabel,
  useAccess,
  type AppRoleMode
} from '../access/AccessProvider';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export function RoleSwitcher() {
  const access = useAccess();
  const { colors } = useTheme();

  if (!access.showRoleSwitcher) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>عرض النظام كـ</Text>
      <View style={styles.row}>
        {access.availableRoleModes.map((mode: AppRoleMode) => {
          const active = access.activeRoleMode === mode;

          return (
            <Pressable
              key={mode}
              onPress={() => access.setRoleMode(mode)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                  borderColor: active ? colors.primary : colors.border
                }
              ]}
            >
              <Text
                numberOfLines={1}
                style={[styles.chipText, { color: active ? colors.primary : colors.textSecondary }]}
              >
                {roleModeLabel(mode)}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  hint: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  row: {
    flexDirection: 'row-reverse',
    gap: 6
  },
  chip: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 8,
    paddingVertical: 8,
    alignItems: 'center'
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlign: 'center'
  }
});
