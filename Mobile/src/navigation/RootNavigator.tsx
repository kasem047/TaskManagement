import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAccess } from '../access/AccessProvider';
import { Loader } from '../components/Ui';
import { AccountScreen } from '../screens/AccountScreen';
import { AdminUsersScreen, AdminWorkspacesScreen, CreateAdminUserScreen, CreateWorkspaceScreen } from '../screens/AdminScreens';
import { LoginScreen } from '../screens/LoginScreen';
import { ProjectMembersScreen } from '../screens/ProjectMembersScreen';
import { CreateProjectScreen, EditProjectScreen, ProjectsScreen } from '../screens/ProjectsScreen';
import { CreateTaskScreen, TasksScreen } from '../screens/TasksScreen';
import { TaskDetailScreen } from '../screens/TaskDetailScreen';
import { ActivityHubScreen, ActivityScreen, TeamScreen } from '../screens/TeamScreen';
import { useTheme } from '../theme/ThemeProvider';
import { MainTabs } from './MainTabs';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const access = useAccess();
  const { theme, colors } = useTheme();

  if (!access.ready) {
    return <Loader />;
  }

  const navTheme = theme === 'dark' ? DarkTheme : DefaultTheme;

  return (
    <NavigationContainer
      theme={{
        ...navTheme,
        colors: {
          ...navTheme.colors,
          background: colors.bg,
          card: colors.surface,
          text: colors.text,
          border: colors.border,
          primary: colors.primary
        }
      }}
    >
      <Stack.Navigator
        screenOptions={{
          headerTitleAlign: 'center',
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '700', fontSize: 18 },
          contentStyle: { backgroundColor: colors.bg }
        }}
      >
        {access.isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
            <Stack.Screen name="Projects" component={ProjectsScreen} options={{ title: 'المشاريع' }} />
            <Stack.Screen name="CreateProject" component={CreateProjectScreen} options={{ title: 'مشروع جديد' }} />
            <Stack.Screen name="EditProject" component={EditProjectScreen} options={{ title: 'إدارة المشروع' }} />
            <Stack.Screen name="ProjectMembers" component={ProjectMembersScreen} options={{ title: 'أعضاء المشروع' }} />
            <Stack.Screen name="Tasks" component={TasksScreen} options={{ title: 'المهام' }} />
            <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ title: 'مهمة جديدة' }} />
            <Stack.Screen name="TaskDetail" component={TaskDetailScreen} options={{ title: 'المهمة' }} />
            <Stack.Screen name="Team" component={TeamScreen} options={{ title: 'الفريق' }} />
            <Stack.Screen name="ActivityHub" component={ActivityHubScreen} options={{ title: 'النشاط' }} />
            <Stack.Screen name="Activity" component={ActivityScreen} options={{ title: 'سجل النشاط' }} />
            <Stack.Screen name="CreateWorkspace" component={CreateWorkspaceScreen} options={{ title: 'مساحة عمل' }} />
            <Stack.Screen name="AdminWorkspaces" component={AdminWorkspacesScreen} options={{ title: 'مساحات العمل' }} />
            <Stack.Screen name="AdminUsers" component={AdminUsersScreen} options={{ title: 'المستخدمون' }} />
            <Stack.Screen name="CreateAdminUser" component={CreateAdminUserScreen} options={{ title: 'مستخدم جديد' }} />
            <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'الحساب' }} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
