import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform, StyleSheet, View } from 'react-native';
import { useAccess } from '../access/AccessProvider';
import { Icon, type IconName } from '../components/Icon';
import { AdminWorkspacesScreen } from '../screens/AdminScreens';
import { HomeScreen } from '../screens/HomeScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProjectsEntryScreen, TasksEntryScreen } from '../screens/ProjectsScreen';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, gradient } from '../theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export function MainTabs() {
  const access = useAccess();
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: true,
        tabBarActiveTintColor: '#FFFFFF',
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.label,
        tabBarStyle: {
          position: 'absolute',
          left: 16,
          right: 16,
          bottom: Platform.OS === 'web' ? 16 : 20,
          height: 72,
          borderRadius: 28,
          backgroundColor: colors.sidebar,
          borderTopWidth: 0,
          paddingTop: 8,
          paddingBottom: 10,
          elevation: 16,
          shadowColor: '#7B5CFF',
          shadowOpacity: 0.25,
          shadowRadius: 18,
          shadowOffset: { width: 0, height: 8 }
        },
        tabBarItemStyle: {
          borderRadius: 20
        },
        tabBarIcon: ({ focused, color }) => {
          const icons: Record<string, IconName> = {
            HomeTab: focused ? 'home' : 'home-outline',
            ProjectsTab: focused ? 'grid' : 'grid-outline',
            TasksTab: focused ? 'checkbox' : 'checkbox-outline',
            WorkspacesTab: focused ? 'briefcase-outline' : 'briefcase-outline',
            NotificationsTab: focused ? 'notifications' : 'notifications-outline',
            MoreTab: focused ? 'ellipsis-horizontal' : 'ellipsis-horizontal-outline'
          };

          if (focused) {
            return (
              <View style={[styles.activeIcon, { backgroundColor: gradient.start }]}>
                <Icon name={icons[route.name]} size={18} color="#fff" />
              </View>
            );
          }

          return <Icon name={icons[route.name]} size={22} color={color} />;
        }
      })}
    >
      <Tab.Screen name="HomeTab" component={HomeScreen} options={{ tabBarLabel: 'الرئيسية' }} />
      {access.showAdminNav ? (
        <Tab.Screen name="WorkspacesTab" component={AdminWorkspacesScreen} options={{ tabBarLabel: 'المساحات' }} />
      ) : null}
      {access.showProjectsNav ? (
        <Tab.Screen name="ProjectsTab" component={ProjectsEntryScreen} options={{ tabBarLabel: 'المشاريع' }} />
      ) : null}
      {access.showTasksNav ? (
        <Tab.Screen name="TasksTab" component={TasksEntryScreen} options={{ tabBarLabel: 'المهام' }} />
      ) : null}
      <Tab.Screen
        name="NotificationsTab"
        component={NotificationsScreen}
        options={{ tabBarLabel: 'الإشعارات' }}
      />
      <Tab.Screen name="MoreTab" component={MoreScreen} options={{ tabBarLabel: 'المزيد' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.semibold,
    fontSize: 11,
    marginTop: 2
  },
  activeIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: -2
  }
});
