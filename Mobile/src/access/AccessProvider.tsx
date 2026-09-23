import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { Profile, Workspace } from '../api/types';
import { authApi, workspacesApi } from '../api/services';
import { getItem, setItem } from '../storage/kv';
import { clearSession, getToken, getUser, type StoredUser } from '../storage/session';

export type AppRoleMode = 'owner' | 'manager' | 'member';

const ROLE_MODE_KEY = 'taskmanagement_role_mode';

export function isOwnerRole(role?: string | null) {
  return role === 'WorkspaceOwner' || role === 'Owner';
}

export function isManagerRole(role?: string | null) {
  return role === 'ProjectManager';
}

export function isMemberRole(role?: string | null) {
  return role === 'Member';
}

export function roleLabel(role?: string | null) {
  switch (role) {
    case 'WorkspaceOwner':
    case 'Owner':
      return 'مالك مساحة العمل';
    case 'ProjectManager':
      return 'مدير مشروع';
    case 'Member':
      return 'عضو';
    case 'SystemAdmin':
      return 'مسؤول النظام';
    default:
      return role || '—';
  }
}

export function roleModeLabel(mode: AppRoleMode | null) {
  switch (mode) {
    case 'owner':
      return 'مالك مساحة العمل';
    case 'manager':
      return 'مدير المشروع';
    case 'member':
      return 'عضو';
    default:
      return 'الدور الحالي';
  }
}

type AccessContextValue = {
  ready: boolean;
  user: StoredUser | null;
  profile: Profile | null;
  workspaces: Workspace[];
  isSystemAdmin: boolean;
  isAuthenticated: boolean;
  currentUserId: number | null;
  ownedWorkspaces: Workspace[];
  pmWorkspaces: Workspace[];
  memberWorkspaces: Workspace[];
  scopedWorkspaces: Workspace[];
  availableRoleModes: AppRoleMode[];
  activeRoleMode: AppRoleMode | null;
  activeRoleLabel: string;
  showRoleSwitcher: boolean;
  isFreeUser: boolean;
  canCreateWorkspace: boolean;
  showAdminNav: boolean;
  showOwnerNav: boolean;
  showPmNav: boolean;
  showMemberNav: boolean;
  showProjectsNav: boolean;
  showTasksNav: boolean;
  showTeamNav: boolean;
  showActivityNav: boolean;
  showWorkspacesNav: boolean;
  matchesActiveRole: (role?: string | null) => boolean;
  roleIn: (workspaceId: number) => string;
  setRoleMode: (mode: AppRoleMode) => void;
  refresh: () => Promise<void>;
  setAuthenticatedUser: (user: StoredUser) => Promise<void>;
  signOut: () => Promise<void>;
};

const AccessContext = createContext<AccessContextValue | null>(null);

function parseRoleMode(value: string | null): AppRoleMode | null {
  if (value === 'owner' || value === 'manager' || value === 'member') {
    return value;
  }

  return null;
}

export function AccessProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [storedRoleMode, setStoredRoleMode] = useState<AppRoleMode | null>(null);

  const load = useCallback(async () => {
    const token = await getToken();
    const storedUser = await getUser();
    const storedMode = parseRoleMode(await getItem(ROLE_MODE_KEY));

    setStoredRoleMode(storedMode);

    if (!token) {
      setUser(null);
      setProfile(null);
      setWorkspaces([]);
      setReady(true);
      return;
    }

    setUser(storedUser);

    try {
      const [nextProfile, nextWorkspaces] = await Promise.all([
        authApi.getProfile(),
        workspacesApi.getAll()
      ]);

      setProfile(nextProfile);
      setWorkspaces(nextWorkspaces);
    } catch (caught) {
      const status = (caught as { status?: number }).status;

      if (status === 401) {
        await clearSession();
        setUser(null);
        setProfile(null);
        setWorkspaces([]);
      } else {
        setProfile(null);
        setWorkspaces([]);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const value = useMemo<AccessContextValue>(() => {
    const isSystemAdmin = profile?.isSystemAdmin === true;
    const ownedWorkspaces = isSystemAdmin
      ? []
      : workspaces.filter((workspace) => isOwnerRole(workspace.currentUserRole));
    const pmWorkspaces = isSystemAdmin
      ? []
      : workspaces.filter((workspace) => isManagerRole(workspace.currentUserRole));
    const memberWorkspaces = isSystemAdmin
      ? []
      : workspaces.filter((workspace) => isMemberRole(workspace.currentUserRole));

    const availableRoleModes: AppRoleMode[] = [];

    if (ownedWorkspaces.length > 0) {
      availableRoleModes.push('owner');
    }

    if (pmWorkspaces.length > 0) {
      availableRoleModes.push('manager');
    }

    if (memberWorkspaces.length > 0) {
      availableRoleModes.push('member');
    }

    const activeRoleMode =
      availableRoleModes.length === 0
        ? null
        : storedRoleMode && availableRoleModes.includes(storedRoleMode)
          ? storedRoleMode
          : availableRoleModes[0];

    const matchesActiveRole = (role?: string | null) => {
      if (!activeRoleMode) {
        return true;
      }

      if (activeRoleMode === 'owner') {
        return isOwnerRole(role);
      }

      if (activeRoleMode === 'manager') {
        return isManagerRole(role);
      }

      return isMemberRole(role);
    };

    const showOwnerNav = activeRoleMode === 'owner';
    const showPmNav = activeRoleMode === 'manager';
    const showMemberNav = activeRoleMode === 'member';
    const isFreeUser = ready && !isSystemAdmin && workspaces.length === 0;

    return {
      ready,
      user,
      profile,
      workspaces,
      isSystemAdmin,
      isAuthenticated: Boolean(user),
      currentUserId: profile?.userId ?? profile?.id ?? user?.userId ?? null,
      ownedWorkspaces,
      pmWorkspaces,
      memberWorkspaces,
      scopedWorkspaces: workspaces.filter((workspace) =>
        matchesActiveRole(workspace.currentUserRole)
      ),
      availableRoleModes,
      activeRoleMode,
      activeRoleLabel: roleModeLabel(activeRoleMode),
      showRoleSwitcher: availableRoleModes.length > 1,
      isFreeUser,
      canCreateWorkspace: isSystemAdmin,
      showAdminNav: isSystemAdmin,
      showOwnerNav,
      showPmNav,
      showMemberNav,
      showProjectsNav: showOwnerNav || showPmNav || showMemberNav,
      showTasksNav: showOwnerNav || showPmNav || showMemberNav,
      showTeamNav: showOwnerNav,
      showActivityNav: isSystemAdmin || showOwnerNav || showPmNav || showMemberNav,
      showWorkspacesNav: isSystemAdmin || isFreeUser,
      matchesActiveRole,
      roleIn: (workspaceId) => {
        if (isSystemAdmin) {
          return 'SystemAdmin';
        }

        return workspaces.find((workspace) => workspace.id === workspaceId)?.currentUserRole ?? '';
      },
      setRoleMode: (mode) => {
        if (!availableRoleModes.includes(mode)) {
          return;
        }

        setStoredRoleMode(mode);
        void setItem(ROLE_MODE_KEY, mode);
      },
      refresh: load,
      setAuthenticatedUser: async (nextUser) => {
        setUser(nextUser);
        await load();
      },
      signOut: async () => {
        try {
          await authApi.logout();
        } catch {
          // Local sign-out still proceeds.
        }

        await clearSession();
        setUser(null);
        setProfile(null);
        setWorkspaces([]);
      }
    };
  }, [load, profile, ready, storedRoleMode, user, workspaces]);

  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

export function useAccess() {
  const context = useContext(AccessContext);

  if (!context) {
    throw new Error('useAccess must be used within AccessProvider');
  }

  return context;
}

export function dashboardSubtitle(access: AccessContextValue) {
  if (access.isSystemAdmin) {
    return 'نظرة شاملة على المستخدمين ومساحات العمل والمشاريع والمهام.';
  }

  if (access.isFreeUser) {
    return 'بانتظار مسؤول النظام لإنشاء مساحة عمل وإسنادها إليك، أو قبول دعوة عند وصولها.';
  }

  if (access.activeRoleMode === 'owner') {
    return 'ملخص المستخدمين والمشاريع والمهام داخل مساحتك.';
  }

  if (access.activeRoleMode === 'manager') {
    return 'تابع المشروع المسند إليك وحالة مهامه داخل نطاق إدارتك.';
  }

  if (access.activeRoleMode === 'member') {
    return 'تابع المشروع المسند إليك والمهام باسمك فقط.';
  }

  return 'تابع مساحات عملك حسب الدور الذي اخترته.';
}
