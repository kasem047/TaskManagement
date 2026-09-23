export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  Projects: { workspaceId: number; workspaceName: string };
  CreateProject: { workspaceId: number };
  EditProject: { workspaceId: number; projectId: number };
  ProjectMembers: {
    workspaceId: number;
    projectId: number;
    projectName: string;
  };
  Tasks: {
    workspaceId: number;
    projectId: number;
    projectName: string;
  };
  TaskDetail: {
    workspaceId: number;
    projectId: number;
    taskId: number;
    projectName: string;
  };
  CreateTask: {
    workspaceId: number;
    projectId: number;
  };
  Team: { workspaceId: number; workspaceName: string };
  ActivityHub: undefined;
  Activity: { workspaceId: number; workspaceName: string };
  CreateWorkspace: undefined;
  AdminWorkspaces: undefined;
  AdminUsers: undefined;
  CreateAdminUser: undefined;
  Account: undefined;
};

export type MainTabParamList = {
  HomeTab: undefined;
  ProjectsTab: undefined;
  TasksTab: undefined;
  WorkspacesTab: undefined;
  NotificationsTab: undefined;
  MoreTab: undefined;
};
