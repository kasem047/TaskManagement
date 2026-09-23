import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { extractApiError } from '../api/client';
import { authApi } from '../api/services';
import type { UserSession } from '../api/types';
import { useAccess } from '../access/AccessProvider';
import { Banner, Button, Field, ListRow, Screen } from '../components/Ui';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export function AccountScreen() {
  const access = useAccess();
  const { colors } = useTheme();
  const [fullName, setFullName] = useState(access.profile?.fullName || access.user?.fullName || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    void authApi.getSessions().then(setSessions).catch(() => setSessions([]));
  }, []);

  return (
    <Screen
      dense
      title="الحساب"
      subtitle={[access.user?.email, access.activeRoleMode ? access.activeRoleLabel : null, access.scopedWorkspaces[0]?.name]
        .filter(Boolean)
        .join(' · ')}
    >
      <Banner text={error} />
      <Banner text={success} kind="success" />
      <Field dense label="الاسم الكامل" value={fullName} onChangeText={setFullName} />
      <Button
        label="حفظ الاسم"
        size="sm"
        onPress={() => {
          void authApi
            .updateProfile(fullName.trim())
            .then(async () => {
              setSuccess('تم تحديث الاسم.');
              await access.refresh();
            })
            .catch((caught) => setError(extractApiError(caught)));
        }}
      />
      <Field dense label="كلمة المرور الحالية" value={currentPassword} onChangeText={setCurrentPassword} secureTextEntry />
      <Field dense label="كلمة المرور الجديدة" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
      <Field dense label="تأكيد كلمة المرور" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry />
      <Button
        label="تغيير كلمة المرور"
        size="sm"
        variant="secondary"
        onPress={() => {
          void authApi
            .changePassword({
              currentPassword,
              newPassword,
              confirmNewPassword: confirmPassword
            })
            .then(() => setSuccess('تم تغيير كلمة المرور.'))
            .catch((caught) => setError(extractApiError(caught)));
        }}
      />
      <Text style={[styles.section, { color: colors.text }]}>الجلسات</Text>
      {sessions.map((session) => (
        <ListRow
          key={session.id}
          title={session.deviceName || 'جهاز'}
          subtitle={session.isCurrentSession ? 'الجلسة الحالية' : 'جلسة أخرى'}
        />
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: {
    fontFamily: fonts.bold,
    fontSize: 15,
    textAlign: 'right',
    marginTop: 4
  }
});
