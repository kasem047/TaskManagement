import { apiRequest } from './client';
import type {
  ActivityLog,
  AdminDashboard,
  AdminUser,
  LoginResponse,
  NotificationItem,
  PasswordRecoveryStatus,
  Profile,
  Project,
  ProjectMember,
  AssignableMember,
  TaskAssignee,
  TaskComment,
  TaskItem,
  TaskPriority,
  TaskStatus,
  UserSession,
  Workspace,
  WorkspaceInvitation,
  WorkspaceInvitationCreateResult,
  WorkspaceMember,
  WorkspaceMemberCandidate,
  WorkspaceRoleOption
} from './types';

export const authApi = {
  login: (body: {
    email: string;
    password: string;
    deviceId: string;
    deviceName: string;
  }) => apiRequest<LoginResponse>('/api/Auth/login', { method: 'POST', body, auth: false }),

  getProfile: () => apiRequest<Profile>('/api/Auth/profile'),

  updateProfile: (fullName: string) =>
    apiRequest<Profile>('/api/Auth/profile', { method: 'PUT', body: { fullName } }),

  changePassword: (body: {
    currentPassword: string;
    newPassword: string;
    confirmNewPassword: string;
  }) => apiRequest<{ message: string }>('/api/Auth/change-password', { method: 'POST', body }),

  getSessions: () => apiRequest<UserSession[]>('/api/Auth/sessions'),

  logout: () => apiRequest<{ message: string }>('/api/Auth/logout', { method: 'POST', body: null }),

  requestPasswordRecovery: (body: {
    accountEmail: string;
    recoveryEmail: string;
    reason: string;
  }) =>
    apiRequest<PasswordRecoveryStatus>('/api/Auth/password-recovery/request', {
      method: 'POST',
      body,
      auth: false
    }),

  getPasswordRecoveryStatus: (publicToken: string) =>
    apiRequest<PasswordRecoveryStatus>(
      `/api/Auth/password-recovery/${encodeURIComponent(publicToken)}/status`,
      { auth: false }
    ),

  verifyRecoveryCode: (body: { publicToken: string; code: string }) =>
    apiRequest<{ resetToken: string; expiresAt: string }>(
      '/api/Auth/password-recovery/verify-code',
      { method: 'POST', body, auth: false }
    ),

  resetForgottenPassword: (body: {
    publicToken: string;
    resetToken: string;
    newPassword: string;
    confirmNewPassword: string;
  }) =>
    apiRequest<{ message: string }>('/api/Auth/password-recovery/reset', {
      method: 'POST',
      body,
      auth: false
    })
};

export const workspacesApi = {
  getAll: () => apiRequest<Workspace[]>('/api/Workspaces'),
  getById: (id: number) => apiRequest<Workspace>(`/api/Workspaces/${id}`),
  create: (body: { name: string; description: string | null; ownerUserId: number }) =>
    apiRequest<Workspace>('/api/Workspaces', { method: 'POST', body }),
  update: (id: number, body: { name: string; description: string | null }) =>
    apiRequest<Workspace>(`/api/Workspaces/${id}`, { method: 'PUT', body }),
  transferOwnership: (workspaceId: number, newOwnerUserId: number) =>
    apiRequest(`/api/Workspaces/${workspaceId}/transfer-ownership`, {
      method: 'POST',
      body: { newOwnerUserId }
    })
};

export const projectsApi = {
  getByWorkspace: (workspaceId: number) =>
    apiRequest<Project[]>(`/api/workspaces/${workspaceId}/projects`),
  create: (
    workspaceId: number,
    body: { name: string; description: string | null; managerUserId: number | null }
  ) =>
    apiRequest<Project>(`/api/workspaces/${workspaceId}/projects`, { method: 'POST', body }),
  update: (
    workspaceId: number,
    projectId: number,
    body: { name: string; description: string | null; managerUserId: number | null }
  ) =>
    apiRequest<Project>(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
      method: 'PUT',
      body
    }),
  archive: (workspaceId: number, projectId: number) =>
    apiRequest(`/api/workspaces/${workspaceId}/projects/${projectId}/archive`, {
      method: 'PUT',
      body: {}
    }),
  delete: (workspaceId: number, projectId: number) =>
    apiRequest(`/api/workspaces/${workspaceId}/projects/${projectId}`, {
      method: 'DELETE'
    }),
  getMembers: (workspaceId: number, projectId: number) =>
    apiRequest<ProjectMember[]>(`/api/workspaces/${workspaceId}/projects/${projectId}/members`),
  addMember: (workspaceId: number, projectId: number, userId: number) =>
    apiRequest<ProjectMember>(`/api/workspaces/${workspaceId}/projects/${projectId}/members`, {
      method: 'POST',
      body: { userId }
    }),
  removeMember: (workspaceId: number, projectId: number, userId: number) =>
    apiRequest(`/api/workspaces/${workspaceId}/projects/${projectId}/members/${userId}`, {
      method: 'DELETE'
    })
};

export const membersApi = {
  getByWorkspace: (workspaceId: number) =>
    apiRequest<WorkspaceMember[]>(`/api/workspaces/${workspaceId}/members`),
  getRoles: (workspaceId: number) =>
    apiRequest<WorkspaceRoleOption[]>(`/api/workspaces/${workspaceId}/members/roles`),
  getCandidates: (workspaceId: number) =>
    apiRequest<WorkspaceMemberCandidate[]>(`/api/workspaces/${workspaceId}/members/candidates`),
  add: (workspaceId: number, body: { userId: number; roleId: number }) =>
    apiRequest<WorkspaceMember>(`/api/workspaces/${workspaceId}/members`, {
      method: 'POST',
      body
    }),
  updateRole: (workspaceId: number, memberId: number, roleId: number) =>
    apiRequest<WorkspaceMember>(`/api/workspaces/${workspaceId}/members/${memberId}/role`, {
      method: 'PUT',
      body: { roleId }
    })
};

export const invitationsApi = {
  getMine: () => apiRequest<WorkspaceInvitation[]>('/api/workspace-invitations'),
  accept: (id: number) =>
    apiRequest(`/api/workspace-invitations/${id}/accept`, { method: 'POST', body: {} }),
  reject: (id: number) =>
    apiRequest(`/api/workspace-invitations/${id}/reject`, { method: 'POST', body: {} }),
  create: (workspaceId: number, body: { userId: number; roleId: number }) =>
    apiRequest<WorkspaceInvitationCreateResult>(`/api/workspaces/${workspaceId}/invitations`, {
      method: 'POST',
      body
    })
};

const priorityValue: Record<TaskPriority, number> = {
  Low: 1,
  Medium: 2,
  High: 3,
  Critical: 4
};

const statusValue: Record<string, number> = {
  Todo: 1,
  InProgress: 2,
  InReview: 3,
  PartiallyCompleted: 3,
  Done: 4,
  Cancelled: 5
};

export const tasksApi = {
  getByProject: (workspaceId: number, projectId: number) =>
    apiRequest<TaskItem[]>(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`),
  create: (
    workspaceId: number,
    projectId: number,
    body: {
      title: string;
      description: string | null;
      priority: TaskPriority;
      dueDate: string | null;
    }
  ) =>
    apiRequest<TaskItem>(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks`, {
      method: 'POST',
      body: {
        title: body.title,
        description: body.description,
        priority: priorityValue[body.priority],
        dueDate: body.dueDate
      }
    }),
  update: (
    workspaceId: number,
    projectId: number,
    taskId: number,
    body: {
      title: string;
      description: string | null;
      priority: TaskPriority;
      dueDate: string | null;
    }
  ) =>
    apiRequest<TaskItem>(`/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`, {
      method: 'PUT',
      body: {
        title: body.title,
        description: body.description,
        priority: priorityValue[body.priority],
        dueDate: body.dueDate
      }
    }),
  updateStatus: (
    workspaceId: number,
    projectId: number,
    taskId: number,
    status: TaskStatus,
    position: number,
    extra?: {
      progressPercentage?: number | null;
      progressNote?: string | null;
    }
  ) =>
    apiRequest<TaskItem>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/status`,
      {
        method: 'PUT',
        body: {
          status: statusValue[status] ?? status,
          position,
          progressPercentage: extra?.progressPercentage,
          progressNote: extra?.progressNote
        }
      }
    ),
  getComments: (workspaceId: number, projectId: number, taskId: number) =>
    apiRequest<TaskComment[]>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
    ),
  addComment: (workspaceId: number, projectId: number, taskId: number, content: string) =>
    apiRequest<TaskComment>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`,
      { method: 'POST', body: { content } }
    ),
  getAssignees: (workspaceId: number, projectId: number, taskId: number) =>
    apiRequest<TaskAssignee[]>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/assignees`
    ),
  getAssignableMembers: (workspaceId: number, projectId: number) =>
    apiRequest<AssignableMember[]>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/assignable-members`
    ),
  assign: (workspaceId: number, projectId: number, taskId: number, userId: number) =>
    apiRequest<TaskAssignee>(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/assignees`,
      { method: 'POST', body: { userId } }
    ),
  removeAssignee: (workspaceId: number, projectId: number, taskId: number, userId: number) =>
    apiRequest(
      `/api/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/assignees/${userId}`,
      { method: 'DELETE' }
    )
};

export const notificationsApi = {
  getAll: () => apiRequest<NotificationItem[]>('/api/notifications'),
  getUnreadCount: () => apiRequest<number>('/api/notifications/unread-count'),
  markRead: (id: number) =>
    apiRequest(`/api/notifications/${id}/read`, { method: 'PATCH', body: {} }),
  markAllRead: () => apiRequest('/api/notifications/read-all', { method: 'PATCH', body: {} })
};

export const activityApi = {
  getByWorkspace: (workspaceId: number) =>
    apiRequest<ActivityLog[]>(`/api/workspaces/${workspaceId}/activity-logs`)
};

export const adminApi = {
  getDashboard: () => apiRequest<AdminDashboard>('/api/admin/dashboard'),
  getUsers: (search?: string) => {
    const query = search?.trim() ? `?search=${encodeURIComponent(search.trim())}` : '';
    return apiRequest<AdminUser[]>(`/api/admin/users${query}`);
  },
  createUser: (body: {
    fullName: string;
    email: string;
    password: string;
    confirmPassword: string;
    isActive: boolean;
  }) => apiRequest<AdminUser>('/api/admin/users', { method: 'POST', body }),
  setActiveStatus: (userId: number, isActive: boolean) =>
    apiRequest<AdminUser>(`/api/admin/users/${userId}/active-status`, {
      method: 'PATCH',
      body: { isActive }
    })
};

export function normalizeTaskStatus(status: string): TaskStatus {
  if (status === 'InReview') {
    return 'PartiallyCompleted';
  }

  return status as TaskStatus;
}
