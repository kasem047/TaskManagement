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
  TasksPage
} from './features/tasks/pages/tasks/tasks';

import {
  MainLayout
} from './layout/main-layout/main-layout';

import {
  authGuard
} from './core/guards/auth-guard';


export const routes: Routes = [

  // Login
  {
    path: 'login',
    component: Login
  },


  // Protected Application
  {
    path: '',

    component: MainLayout,

    canActivate: [
      authGuard
    ],

    children: [

      // Dashboard
      {
        path: 'dashboard',
        component: Dashboard
      },


      // Workspace Projects
      {
        path: 'workspaces/:workspaceId/projects',
        component: ProjectsPage
      },


      // Project Tasks
      {
        path: 'workspaces/:workspaceId/projects/:projectId/tasks',
        component: TasksPage
      },


      // Default
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      }

    ]
  },


  // Unknown URL
  {
    path: '**',
    redirectTo: 'dashboard'
  }

];