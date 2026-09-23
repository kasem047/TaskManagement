import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { AssignableMember } from '../screens/taskUi';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, radii } from '../theme/tokens';

export function AssigneePicker({
  members,
  selectedUserId,
  selectedName,
  disabled,
  error,
  hint = 'يمكن إسناد المهمة لأعضاء المشروع أو أعضاء مساحة العمل بدور عضو.',
  onSelect,
  onClear
}: {
  members: AssignableMember[];
  selectedUserId?: number | null;
  selectedName?: string | null;
  disabled?: boolean;
  error?: string;
  hint?: string;
  onSelect: (member: AssignableMember) => void;
  onClear?: () => void;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = members.find((member) => member.userId === selectedUserId);
  const label = selected?.fullName || selectedName || 'اختر عضوًا لإسناد المهمة';

  const visible = useMemo(() => {
    const text = query.trim().toLowerCase();

    return members.filter((member) => {
      if (!text) {
        return true;
      }

      return `${member.fullName} ${member.email}`.toLowerCase().includes(text);
    });
  }, [members, query]);

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>مسؤول المهمة</Text>
      <Pressable
        disabled={disabled}
        onPress={() => setOpen((value) => !value)}
        style={[
          styles.button,
          {
            backgroundColor: colors.surface2,
            borderColor: open ? colors.primary : colors.border,
            opacity: disabled ? 0.55 : 1
          }
        ]}
      >
        <Text
          style={[
            styles.value,
            { color: selected || selectedName ? colors.text : colors.textMuted }
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        <Text style={[styles.caret, { color: colors.textMuted }]}>{open ? '▴' : '▾'}</Text>
      </Pressable>

      {open && !disabled ? (
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="ابحث بالاسم أو البريد"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.search,
              {
                backgroundColor: colors.surface2,
                borderColor: colors.border,
                color: colors.text
              }
            ]}
          />
          {visible.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              {query.trim()
                ? 'لا يوجد أعضاء مطابقون.'
                : 'لا يوجد أعضاء يمكن إسناد المهمة إليهم ضمن المشروع أو مساحة العمل.'}
            </Text>
          ) : (
            visible.map((member) => {
              const active = member.userId === selectedUserId;

              return (
                <Pressable
                  key={member.userId}
                  onPress={() => {
                    onSelect(member);
                    setOpen(false);
                    setQuery('');
                  }}
                  style={[
                    styles.option,
                    active ? { backgroundColor: colors.primarySoft } : null
                  ]}
                >
                  <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {member.fullName.trim().charAt(0)}
                    </Text>
                  </View>
                  <View style={styles.copy}>
                    <Text style={[styles.name, { color: active ? colors.primary : colors.text }]}>
                      {member.fullName}
                    </Text>
                    <Text style={[styles.email, { color: colors.textMuted }]}>{member.email}</Text>
                  </View>
                </Pressable>
              );
            })
          )}
          {selectedUserId && onClear ? (
            <Pressable
              onPress={() => {
                onClear();
                setOpen(false);
              }}
              style={styles.clear}
            >
              <Text style={[styles.clearText, { color: colors.danger }]}>إزالة الإسناد</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {error ? <Text style={[styles.error, { color: colors.danger }]}>{error}</Text> : null}
      {!error && hint ? <Text style={[styles.hint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 6
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  button: {
    minHeight: 42,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8
  },
  value: {
    flex: 1,
    fontFamily: fonts.semibold,
    fontSize: 14,
    textAlign: 'right'
  },
  caret: {
    fontSize: 12
  },
  menu: {
    borderWidth: 1,
    borderRadius: 12,
    overflow: 'hidden'
  },
  search: {
    minHeight: 40,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'right'
  },
  empty: {
    fontFamily: fonts.regular,
    fontSize: 13,
    textAlign: 'right',
    padding: 12
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 12
  },
  copy: {
    flex: 1,
    gap: 1
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 13,
    textAlign: 'right'
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 11,
    textAlign: 'right'
  },
  clear: {
    padding: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)'
  },
  clearText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    textAlign: 'center'
  },
  error: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right'
  }
});
