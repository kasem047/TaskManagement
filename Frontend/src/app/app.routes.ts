import {
  Routes
} from '@angular/router';

import {
  Login
} from './features/auth/pages/login/login';

import {
  Dashboard
} from './features/dashboard/pages/dashboard/dashboard';

import {
  ProjectsPage
} from './features/projects/pages/projects/projects';

import {
  ProjectsEntryPage
} from './features/projects/pages/projects-entry/projects-entry';

import {
  TasksPage
} from './features/tasks/pages/tasks/tasks';

import {
  TasksEntryPage
} from './features/tasks/pages/tasks-entry/tasks-entry';

import {
  WorkspaceManagementPage
} from './features/workspaces/pages/workspace-management/workspace-management';

import {
  PasswordRecoveryAdminPage
} from './features/admin/pages/password-recovery/password-recovery-admin';

import {
  AdminDashboardPage
} from './features/dashboard/pages/admin-dashboard/admin-dashboard';

import {
  AccountPage
} from './features/account/pages/account/account';

import {
  AdminUsersPage
} from './features/admin/pages/users/admin-users';

import {
  RolesPermissionsPage
} from './features/admin/pages/roles-permissions/roles-permissions';

import {
  TeamPage
} from './features/team/pages/team/team';

import {
  ActivityLogsPage
} from './features/activity/pages/activity-logs/activity-logs';

import {
  NotificationsPage
} from './features/notifications/pages/notifications/notifications';

import {
  MainLayout
} from './layout/main-layout/main-layout';

import {
  authGuard
} from './core/guards/auth-guard';

import {
  adminGuard
} from './core/guards/admin-guard';


export const routes:
  Routes = [

  {
    path:
      'login',

    component:
      Login
  },


  {
    path: '',

    component:
      MainLayout,

    canActivate: [
      authGuard
    ],

    children: [

      {
        path:
          'dashboard',

        component:
          Dashboard
      },


      {
        path:
          'account',

        component:
          AccountPage
      },


      {
        path:
          'workspaces',

        component:
          WorkspaceManagementPage
      },


      {
        path:
          'team',

        component:
          TeamPage
      },


      {
        path:
          'activity',

        component:
          ActivityLogsPage
      },


      {
        path:
          'notifications',

        component:
          NotificationsPage
      },


      {
        path:
          'projects',

        component:
          ProjectsEntryPage
      },


      {
        path:
          'workspaces/:workspaceId/projects',

        component:
          ProjectsPage
      },


      {
        path:
          'tasks',

        component:
          TasksEntryPage
      },


      {
        path:
          'workspaces/:workspaceId/projects/:projectId/tasks',

        component:
          TasksPage
      },


      {
        path:
          'admin',

        component:
          AdminDashboardPage,

        canActivate: [
          adminGuard
        ]
      },


      {
        path:
          'admin/dashboard',

        component:
          AdminDashboardPage,

        canActivate: [
          adminGuard
        ]
      },


      {
        path:
          'admin/users',

        component:
          AdminUsersPage,

        canActivate: [
          adminGuard
        ]
      },


      {
        path:
          'admin/password-recovery',

        component:
          PasswordRecoveryAdminPage,

        canActivate: [
          adminGuard
        ]
      },


      {
        path:
          'admin/roles-permissions',

        component:
          RolesPermissionsPage,

        canActivate: [
          adminGuard
        ]
      },


      {
        path:
          'admin/user-permissions',

        pathMatch:
          'full',

        redirectTo:
          'admin/roles-permissions'
      },


      {
        path: '',

        pathMatch:
          'full',

        redirectTo:
          'dashboard'
      }

    ]
  },


  {
    path: '**',

    redirectTo:
      'dashboard'
  }

];