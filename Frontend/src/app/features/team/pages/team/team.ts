import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  forkJoin
} from 'rxjs';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';

import {
  WorkspaceMember,
  WorkspaceMemberCandidate,
  WorkspaceMembers,
  WorkspaceRoleOption
} from '../../../../core/services/workspace-members';

import {
  WorkspaceInvitation,
  WorkspaceInvitations
} from '../../../../core/services/workspace-invitations';

import {
  UserPermissionItem,
  UserPermissions
} from '../../../../core/services/user-permissions';

import {
  TokenStorage
} from '../../../../core/services/token-storage';

import {
  Router
} from '@angular/router';

import {
  WorkspaceAccess
} from '../../../../core/services/workspace-access';


@Component({
  selector: 'app-team-page',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './team.html',

  styleUrl:
    './team.scss'
})
export class TeamPage
  implements OnInit {

  private readonly fb =
    inject(FormBuilder);


  private readonly workspacesService =
    inject(Workspaces);


  private readonly membersService =
    inject(WorkspaceMembers);


  private readonly invitationsService =
    inject(WorkspaceInvitations);


  private readonly userPermissionsService =
    inject(UserPermissions);


  private readonly tokenStorage =
    inject(TokenStorage);


  private readonly router =
    inject(Router);


  private readonly access =
    inject(WorkspaceAccess);


  readonly currentUser =
    this.tokenStorage.getUser();


  workspaces:
    Workspace[] = [];


  members:
    WorkspaceMember[] = [];


  roles:
    WorkspaceRoleOption[] = [];


  candidates:
    WorkspaceMemberCandidate[] = [];


  pendingInvitations:
    WorkspaceInvitation[] = [];


  selectedWorkspace:
    Workspace | null =
      null;


  loadingWorkspaces =
    true;


  loadingMembers =
    false;


  loadingInvitations =
    false;


  leavingWorkspace =
    false;


  errorMessage =
    '';


  successMessage =
    '';


  search =
    '';


  /* =========================================================
     USER PERMISSION OVERRIDES
     ========================================================= */

  permissionsOpen =
    false;


  permissionsMember:
    WorkspaceMember | null =
      null;


  userPermissions:
    UserPermissionItem[] = [];


  loadingUserPermissions =
    false;


  savingPermissionId:
    number | null =
      null;


  permissionReasons:
    Record<number, string> =
      {};


  /* =========================================================
     ADD MEMBER / INVITATION
     ========================================================= */

  addMemberOpen =
    false;


  addingMember =
    false;


  cancelingInvitationId:
    number | null =
      null;


  readonly addMemberForm =
    this.fb.nonNullable.group({

      userId: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ],

      roleId: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ]

    });


  /* =========================================================
     MEMBER ACTIONS
     ========================================================= */

  changingRoleMemberId:
    number | null =
      null;


  removingMemberId:
    number | null =
      null;


  /* =========================================================
     OWNERSHIP TRANSFER
     ========================================================= */

  transferOwnershipOpen =
    false;


  transferringOwnership =
    false;


  readonly transferOwnershipForm =
    this.fb.nonNullable.group({

      newOwnerUserId: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ],

      confirmExit: [
        false,
        [
          Validators.requiredTrue
        ]
      ]

    });


  ngOnInit(): void {

    this.access
      .refresh()
      .subscribe({

        next: () => {

          if (!this.access.showTeamNav) {

            this.router.navigateByUrl(
              '/dashboard'
            );

            return;
          }

          this.loadWorkspaces();
        },

        error: () => {

          this.router.navigateByUrl(
            '/dashboard'
          );
        }

      });
  }


  /* =========================================================
     WORKSPACES
     ========================================================= */

  loadWorkspaces(
    preferredWorkspaceId?: number
  ): void {

    this.loadingWorkspaces =
      true;

    this.errorMessage =
      '';


    this.workspacesService
      .getAll()
      .subscribe({

        next: workspaces => {

          if (
            this.access.loaded &&
            !this.access.showTeamNav
          ) {

            this.router.navigateByUrl(
              '/dashboard'
            );

            return;
          }

          this.workspaces =
            workspaces.filter(workspace =>
              this.access.matchesActiveRole(
                workspace.currentUserRole
              )
            );


          this.loadingWorkspaces =
            false;


          const storedId =
            preferredWorkspaceId
            ??
            this.readStoredWorkspaceId();


          const preferred =
            workspaces.find(
              workspace =>
                workspace.id ===
                storedId
            )
            ??
            workspaces[0]
            ??
            null;


          if (preferred) {

            this.selectWorkspace(
              preferred.id,
              false
            );

          } else {

            this.selectedWorkspace =
              null;

            this.members =
              [];

            this.roles =
              [];

            this.candidates =
              [];

            this.pendingInvitations =
              [];
          }
        },


        error: error => {

          this.loadingWorkspaces =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  selectWorkspace(
    workspaceId: number,
    clearMessages = true
  ): void {

    const workspace =
      this.workspaces
        .find(
          item =>
            item.id ===
            workspaceId
        )
      ?? null;


    this.selectedWorkspace =
      workspace;


    this.members =
      [];

    this.roles =
      [];

    this.candidates =
      [];

    this.pendingInvitations =
      [];

    this.closePermissions();

    this.search =
      '';


    if (clearMessages) {

      this.errorMessage =
        '';

      this.successMessage =
        '';
    }


    if (!workspace) {

      return;
    }


    localStorage.setItem(
      'taskmanagement_selected_workspace_id',
      String(
        workspace.id
      )
    );


    localStorage.setItem(
      'taskmanagement_selected_workspace_name',
      workspace.name
    );


    this.loadMembers();
  }


  selectWorkspaceFromValue(
    value: string
  ): void {

    this.selectWorkspace(
      Number(
        value
      )
    );
  }


  private readStoredWorkspaceId():
    number {

    const possibleKeys =
      [
        'taskmanagement_selected_workspace_id',
        'selectedWorkspaceId',
        'workspaceId'
      ];


    for (
      const key
      of possibleKeys
    ) {

      const value =
        Number(
          localStorage.getItem(
            key
          )
        );


      if (
        Number.isFinite(value) &&
        value > 0
      ) {

        return value;
      }
    }


    return 0;
  }


  /* =========================================================
     MEMBERS
     ========================================================= */

  loadMembers(): void {

    if (
      !this.selectedWorkspace
    ) {

      return;
    }


    const workspaceId =
      this.selectedWorkspace.id;


    this.loadingMembers =
      true;

    this.errorMessage =
      '';


    this.membersService
      .getMembers(
        workspaceId
      )
      .subscribe({

        next: members => {

          this.members =
            [...members]
              .sort(
                (a, b) =>
                  this.roleRank(
                    a.roleName
                  )
                  -
                  this.roleRank(
                    b.roleName
                  )
                  ||
                  a.fullName.localeCompare(
                    b.fullName,
                    'ar'
                  )
              );


          this.loadingMembers =
            false;


          if (
            this.canManageMembers
          ) {

            this.loadManagementRoles();

            this.loadWorkspaceInvitations();
          }
        },


        error: error => {

          this.loadingMembers =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  private loadManagementRoles():
    void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers
    ) {

      this.roles =
        [];

      return;
    }


    this.membersService
      .getRoles(
        this.selectedWorkspace.id
      )
      .subscribe({

        next: roles => {

          this.roles =
            roles
              .filter(
                role =>
                  role.name ===
                    'ProjectManager'
                  ||
                  role.name ===
                    'Member'
              )
              .sort(
                (a, b) =>
                  this.roleRank(
                    a.name
                  )
                  -
                  this.roleRank(
                    b.name
                  )
              );
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     WORKSPACE INVITATIONS
     ========================================================= */

  private loadWorkspaceInvitations():
    void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers
    ) {

      this.pendingInvitations =
        [];

      return;
    }


    this.loadingInvitations =
      true;


    this.invitationsService
      .getWorkspaceInvitations(
        this.selectedWorkspace.id
      )
      .subscribe({

        next: invitations => {

          this.pendingInvitations =
            invitations
              .filter(
                invitation =>
                  invitation.status ===
                    'Pending'
              )
              .sort(
                (a, b) =>
                  new Date(
                    b.createdAt
                  ).getTime()
                  -
                  new Date(
                    a.createdAt
                  ).getTime()
              );


          this.loadingInvitations =
            false;
        },


        error: error => {

          this.loadingInvitations =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  cancelInvitation(
    invitation:
      WorkspaceInvitation
  ): void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers ||
      this.cancelingInvitationId !==
        null
    ) {

      return;
    }


    const confirmed =
      window.confirm(
        `هل تريد إلغاء دعوة "${invitation.invitedUserFullName}"؟`
      );


    if (!confirmed) {

      return;
    }


    this.cancelingInvitationId =
      invitation.id;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.invitationsService
      .cancel(
        this.selectedWorkspace.id,
        invitation.id
      )
      .subscribe({

        next: () => {

          this.pendingInvitations =
            this.pendingInvitations
              .filter(
                current =>
                  current.id !==
                    invitation.id
              );


          this.successMessage =
            `تم إلغاء دعوة ${invitation.invitedUserFullName}.`;


          this.cancelingInvitationId =
            null;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.cancelingInvitationId =
            null;
        }

      });
  }


  /* =========================================================
     ACCESS
     ========================================================= */

  get canManageMembers():
    boolean {

    const role =
      this.selectedWorkspace
        ?.currentUserRole;


    return (
      role ===
        'WorkspaceOwner'
      ||
      role ===
        'Owner'
    );
  }


  get isReadOnlyTeam():
    boolean {

    return (
      !!this.selectedWorkspace &&
      !this.canManageMembers
    );
  }


  get assignableRoles():
    WorkspaceRoleOption[] {

    return this.roles
      .filter(role =>
        role.name ===
          'ProjectManager' ||
        role.name ===
          'Member'
      );
  }


  get canLeaveWorkspace():
    boolean {

    return (
      !!this.selectedWorkspace &&
      !this.canManageMembers
    );
  }


  get currentRoleLabel():
    string {

    return this.roleLabel(
      this.selectedWorkspace
        ?.currentUserRole
      ?? ''
    );
  }


  isOwnerMember(
    member: WorkspaceMember
  ): boolean {

    return (
      member.roleName ===
        'WorkspaceOwner'
      ||
      member.roleName ===
        'Owner'
    );
  }


  isCurrentMemberRole(
    member: WorkspaceMember,
    roleId: number
  ): boolean {

    return (
      Number(roleId) ===
        Number(member.roleId)
    );
  }


  /* =========================================================
     USER PERMISSION OVERRIDES
     ========================================================= */

  openPermissions(
    member: WorkspaceMember
  ): void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers ||
      this.isOwnerMember(
        member
      )
    ) {

      return;
    }


    this.permissionsMember =
      member;

    this.permissionsOpen =
      true;

    this.loadingUserPermissions =
      true;

    this.userPermissions =
      [];

    this.permissionReasons =
      {};

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.userPermissionsService
      .getUserPermissions(
        this.selectedWorkspace.id,
        member.userId
      )
      .subscribe({

        next: permissions => {

          this.userPermissions =
            [...permissions]
              .sort(
                (a, b) =>
                  a.module.localeCompare(
                    b.module
                  )
                  ||
                  a.permissionName.localeCompare(
                    b.permissionName
                  )
              );


          const reasons:
            Record<number, string> =
              {};


          for (
            const permission
            of permissions
          ) {

            reasons[
              permission.permissionId
            ] =
              permission.overrideReason
              ?? '';
          }


          this.permissionReasons =
            reasons;

          this.loadingUserPermissions =
            false;
        },


        error: error => {

          this.loadingUserPermissions =
            false;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  closePermissions():
    void {

    if (
      this.savingPermissionId !==
        null
    ) {

      return;
    }


    this.permissionsOpen =
      false;

    this.permissionsMember =
      null;

    this.userPermissions =
      [];

    this.permissionReasons =
      {};
  }


  get permissionModules():
    string[] {

    return [
      ...new Set(
        this.userPermissions.map(
          permission =>
            permission.module
        )
      )
    ];
  }


  permissionsByModule(
    module: string
  ): UserPermissionItem[] {

    return this.userPermissions
      .filter(
        permission =>
          permission.module ===
            module
      );
  }


  permissionReason(
    permissionId: number
  ): string {

    return (
      this.permissionReasons[
        permissionId
      ]
      ?? ''
    );
  }


  setPermissionReason(
    permissionId: number,
    value: string
  ): void {

    this.permissionReasons = {
      ...this.permissionReasons,

      [permissionId]:
        value
    };
  }


  setPermissionOverride(
    permission:
      UserPermissionItem,

    isGranted:
      boolean
  ): void {

    if (
      !this.selectedWorkspace ||
      !this.permissionsMember ||
      !this.canManageMembers ||
      this.savingPermissionId !==
        null
    ) {

      return;
    }


    this.savingPermissionId =
      permission.permissionId;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.userPermissionsService
      .setOverride(
        this.selectedWorkspace.id,
        this.permissionsMember.userId,
        permission.permissionId,
        isGranted,
        this.permissionReason(
          permission.permissionId
        )
      )
      .subscribe({

        next: updated => {

          this.userPermissions =
            this.userPermissions
              .map(
                current =>
                  current.permissionId ===
                    updated.permissionId
                    ? updated
                    : current
              );


          this.permissionReasons = {
            ...this.permissionReasons,

            [updated.permissionId]:
              updated.overrideReason
              ?? ''
          };


          this.successMessage =
            isGranted
              ? `تم منح صلاحية "${updated.permissionName}" للمستخدم ${this.permissionsMember?.fullName}.`
              : `تم منع صلاحية "${updated.permissionName}" عن المستخدم ${this.permissionsMember?.fullName}.`;


          this.savingPermissionId =
            null;
        },


        error: error => {

          this.savingPermissionId =
            null;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  removePermissionOverride(
    permission:
      UserPermissionItem
  ): void {

    if (
      !this.selectedWorkspace ||
      !this.permissionsMember ||
      !this.canManageMembers ||
      permission.overrideGranted ===
        null ||
      this.savingPermissionId !==
        null
    ) {

      return;
    }


    this.savingPermissionId =
      permission.permissionId;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.userPermissionsService
      .removeOverride(
        this.selectedWorkspace.id,
        this.permissionsMember.userId,
        permission.permissionId
      )
      .subscribe({

        next: () => {

          this.savingPermissionId =
            null;


          this.successMessage =
            `تمت إزالة التخصيص عن صلاحية "${permission.permissionName}" والعودة إلى صلاحيات الدور.`;


          this.reloadOpenedPermissions();
        },


        error: error => {

          this.savingPermissionId =
            null;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  private reloadOpenedPermissions():
    void {

    const member =
      this.permissionsMember;


    if (
      !member ||
      !this.selectedWorkspace
    ) {

      return;
    }


    this.loadingUserPermissions =
      true;


    this.userPermissionsService
      .getUserPermissions(
        this.selectedWorkspace.id,
        member.userId
      )
      .subscribe({

        next: permissions => {

          this.userPermissions =
            [...permissions]
              .sort(
                (a, b) =>
                  a.module.localeCompare(
                    b.module
                  )
                  ||
                  a.permissionName.localeCompare(
                    b.permissionName
                  )
              );


          const reasons:
            Record<number, string> =
              {};


          for (
            const permission
            of permissions
          ) {

            reasons[
              permission.permissionId
            ] =
              permission.overrideReason
              ?? '';
          }


          this.permissionReasons =
            reasons;

          this.loadingUserPermissions =
            false;
        },


        error: error => {

          this.loadingUserPermissions =
            false;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  permissionSourceLabel(
    permission:
      UserPermissionItem
  ): string {

    if (
      permission.overrideGranted ===
        true
    ) {

      return 'ممنوحة كتخصيص';
    }


    if (
      permission.overrideGranted ===
        false
    ) {

      return 'ممنوعة كتخصيص';
    }


    return permission.grantedByRole
      ? 'ممنوحة من الدور'
      : 'غير ممنوحة من الدور';
  }


  /* =========================================================
     LEAVE WORKSPACE
     ========================================================= */

  leaveWorkspace():
    void {

    if (
      !this.selectedWorkspace ||
      !this.canLeaveWorkspace ||
      this.leavingWorkspace
    ) {

      return;
    }


    const workspaceName =
      this.selectedWorkspace.name;


    const confirmed =
      window.confirm(
        `هل أنت متأكد من مغادرة مساحة العمل "${workspaceName}"؟\n\nستفقد وصولك إلى مشاريع ومهام مساحة العمل.`
      );


    if (!confirmed) {

      return;
    }


    const workspaceId =
      this.selectedWorkspace.id;


    this.leavingWorkspace =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.workspacesService
      .leave(
        workspaceId
      )
      .subscribe({

        next: () => {

          this.leavingWorkspace =
            false;


          localStorage.removeItem(
            'taskmanagement_selected_workspace_id'
          );

          localStorage.removeItem(
            'taskmanagement_selected_workspace_name'
          );


          this.selectedWorkspace =
            null;

          this.members =
            [];

          this.roles =
            [];

          this.candidates =
            [];

          this.pendingInvitations =
            [];


          this.successMessage =
            `تمت مغادرة مساحة العمل "${workspaceName}" بنجاح.`;


          this.loadWorkspaces();
        },


        error: error => {

          this.leavingWorkspace =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     STATS
     ========================================================= */

  get totalMembers():
    number {

    return this.members.length;
  }


  get ownersCount():
    number {

    return this.members
      .filter(
        member =>
          this.isOwnerMember(
            member
          )
      )
      .length;
  }


  get managersCount():
    number {

    return this.members
      .filter(
        member =>
          member.roleName ===
          'ProjectManager'
      )
      .length;
  }


  get regularMembersCount():
    number {

    return this.members
      .filter(
        member =>
          member.roleName ===
          'Member'
      )
      .length;
  }


  /* =========================================================
     SEARCH
     ========================================================= */

  setSearch(
    value: string
  ): void {

    this.search =
      value;
  }


  get filteredMembers():
    WorkspaceMember[] {

    const query =
      this.normalize(
        this.search
      );


    if (!query) {

      return this.members;
    }


    return this.members
      .filter(
        member => {

          const searchable =
            this.normalize(
              [
                member.fullName,
                member.email,
                member.roleName
              ].join(' ')
            );


          return searchable
            .includes(
              query
            );
        }
      );
  }


  /* =========================================================
     ADD MEMBER / INVITATION
     ========================================================= */

  openAddMember(): void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers
    ) {

      return;
    }


    this.addMemberOpen =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.addMemberForm
      .reset({
        userId: 0,
        roleId: 0
      });


    this.loadAddMemberData();
  }


  closeAddMember(): void {

    if (
      this.addingMember
    ) {

      return;
    }


    this.addMemberOpen =
      false;
  }


  private loadAddMemberData():
    void {

    if (
      !this.selectedWorkspace
    ) {

      return;
    }


    forkJoin({

      roles:
        this.membersService
          .getRoles(
            this.selectedWorkspace.id
          ),

      candidates:
        this.membersService
          .getCandidates(
            this.selectedWorkspace.id
          )

    })
      .subscribe({

        next: result => {

          this.roles =
            result.roles
              .filter(
                role =>
                  role.name ===
                    'ProjectManager'
                  ||
                  role.name ===
                    'Member'
              )
              .sort(
                (a, b) =>
                  this.roleRank(
                    a.name
                  )
                  -
                  this.roleRank(
                    b.name
                  )
              );


          this.candidates =
            result.candidates
              .sort(
                (a, b) =>
                  a.fullName
                    .localeCompare(
                      b.fullName,
                      'ar'
                    )
              );


          const defaultRole =
            this.roles
              .find(
                role =>
                  role.name ===
                  'Member'
              );


          if (defaultRole) {

            this.addMemberForm
              .controls
              .roleId
              .setValue(
                defaultRole.id
              );
          }
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  addMember(): void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers ||
      this.addingMember
    ) {

      return;
    }


    if (
      this.addMemberForm.invalid
    ) {

      this.addMemberForm
        .markAllAsTouched();

      this.errorMessage =
        'راجع بيانات إضافة العضو وحدد المستخدم والدور.';

      return;
    }


    const value =
      this.addMemberForm
        .getRawValue();


    const selectedRole =
      this.roles.find(
        role =>
          role.id ===
          value.roleId
      );


    if (
      !selectedRole ||
      (
        selectedRole.name !==
          'ProjectManager'
        &&
        selectedRole.name !==
          'Member'
      )
    ) {

      this.errorMessage =
        'الدور المحدد غير مسموح به لإدارة أعضاء مساحة العمل.';

      return;
    }


    this.addingMember =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.invitationsService
      .create(
        this.selectedWorkspace.id,
        value.userId,
        value.roleId
      )
      .subscribe({

        next: result => {

          this.addingMember =
            false;

          this.addMemberOpen =
            false;


          if (
            result.addedDirectly &&
            result.member
          ) {

            this.successMessage =
              result.message
              ||
              `تمت إضافة ${result.member.fullName} إلى مساحة العمل بنجاح.`;


            this.loadMembers();

            return;
          }


          if (
            result.invitation
          ) {

            this.successMessage =
              result.message
              ||
              `تم إرسال دعوة إلى ${result.invitation.invitedUserFullName}.`;


            this.loadWorkspaceInvitations();

            return;
          }


          this.successMessage =
            result.message
            ||
            'تم تنفيذ العملية بنجاح.';


          this.loadMembers();
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.addingMember =
            false;
        }

      });
  }


  /* =========================================================
     CHANGE ROLE
     ========================================================= */

  changeRole(
    member: WorkspaceMember,
    roleIdValue: string
  ): void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers ||
      this.isOwnerMember(member) ||
      this.changingRoleMemberId !==
        null
    ) {

      return;
    }


    const roleId =
      Number(
        roleIdValue
      );


    const selectedRole =
      this.roles.find(
        role =>
          role.id ===
          roleId
      );


    if (
      !roleId ||
      roleId ===
        member.roleId
    ) {

      return;
    }


    if (
      !selectedRole ||
      (
        selectedRole.name !==
          'ProjectManager'
        &&
        selectedRole.name !==
          'Member'
      )
    ) {

      this.errorMessage =
        'لا يمكن تعيين دور مالك مساحة العمل من إدارة الأعضاء.';

      this.loadMembers();

      return;
    }


    this.changingRoleMemberId =
      member.id;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.membersService
      .updateMemberRole(
        this.selectedWorkspace.id,
        member.id,
        roleId
      )
      .subscribe({

        next: updated => {

          this.members =
            this.members.map(
              current =>
                current.id ===
                  updated.id
                  ? updated
                  : current
            );


          this.successMessage =
            `تم تغيير دور ${updated.fullName} إلى ${this.roleLabel(updated.roleName)}.`;


          this.changingRoleMemberId =
            null;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.changingRoleMemberId =
            null;


          this.loadMembers();
        }

      });
  }


  /* =========================================================
     REMOVE MEMBER
     ========================================================= */

  removeMember(
    member: WorkspaceMember
  ): void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers ||
      this.isOwnerMember(member) ||
      this.removingMemberId !==
        null
    ) {

      return;
    }


    const confirmed =
      window.confirm(
        `هل تريد إزالة "${member.fullName}" من مساحة العمل؟`
      );


    if (!confirmed) {

      return;
    }


    this.removingMemberId =
      member.id;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.membersService
      .removeMember(
        this.selectedWorkspace.id,
        member.id
      )
      .subscribe({

        next: () => {

          this.members =
            this.members
              .filter(
                current =>
                  current.id !==
                  member.id
              );


          this.successMessage =
            `تمت إزالة ${member.fullName} من مساحة العمل.`;


          this.removingMemberId =
            null;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.removingMemberId =
            null;
        }

      });
  }


  /* =========================================================
     TRANSFER OWNERSHIP
     ========================================================= */

  get ownershipTransferCandidates():
    WorkspaceMember[] {

    return this.members
      .filter(
        member =>
          !this.isOwnerMember(
            member
          )
          &&
          member.status ===
            'Active'
      )
      .sort(
        (a, b) =>
          a.fullName.localeCompare(
            b.fullName,
            'ar'
          )
      );
  }


  openTransferOwnership():
    void {

    this.transferOwnershipOpen =
      false;


    this.errorMessage =
      'مالك مساحة العمل لا ينقل الملكية بنفسه. يقوم مسؤول النظام بتعيين مالك جديد.';
  }


  closeTransferOwnership():
    void {

    if (
      this.transferringOwnership
    ) {

      return;
    }


    this.transferOwnershipOpen =
      false;
  }


  transferOwnership():
    void {

    if (
      !this.selectedWorkspace ||
      !this.canManageMembers ||
      this.transferringOwnership
    ) {

      return;
    }


    if (
      this.transferOwnershipForm.invalid
    ) {

      this.transferOwnershipForm
        .markAllAsTouched();


      this.errorMessage =
        'اختر المالك الجديد وأكد أنك تعلم بأنك ستخرج من مساحة العمل بعد نقل الملكية.';

      return;
    }


    const value =
      this.transferOwnershipForm
        .getRawValue();


    const newOwner =
      this.ownershipTransferCandidates
        .find(
          member =>
            member.userId ===
            value.newOwnerUserId
        );


    if (!newOwner) {

      this.errorMessage =
        'المستخدم المحدد غير صالح لنقل الملكية.';

      return;
    }


    const confirmed =
      window.confirm(
        `تأكيد نقل ملكية "${this.selectedWorkspace.name}" إلى "${newOwner.fullName}"؟\n\nبعد نجاح العملية ستخرج أنت نهائيًا من مساحة العمل.`
      );


    if (!confirmed) {

      return;
    }


    const transferredWorkspaceId =
      this.selectedWorkspace.id;


    this.transferringOwnership =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.workspacesService
      .transferOwnership(
        transferredWorkspaceId,
        newOwner.userId
      )
      .subscribe({

        next: () => {

          this.transferringOwnership =
            false;

          this.transferOwnershipOpen =
            false;


          localStorage.removeItem(
            'taskmanagement_selected_workspace_id'
          );

          localStorage.removeItem(
            'taskmanagement_selected_workspace_name'
          );


          this.selectedWorkspace =
            null;

          this.members =
            [];

          this.roles =
            [];

          this.candidates =
            [];

          this.pendingInvitations =
            [];


          this.successMessage =
            `تم نقل ملكية مساحة العمل إلى ${newOwner.fullName} بنجاح، وتم خروجك من المساحة.`;


          this.loadWorkspaces();
        },


        error: error => {

          this.transferringOwnership =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     DISPLAY
     ========================================================= */

  initial(
    member:
      WorkspaceMember
  ): string {

    return (
      member.fullName
        ?.trim()
        .charAt(0)
        .toUpperCase()
      ||
      'U'
    );
  }


  roleLabel(
    roleName: string
  ): string {

    switch (
      roleName
    ) {

      case 'WorkspaceOwner':
      case 'Owner':
        return 'مالك مساحة العمل';

      case 'ProjectManager':
        return 'مدير مشروع';

      case 'Member':
        return 'عضو';

      case 'SystemAdmin':
      case 'Admin':
        return 'مسؤول النظام';

      default:
        return roleName || 'مستخدم';
    }
  }


  roleClass(
    roleName: string
  ): string {

    switch (
      roleName
    ) {

      case 'WorkspaceOwner':
      case 'Owner':
        return 'owner';

      case 'ProjectManager':
        return 'manager';

      default:
        return 'member';
    }
  }


  formatDate(
    value: string
  ): string {

    if (!value) {

      return '—';
    }


    return new Date(
      value
    )
      .toLocaleDateString(
        'ar-SY',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric'
        }
      );
  }


  /* =========================================================
     HELPERS
     ========================================================= */

  private roleRank(
    roleName: string
  ): number {

    switch (
      roleName
    ) {

      case 'WorkspaceOwner':
      case 'Owner':
        return 1;

      case 'ProjectManager':
        return 2;

      case 'Member':
        return 3;

      default:
        return 4;
    }
  }


  private normalize(
    value: string
  ): string {

    return value
      .toLowerCase()
      .replace(
        /[أإآ]/g,
        'ا'
      )
      .replace(
        /ى/g,
        'ي'
      )
      .replace(
        /ة/g,
        'ه'
      )
      .trim();
  }


  private extractApiError(
    error: any
  ): string {

    const errors =
      error?.error?.errors;


    if (
      errors &&
      typeof errors ===
        'object'
    ) {

      const messages =
        Object.values(
          errors
        )
          .flatMap(
            value =>
              Array.isArray(
                value
              )
                ? value
                : [value]
          )
          .filter(Boolean)
          .map(String);


      if (
        messages.length >
        0
      ) {

        return messages
          .join(
            ' '
          );
      }
    }


    const detail =
      error?.error?.detail
      ??
      error?.error?.message
      ??
      error?.error?.title;


    if (
      typeof detail ===
      'string'
    ) {

      if (
        detail.includes(
          'Only workspace owner'
        )
      ) {

        return 'إدارة أعضاء مساحة العمل متاحة لمالك المساحة فقط.';
      }


      if (
        detail.includes(
          'already a member'
        )
      ) {

        return 'هذا المستخدم عضو في مساحة العمل مسبقًا.';
      }


      if (
        detail.includes(
          'already has a pending invitation'
        )
      ) {

        return 'يوجد بالفعل دعوة معلقة لهذا المستخدم ضمن مساحة العمل.';
      }


      if (
        detail.includes(
          'Workspace owner cannot leave directly'
        )
      ) {

        return 'مالك مساحة العمل لا يستطيع المغادرة مباشرة. يقوم مسؤول النظام بتعيين مالك جديد.';
      }


      if (
        detail.includes(
          'unfinished assigned tasks'
        )
      ) {

        return 'لا يمكنك مغادرة مساحة العمل لأن لديك مهامًا غير منتهية مسندة إليك. أكملها أو ألغها أولًا.';
      }


      if (
        detail.includes(
          'You are not an active member'
        )
      ) {

        return 'لم تعد عضوًا فعالًا في مساحة العمل.';
      }


      if (
        detail.includes(
          'more than one active workspace'
        )
        ||
        detail.includes(
          'already owns another active workspace'
        )
      ) {

        return 'لا يمكن نقل الملكية لهذا المستخدم لأنه يملك مساحة عمل أخرى بالفعل.';
      }


      if (
        detail.includes(
          'owner cannot be assigned through member management'
        )
      ) {

        return 'لا يمكن تعيين مالك مساحة العمل من إدارة الأعضاء. يقوم مسؤول النظام بتعيين المالك.';
      }


      if (
        detail.includes(
          'owner role cannot be changed'
        )
      ) {

        return 'لا يمكن تغيير دور مالك مساحة العمل من إدارة الأعضاء.';
      }


      if (
        detail.includes(
          'owner cannot be removed directly'
        )
      ) {

        return 'لا يمكن إزالة مالك مساحة العمل مباشرة. يجب أن يعيّن مسؤول النظام مالكًا جديدًا أولًا.';
      }


      if (
        detail.includes(
          'must be an active member'
        )
      ) {

        return 'يجب أن يكون المالك الجديد عضوًا فعالًا في مساحة العمل أولًا.';
      }


      if (
        detail.includes(
          'already the workspace owner'
        )
      ) {

        return 'هذا المستخدم هو مالك مساحة العمل بالفعل.';
      }


      if (
        detail.includes(
          'ownership state is invalid'
        )
      ) {

        return 'حالة ملكية مساحة العمل غير صحيحة. يجب أن يكون لها مالك فعال واحد فقط.';
      }


      return detail;
    }


    return 'تعذر تنفيذ العملية.';
  }
}