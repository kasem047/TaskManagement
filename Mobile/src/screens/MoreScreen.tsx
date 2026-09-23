import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { StyleSheet, Text, View } from 'react-native';
import { useAccess } from '../access/AccessProvider';
import { RoleSwitcher } from '../components/RoleSwitcher';
import { Button, MenuRow, Screen } from '../components/Ui';
import type { RootStackParamList } from '../navigation/types';
import { useTheme } from '../theme/ThemeProvider';
import { fonts } from '../theme/tokens';

export function MoreScreen() {
  const access = useAccess();
  const { colors, toggle, theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const ownerWorkspace = access.ownedWorkspaces[0];
  const scoped = access.scopedWorkspaces;
  const initial = (access.user?.fullName || 'م').trim().charAt(0);

  return (
    <Screen title="المزيد" subtitle="الحساب والإعدادات والتنقل حسب دورك الحالي." dense>
      <View style={[styles.profile, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.primarySoft }]}>
          <Text style={[styles.avatarText, { color: colors.primary }]}>{initial}</Text>
        </View>
        <View style={styles.profileCopy}>
          <Text style={[styles.name, { color: colors.text }]}>{access.user?.fullName}</Text>
          <Text style={[styles.email, { color: colors.textSecondary }]}>{access.user?.email}</Text>
          {access.activeRoleLabel !== 'الدور الحالي' ? (
            <Text style={[styles.role, { color: colors.primary }]}>{access.activeRoleLabel}</Text>
          ) : null}
        </View>
      </View>

      {access.showRoleSwitcher ? (
        <View style={styles.switcher}>
          <RoleSwitcher />
        </View>
      ) : null}

      <MenuRow
        title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}
        subtitle="بدّل مظهر التطبيق"
        icon={theme === 'light' ? 'moon-outline' : 'sunny-outline'}
        onPress={toggle}
      />
      <MenuRow
        title="الحساب"
        subtitle="الاسم وكلمة المرور والجلسات"
        icon="person-circle-outline"
        onPress={() => navigation.navigate('Account')}
      />
      {access.showAdminNav ? (
        <MenuRow
          title="مساحات العمل"
          subtitle="عرض المساحات ومالكيها وإنشاء مساحات جديدة"
          icon="briefcase-outline"
          onPress={() => navigation.navigate('AdminWorkspaces')}
        />
      ) : access.showWorkspacesNav ? (
        <MenuRow
          title="المساحات"
          subtitle="إدارة مساحات العمل"
          icon="grid-outline"
          onPress={() => navigation.navigate('CreateWorkspace')}
        />
      ) : null}
      {access.showTeamNav && ownerWorkspace ? (
        <MenuRow
          title="الفريق"
          subtitle={ownerWorkspace.name}
          icon="people-outline"
          onPress={() =>
            navigation.navigate('Team', {
              workspaceId: ownerWorkspace.id,
              workspaceName: ownerWorkspace.name
            })
          }
        />
      ) : null}
      {access.showActivityNav ? (
        <MenuRow
          title="النشاط"
          subtitle="سجل العمليات حسب مساحة العمل"
          icon="time-outline"
          onPress={() => {
            if (scoped.length === 1) {
              const workspace = scoped[0];
              navigation.navigate('Activity', {
                workspaceId: workspace.id,
                workspaceName: workspace.name
              });
              return;
            }

            navigation.navigate('ActivityHub');
          }}
        />
      ) : null}
      {access.showAdminNav ? (
        <MenuRow
          title="مستخدمو النظام"
          subtitle="إنشاء الحسابات وتفعيلها"
          icon="shield-outline"
          onPress={() => navigation.navigate('AdminUsers')}
        />
      ) : null}

      <Button label="تسجيل الخروج" variant="danger" icon="log-out-outline" onPress={() => void access.signOut()} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profile: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center'
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 16
  },
  profileCopy: {
    flex: 1,
    gap: 2
  },
  name: {
    fontFamily: fonts.bold,
    fontSize: 16,
    textAlign: 'right'
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 12,
    textAlign: 'right'
  },
  role: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    textAlign: 'right'
  },
  switcher: {
    alignItems: 'stretch'
  }
});
