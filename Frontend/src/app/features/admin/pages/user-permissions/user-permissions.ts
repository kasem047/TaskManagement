import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';

import {
  WorkspaceMember,
  WorkspaceMembers
} from '../../../../core/services/workspace-members';

import {
  UserPermissionItem,
  UserPermissions
} from '../../../../core/services/user-permissions';


@Component({
  selector:
    'app-user-permissions',

  imports: [
    FormsModule
  ],

  templateUrl:
    './user-permissions.html',

  styleUrl:
    './user-permissions.scss'
})
export class UserPermissionsPage
  implements OnInit {

  private readonly workspacesService =
    inject(Workspaces);


  private readonly membersService =
    inject(WorkspaceMembers);


  private readonly permissionsService =
    inject(UserPermissions);


  workspaces:
    Workspace[] = [];


  members:
    WorkspaceMember[] = [];


  permissions:
    UserPermissionItem[] = [];


  selectedWorkspaceId =
    0;


  selectedUserId =
    0;


  loadingWorkspaces =
    true;


  loadingMembers =
    false;


  loadingPermissions =
    false;


  updatingPermissionId:
    number | null =
      null;


  errorMessage =
    '';


  successMessage =
    '';


  permissionReasons:
    Record<number, string> =
      {};


  ngOnInit(): void {

    this.loadWorkspaces();
  }


  /* =========================================================
     WORKSPACES
     ========================================================= */

  loadWorkspaces(): void {

    this.loadingWorkspaces =
      true;

    this.errorMessage =
      '';


    this.workspacesService
      .getAll()
      .subscribe({

        next: workspaces => {

          this.workspaces =
            [...workspaces]
              .sort(
                (a, b) =>
                  a.name.localeCompare(
                    b.name,
                    'ar'
                  )
              );


          this.loadingWorkspaces =
            false;


          if (
            this.workspaces.length > 0
          ) {

            this.selectedWorkspaceId =
              this.workspaces[0].id;


            this.loadMembers();
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


  workspaceChanged(): void {

    this.selectedUserId =
      0;

    this.members =
      [];

    this.permissions =
      [];

    this.permissionReasons =
      {};

    this.errorMessage =
      '';

    this.successMessage =
      '';


    if (
      this.selectedWorkspaceId > 0
    ) {

      this.loadMembers();
    }
  }


  /* =========================================================
     MEMBERS
     ========================================================= */

  loadMembers(): void {

    if (
      this.selectedWorkspaceId <= 0
    ) {

      return;
    }


    this.loadingMembers =
      true;

    this.errorMessage =
      '';


    this.membersService
      .getMembers(
        this.selectedWorkspaceId
      )
      .subscribe({

        next: members => {

          this.members =
            members
              .filter(
                member =>
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


          this.loadingMembers =
            false;


          if (
            this.members.length > 0
          ) {

            this.selectedUserId =
              this.members[0].userId;


            this.loadPermissions();
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


  memberChanged(): void {

    this.permissions =
      [];

    this.permissionReasons =
      {};

    this.errorMessage =
      '';

    this.successMessage =
      '';


    if (
      this.selectedUserId > 0
    ) {

      this.loadPermissions();
    }
  }


  /* =========================================================
     PERMISSIONS
     ========================================================= */

  loadPermissions(): void {

    if (
      this.selectedWorkspaceId <= 0 ||
      this.selectedUserId <= 0
    ) {

      return;
    }


    this.loadingPermissions =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.permissionsService
      .getUserPermissions(
        this.selectedWorkspaceId,
        this.selectedUserId
      )
      .subscribe({

        next: permissions => {

          this.permissions =
            permissions;


          this.permissionReasons =
            {};


          for (
            const permission
            of permissions
          ) {

            this.permissionReasons[
              permission.permissionId
            ] =
              permission.overrideReason
              ?? '';
          }


          this.loadingPermissions =
            false;
        },


        error: error => {

          this.loadingPermissions =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  grantOverride(
    permission:
      UserPermissionItem
  ): void {

    this.setOverride(
      permission,
      true
    );
  }


  denyOverride(
    permission:
      UserPermissionItem
  ): void {

    this.setOverride(
      permission,
      false
    );
  }


  private setOverride(
    permission:
      UserPermissionItem,

    isGranted:
      boolean
  ): void {

    if (
      this.selectedWorkspaceId <= 0 ||
      this.selectedUserId <= 0 ||
      this.updatingPermissionId !==
        null
    ) {

      return;
    }


    this.updatingPermissionId =
      permission.permissionId;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.permissionsService
      .setOverride(
        this.selectedWorkspaceId,
        this.selectedUserId,
        permission.permissionId,
        isGranted,
        this.permissionReasons[
          permission.permissionId
        ]
        ?? null
      )
      .subscribe({

        next: updated => {

          this.permissions =
            this.permissions
              .map(
                current =>
                  current.permissionId ===
                    updated.permissionId
                    ? updated
                    : current
              );


          this.permissionReasons[
            updated.permissionId
          ] =
            updated.overrideReason
            ?? '';


          this.updatingPermissionId =
            null;


          this.successMessage =
            isGranted
              ? `تم منح الصلاحية "${updated.permissionName}" للمستخدم.`
              : `تم منع الصلاحية "${updated.permissionName}" عن المستخدم.`;
        },


        error: error => {

          this.updatingPermissionId =
            null;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  removeOverride(
    permission:
      UserPermissionItem
  ): void {

    if (
      this.selectedWorkspaceId <= 0 ||
      this.selectedUserId <= 0 ||
      permission.overrideGranted ===
        null ||
      this.updatingPermissionId !==
        null
    ) {

      return;
    }


    this.updatingPermissionId =
      permission.permissionId;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.permissionsService
      .removeOverride(
        this.selectedWorkspaceId,
        this.selectedUserId,
        permission.permissionId
      )
      .subscribe({

        next: () => {

          this.updatingPermissionId =
            null;


          this.successMessage =
            `تمت إزالة الاستثناء عن الصلاحية "${permission.permissionName}".`;


          this.loadPermissions();
        },


        error: error => {

          this.updatingPermissionId =
            null;


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

  get selectedMember():
    WorkspaceMember | null {

    return (
      this.members.find(
        member =>
          member.userId ===
            this.selectedUserId
      )
      ?? null
    );
  }


  get modules():
    string[] {

    return [
      ...new Set(
        this.permissions
          .map(
            permission =>
              permission.module
          )
      )
    ];
  }


  permissionsByModule(
    module:
      string
  ): UserPermissionItem[] {

    return this.permissions
      .filter(
        permission =>
          permission.module ===
            module
      );
  }


  roleLabel(
    roleName:
      string
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

      default:
        return roleName;
    }
  }


  permissionStateLabel(
    permission:
      UserPermissionItem
  ): string {

    if (
      permission.overrideGranted ===
        true
    ) {

      return 'سماح استثنائي';
    }


    if (
      permission.overrideGranted ===
        false
    ) {

      return 'منع استثنائي';
    }


    return permission.grantedByRole
      ? 'مسموحة عبر الدور'
      : 'غير مسموحة عبر الدور';
  }


  effectiveStateLabel(
    permission:
      UserPermissionItem
  ): string {

    return permission.effectiveGranted
      ? 'مسموح'
      : 'ممنوع';
  }


  private extractApiError(
    error:
      any
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
              Array.isArray(value)
                ? value
                : [value]
          )
          .filter(Boolean)
          .map(String);


      if (
        messages.length > 0
      ) {

        return messages.join(
          ' '
        );
      }
    }


    return (
      error?.error?.detail
      ??
      error?.error?.message
      ??
      error?.error?.title
      ??
      'تعذر تنفيذ العملية.'
    );
  }
}