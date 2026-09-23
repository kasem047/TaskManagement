import { createElement } from 'react';
import { Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii, space } from '../theme/tokens';

export function DateTimeField({
  label,
  value,
  onChange,
  disabled,
  dense
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  dense?: boolean;
}) {
  const { colors } = useTheme();
  const datePart = value.slice(0, 10);
  const timePart = value.slice(11, 16);

  const join = (nextDate: string, nextTime: string) => {
    if (!nextDate && !nextTime) {
      onChange('');
      return;
    }

    onChange(`${nextDate || datePart || toToday()}T${nextTime || timePart || '09:00'}`);
  };

  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      {Platform.OS === 'web' ? (
        createElement('input', {
          type: 'datetime-local',
          value,
          disabled,
          onChange: (event: { target: { value: string } }) => onChange(event.target.value),
          style: {
            minHeight: dense ? 42 : 56,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: colors.border,
            borderRadius: dense ? 12 : 18,
            paddingLeft: dense ? 12 : 16,
            paddingRight: dense ? 12 : 16,
            fontSize: dense ? 14 : 16,
            backgroundColor: colors.surface2,
            color: colors.text,
            fontFamily: fonts.regular,
            direction: 'rtl',
            width: '100%',
            boxSizing: 'border-box'
          }
        })
      ) : (
        <View style={styles.row}>
          <View style={styles.half}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>التاريخ</Text>
            <TextInput
              editable={!disabled}
              value={datePart}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textMuted}
              onChangeText={(next) => join(next, timePart)}
              style={[
                styles.input,
                dense ? styles.inputDense : null,
                {
                  backgroundColor: colors.surface2,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
            />
          </View>
          <View style={styles.half}>
            <Text style={[styles.hint, { color: colors.textMuted }]}>الوقت</Text>
            <TextInput
              editable={!disabled}
              value={timePart}
              placeholder="HH:mm"
              placeholderTextColor={colors.textMuted}
              onChangeText={(next) => join(datePart, next)}
              style={[
                styles.input,
                dense ? styles.inputDense : null,
                {
                  backgroundColor: colors.surface2,
                  borderColor: colors.border,
                  color: colors.text
                }
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function toToday() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const styles = StyleSheet.create({
  field: {
    gap: 8
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right'
  },
  hint: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  row: {
    flexDirection: 'row',
    gap: 10
  },
  half: {
    flex: 1,
    gap: 6
  },
  input: {
    minHeight: 56,
    borderWidth: 1,
    borderRadius: radii.md,
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
  }
});
