import {
  Injectable,
  inject,
  signal
} from '@angular/core';

import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  tap
} from 'rxjs';

import {
  AccountProfileResponse,
  Auth
} from './auth';

import {
  Workspace,
  Workspaces
} from './workspaces';

import {
  TokenStorage
} from './token-storage';


export const OWNER_ROLES = [
  'WorkspaceOwner',
  'Owner'
] as const;


export function isOwnerRole(
  role:
    string |
    null |
    undefined
): boolean {

  return (
    role === 'WorkspaceOwner' ||
    role === 'Owner'
  );
}


export function isManagerRole(
  role:
    string |
    null |
    undefined
): boolean {

  return role === 'ProjectManager';
}


export function isMemberRole(
  role:
    string |
    null |
    undefined
): boolean {

  return role === 'Member';
}


export type AppRoleMode =
  | 'owner'
  | 'manager'
  | 'member';


const ROLE_MODE_KEY =
  'taskmanagement_role_mode';


function readStoredRoleMode():
  AppRoleMode | null {

  const value =
    localStorage.getItem(
      ROLE_MODE_KEY
    );

  if (
    value === 'owner' ||
    value === 'manager' ||
    value === 'member'
  ) {

    return value;
  }

  return null;
}


export interface AccessSnapshot {

  profile:
    AccountProfileResponse | null;

  workspaces:
    Workspace[];

  loaded:
    boolean;
}


@Injectable({
  providedIn: 'root'
})
export class WorkspaceAccess {

  private readonly auth =
    inject(Auth);


  private readonly workspacesService =
    inject(Workspaces);


  private readonly tokenStorage =
    inject(TokenStorage);


  private snapshot:
    AccessSnapshot = {

    profile:
      null,

    workspaces: [],

    loaded:
      false
  };


  private readonly storedRoleMode =
    signal<AppRoleMode | null>(
      readStoredRoleMode()
    );


  current():
    AccessSnapshot {

    return this.snapshot;
  }


  get profile():
    AccountProfileResponse | null {

    return this.snapshot.profile;
  }


  get workspaces():
    Workspace[] {

    return this.snapshot.workspaces;
  }


  get loaded():
    boolean {

    return this.snapshot.loaded;
  }


  get isSystemAdmin():
    boolean {

    return this.snapshot.profile?.isSystemAdmin === true;
  }


  get currentUserId():
    number | null {

    return (
      this.snapshot.profile?.userId
      ?? this.snapshot.profile?.id
      ?? this.tokenStorage.getUser()?.userId
      ?? null
    );
  }


  get ownedWorkspaces():
    Workspace[] {

    if (this.isSystemAdmin) {
      return [];
    }

    return this.snapshot.workspaces
      .filter(workspace =>
        isOwnerRole(
          workspace.currentUserRole
        )
      );
  }


  get pmWorkspaces():
    Workspace[] {

    if (this.isSystemAdmin) {
      return [];
    }

    return this.snapshot.workspaces
      .filter(workspace =>
        isManagerRole(
          workspace.currentUserRole
        )
      );
  }


  get memberWorkspaces():
    Workspace[] {

    if (this.isSystemAdmin) {
      return [];
    }

    return this.snapshot.workspaces
      .filter(workspace =>
        isMemberRole(
          workspace.currentUserRole
        )
      );
  }


  get isFreeUser():
    boolean {

    return (
      this.snapshot.loaded &&
      !this.isSystemAdmin &&
      this.snapshot.workspaces.length === 0
    );
  }


  get canCreateWorkspace():
    boolean {

    return this.isSystemAdmin;
  }


  get availableRoleModes():
    AppRoleMode[] {

    if (this.isSystemAdmin) {
      return [];
    }

    const modes:
      AppRoleMode[] = [];

    if (this.ownedWorkspaces.length > 0) {
      modes.push('owner');
    }

    if (this.pmWorkspaces.length > 0) {
      modes.push('manager');
    }

    if (this.memberWorkspaces.length > 0) {
      modes.push('member');
    }

    return modes;
  }


  get showRoleSwitcher():
    boolean {

    return this.availableRoleModes.length > 1;
  }


  get activeRoleMode():
    AppRoleMode | null {

    const available =
      this.availableRoleModes;

    if (available.length === 0) {
      return null;
    }

    const stored =
      this.storedRoleMode();

    if (
      stored &&
      available.includes(stored)
    ) {

      return stored;
    }

    return available[0];
  }


  get activeRoleLabel():
    string {

    return this.roleModeLabel(
      this.activeRoleMode
    );
  }


  roleModeLabel(
    mode:
      AppRoleMode | null
  ): string {

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


  setRoleMode(
    mode: AppRoleMode
  ): void {

    if (
      !this.availableRoleModes
        .includes(mode)
    ) {

      return;
    }

    this.storedRoleMode.set(mode);

    localStorage.setItem(
      ROLE_MODE_KEY,
      mode
    );

    this.alignStoredWorkspace();
  }


  matchesActiveRole(
    role:
      string |
      null |
      undefined
  ): boolean {

    const mode =
      this.activeRoleMode;

    if (!mode) {
      return true;
    }

    if (mode === 'owner') {
      return isOwnerRole(role);
    }

    if (mode === 'manager') {
      return isManagerRole(role);
    }

    return isMemberRole(role);
  }


  get scopedWorkspaces():
    Workspace[] {

    return this.snapshot.workspaces
      .filter(workspace =>
        this.matchesActiveRole(
          workspace.currentUserRole
        )
      );
  }


  isRouteAllowed(
    url: string
  ): boolean {

    if (this.isSystemAdmin) {
      return true;
    }

    const path =
      url.split('?')[0].split('#')[0];

    const mode =
      this.activeRoleMode;

    const workspaceMatch =
      path.match(/^\/workspaces\/(\d+)/);

    if (workspaceMatch) {

      const workspaceId =
        Number(workspaceMatch[1]);

      const workspace =
        this.snapshot.workspaces
          .find(item =>
            item.id === workspaceId
          );

      if (
        workspace &&
        !this.matchesActiveRole(
          workspace.currentUserRole
        )
      ) {

        return false;
      }

      if (path.includes('/tasks')) {
        return (
          mode === 'owner' ||
          mode === 'manager' ||
          mode === 'member'
        );
      }
    }

    if (
      path === '/workspaces' ||
      path === '/workspaces/'
    ) {

      return this.isFreeUser;
    }

    if (
      path === '/team' ||
      path.startsWith('/team/')
    ) {

      return mode === 'owner';
    }

    if (
      path === '/tasks' ||
      path.startsWith('/tasks/')
    ) {

      return (
        mode === 'owner' ||
        mode === 'manager' ||
        mode === 'member'
      );
    }

    return true;
  }


  get showAdminNav():
    boolean {

    return this.isSystemAdmin;
  }


  get showOwnerNav():
    boolean {

    return this.activeRoleMode === 'owner';
  }


  get showPmNav():
    boolean {

    return this.activeRoleMode === 'manager';
  }


  get showMemberNav():
    boolean {

    return this.activeRoleMode === 'member';
  }


  get showProjectsNav():
    boolean {

    return (
      this.showOwnerNav ||
      this.showPmNav ||
      this.showMemberNav
    );
  }


  get showTasksNav():
    boolean {

    return (
      this.showOwnerNav ||
      this.showPmNav ||
      this.showMemberNav
    );
  }


  get showTeamNav():
    boolean {

    return this.showOwnerNav;
  }


  get showActivityNav():
    boolean {

    return (
      this.showAdminNav ||
      this.showOwnerNav ||
      this.showPmNav ||
      this.showMemberNav
    );
  }


  get showWorkspacesNav():
    boolean {

    return (
      this.isSystemAdmin ||
      this.isFreeUser
    );
  }


  refresh():
    Observable<AccessSnapshot> {

    return forkJoin({

      profile:
        this.auth.getProfile()
          .pipe(
            catchError(() =>
              of<AccountProfileResponse | null>(
                null
              )
            )
          ),

      workspaces:
        this.workspacesService.getAll()
          .pipe(
            catchError(() =>
              of<Workspace[]>(
                []
              )
            )
          )

    })
      .pipe(

        map(result => ({

          profile:
            result.profile,

          workspaces:
            result.workspaces,

          loaded:
            true

        })),

        tap(snapshot => {

          this.snapshot =
            snapshot;

          this.alignStoredWorkspace();
        })

      );
  }


  roleIn(
    workspaceId: number
  ): string {

    if (this.isSystemAdmin) {
      return 'SystemAdmin';
    }

    return (
      this.snapshot.workspaces
        .find(workspace =>
          workspace.id ===
            workspaceId
        )
        ?.currentUserRole
      ?? ''
    );
  }


  canManageWorkspace(
    workspaceId: number
  ): boolean {

    return isOwnerRole(
      this.roleIn(
        workspaceId
      )
    );
  }


  canManageProjects(
    workspaceId: number
  ): boolean {

    return this.canManageWorkspace(
      workspaceId
    );
  }


  canManageTasks(
    workspaceId: number
  ): boolean {

    return isManagerRole(
      this.roleIn(
        workspaceId
      )
    );
  }


  canViewTeam(
    workspaceId: number
  ): boolean {

    const role =
      this.roleIn(
        workspaceId
      );

    return (
      isOwnerRole(role) ||
      isManagerRole(role)
    );
  }


  canSendNotifications(
    workspaceId?:
      number | null
  ): boolean {

    if (this.isSystemAdmin) {
      return true;
    }

    if (!workspaceId) {
      return (
        this.showOwnerNav ||
        this.showPmNav
      );
    }

    const role =
      this.roleIn(
        workspaceId
      );

    return (
      isOwnerRole(role) ||
      isManagerRole(role)
    );
  }


  private alignStoredWorkspace():
    void {

    const scoped =
      this.scopedWorkspaces;

    const currentId =
      Number(
        localStorage.getItem(
          'taskmanagement_selected_workspace_id'
        )
        ??
        localStorage.getItem(
          'taskmanagement_workspace_id'
        )
        ??
        0
      );

    if (
      scoped.some(workspace =>
        workspace.id === currentId
      )
    ) {

      return;
    }

    const first =
      scoped[0];

    if (!first) {

      localStorage.removeItem(
        'taskmanagement_workspace_id'
      );

      localStorage.removeItem(
        'taskmanagement_selected_workspace_id'
      );

      localStorage.removeItem(
        'taskmanagement_workspace_name'
      );

      localStorage.removeItem(
        'taskmanagement_selected_workspace_name'
      );

      localStorage.removeItem(
        'taskmanagement_project_id'
      );

      localStorage.removeItem(
        'taskmanagement_selected_project_id'
      );

      localStorage.removeItem(
        'taskmanagement_project_name'
      );

      return;
    }

    localStorage.setItem(
      'taskmanagement_workspace_id',
      String(first.id)
    );

    localStorage.setItem(
      'taskmanagement_selected_workspace_id',
      String(first.id)
    );

    localStorage.setItem(
      'taskmanagement_workspace_name',
      first.name
    );

    localStorage.setItem(
      'taskmanagement_selected_workspace_name',
      first.name
    );

    localStorage.removeItem(
      'taskmanagement_project_id'
    );

    localStorage.removeItem(
      'taskmanagement_selected_project_id'
    );

    localStorage.removeItem(
      'taskmanagement_project_name'
    );
  }
}
