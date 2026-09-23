import { Modal, Pressable, ScrollView, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export function FilterSelect<T extends string | number>({
  label,
  value,
  options,
  onChange,
  open,
  onOpenChange,
  style
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const selected = options.find((option) => option.value === value);

  return (
    <View style={[styles.wrap, style]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        onPress={() => onOpenChange(!open)}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface2,
            borderColor: open ? colors.primary : colors.border
          }
        ]}
      >
        <Text style={[styles.value, { color: colors.text }]} numberOfLines={1}>
          {selected?.label || 'اختر'}
        </Text>
        <Text style={[styles.caret, { color: colors.textMuted }]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => onOpenChange(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={styles.backdrop} onPress={() => onOpenChange(false)} />
          <View style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.sheetTitle, { color: colors.text }]}>{label}</Text>
            <ScrollView keyboardShouldPersistTaps="handled" style={styles.sheetScroll}>
              {options.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textMuted }]}>لا توجد خيارات متاحة.</Text>
              ) : (
                options.map((option) => {
                  const active = option.value === value;

                  return (
                    <Pressable
                      key={String(option.value)}
                      onPress={() => {
                        onChange(option.value);
                        onOpenChange(false);
                      }}
                      style={[styles.option, active ? { backgroundColor: colors.primarySoft } : null]}
                    >
                      <Text
                        style={[styles.optionText, { color: active ? colors.primary : colors.text }]}
                        numberOfLines={2}
                      >
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
            <Pressable onPress={() => onOpenChange(false)} style={styles.close}>
              <Text style={[styles.closeText, { color: colors.textSecondary }]}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 4,
    alignSelf: 'stretch'
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    textAlign: 'right'
  },
  button: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6
  },
  value: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right'
  },
  caret: {
    fontSize: 12
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(6, 8, 18, 0.72)'
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 14,
    gap: 8,
    maxHeight: '72%'
  },
  sheetTitle: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right'
  },
  sheetScroll: {
    maxHeight: 360
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'right',
    paddingVertical: 12
  },
  option: {
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderRadius: 12
  },
  optionText: {
    fontFamily: fonts.semibold,
    fontSize: 13,
    textAlign: 'right'
  },
  close: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  closeText: {
    fontFamily: fonts.semibold,
    fontSize: 13
  }
});
