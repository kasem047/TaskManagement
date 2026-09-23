import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export function ChoiceRow<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled,
  dense
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  disabled?: boolean;
  dense?: boolean;
}) {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => {
          const active = option.value === value;

          return (
            <Pressable
              key={option.value}
              disabled={disabled}
              onPress={() => onChange(option.value)}
              style={[
                styles.chip,
                dense ? styles.chipDense : null,
                {
                  backgroundColor: active ? colors.primarySoft : colors.surface2,
                  borderColor: active ? colors.primary : colors.border,
                  opacity: disabled ? 0.55 : 1
                }
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  dense ? styles.chipTextDense : null,
                  { color: active ? colors.primary : colors.text }
                ]}
              >
                {option.label}
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
    gap: 8
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right'
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8
  },
  chip: {
    borderWidth: 1,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipDense: {
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  chipText: {
    fontFamily: fonts.bold,
    fontSize: 13
  },
  chipTextDense: {
    fontSize: 12
  }
});
