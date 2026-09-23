export type Workspace = {
  id: number;
  name: string;
  description: string | null;
  createdByUserId: number;
  createdByUserName: string;
  currentUserRole: string;
  ownerUserId: number;
  ownerUserName: string;
  createdAt: string;
};

export type Project = {
  id: number;
  workspaceId: number;
  managerUserId: number | null;
  managerUserFullName: string | null;
  name: string;
  description: string | null;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string | null;
};

export type ProjectMember = {
  id: number;
  projectId: number;
  userId: number;
  fullName: string;
  email: string;
  roleName: string;
  joinedAt: string;
};

export type AssignableMember = {
  userId: number;
  fullName: string;
  email: string;
  roleName: string;
};

export type WorkspaceMember = {
  id: number;
  workspaceId: number;
  userId: number;
  fullName: string;
  email: string;
  roleId: number;
  roleName: string;
  status: string;
  joinedAt: string;
};

export type WorkspaceMemberCandidate = {
  userId: number;
  fullName: string;
  email: string;
};

export type TaskStatus =
  | 'Todo'
  | 'InProgress'
  | 'InReview'
  | 'PartiallyCompleted'
  | 'Done'
  | 'Cancelled';

export type TaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export type TaskItem = {
  id: number;
  projectId: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  position: number;
  createdByUserId: number;
  progressPercentage: number | null;
  progressNote: string | null;
  createdAt: string;
};

export type TaskComment = {
  id: number;
  taskItemId: number;
  userId: number;
  userFullName: string;
  content: string;
  createdAt: string;
};

export type TaskAssignee = {
  id: number;
  taskItemId: number;
  userId: number;
  userFullName: string;
  assignedAt: string;
};

export type NotificationItem = {
  id: number;
  userId: number;
  actorUserFullName: string;
  workspaceId: number | null;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
};

export type ActivityLog = {
  id: number;
  workspaceId: number;
  userId: number;
  userFullName: string;
  action: string;
  entityName: string;
  entityId: number;
  description: string | null;
  createdAt: string;
};

export type Profile = {
  userId?: number;
  id?: number;
  fullName: string;
  email: string;
  isSystemAdmin?: boolean;
};

export type LoginResponse = {
  userId: number;
  fullName: string;
  email: string;
  token: string;
  expiresAt: string;
  sessionId: number;
};

export type PasswordRecoveryStatus = {
  publicToken: string;
  status: string;
  message: string;
  recoveryEmailMasked: string;
  codeSent: boolean;
  codeVerified: boolean;
  canEnterCode: boolean;
  canCreateNewRequest: boolean;
  isResetCompleted: boolean;
};

export type AdminDashboard = {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  totalWorkspaces: number;
  totalProjects: number;
  activeProjects: number;
  archivedProjects: number;
  totalTasks: number;
  todoTasks: number;
  inProgressTasks: number;
  inReviewTasks: number;
  doneTasks: number;
  cancelledTasks: number;
};

export type AdminUser = {
  id: number;
  userName: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  ownsWorkspace: boolean;
  workspaceRole?: string;
  roleDescription?: string;
  createdAt: string;
  lastLoginAt: string | null;
};

export type WorkspaceInvitation = {
  id: number;
  workspaceId: number;
  workspaceName: string;
  invitedUserFullName: string;
  roleName: string;
  status: string;
  createdAt: string;
};

export type WorkspaceInvitationCreateResult = {
  addedDirectly: boolean;
  message: string;
  member: WorkspaceMember | null;
  invitation: WorkspaceInvitation | null;
};

export type WorkspaceRoleOption = {
  id: number;
  name: string;
  description: string | null;
};

export type UserSession = {
  id: number;
  deviceName: string | null;
  expiresAt: string;
  lastUsedAt: string | null;
  isCurrentSession: boolean;
};
