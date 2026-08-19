import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  forkJoin
} from 'rxjs';

import {
  PermissionItem,
  RoleItem,
  RolesPermissions
} from '../../../../core/services/roles-permissions';


@Component({
  selector:
    'app-roles-permissions',

  imports: [
    FormsModule
  ],

  templateUrl:
    './roles-permissions.html',

  styleUrl:
    './roles-permissions.scss'
})
export class RolesPermissionsPage
  implements OnInit {

  private readonly service =
    inject(RolesPermissions);


  roles:
    RoleItem[] = [];


  permissions:
    PermissionItem[] = [];


  selectedRole:
    RoleItem | null = null;


  selectedPermissionIds =
    new Set<number>();


  loading =
    true;


  roleLoading =
    false;


  saving =
    false;


  errorMessage =
    '';


  successMessage =
    '';


  showRoleForm =
    false;


  editingRole:
    RoleItem | null = null;


  roleName =
    '';


  roleDescription =
    '';


  ngOnInit(): void {

    this.loadData();
  }


  loadData(): void {

    this.loading =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    forkJoin({

      roles:
        this.service.getRoles(),

      permissions:
        this.service.getPermissions()

    })
      .subscribe({

        next: result => {

          this.roles =
            result.roles;

          this.permissions =
            result.permissions;

          this.loading =
            false;


          if (
            this.roles.length > 0
          ) {

            const selected =
              this.selectedRole
                ? this.roles.find(
                    role =>
                      role.id ===
                      this.selectedRole?.id
                  )
                : this.roles[0];


            if (selected) {

              this.selectRole(
                selected
              );
            }
          }
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );

          this.loading =
            false;
        }

      });
  }


  selectRole(
    role: RoleItem
  ): void {

    this.selectedRole =
      role;

    this.roleLoading =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.service
      .getRolePermissions(
        role.id
      )
      .subscribe({

        next: result => {

          this.selectedPermissionIds =
            new Set(
              result.permissions.map(
                permission =>
                  permission.id
              )
            );

          this.roleLoading =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );

          this.roleLoading =
            false;
        }

      });
  }


  permissionChecked(
    permissionId: number
  ): boolean {

    return this.selectedPermissionIds
      .has(
        permissionId
      );
  }


  togglePermission(
    permissionId: number
  ): void {

    if (
      !this.selectedRole ||
      this.selectedRole.isSystemRole
    ) {

      return;
    }


    const updated =
      new Set(
        this.selectedPermissionIds
      );


    if (
      updated.has(
        permissionId
      )
    ) {

      updated.delete(
        permissionId
      );
    }
    else {

      updated.add(
        permissionId
      );
    }


    this.selectedPermissionIds =
      updated;
  }


  savePermissions(): void {

    if (
      !this.selectedRole ||
      this.selectedRole.isSystemRole
    ) {

      return;
    }


    this.saving =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.service
      .updateRolePermissions(
        this.selectedRole.id,
        [
          ...this.selectedPermissionIds
        ]
      )
      .subscribe({

        next: result => {

          this.selectedPermissionIds =
            new Set(
              result.permissions.map(
                permission =>
                  permission.id
              )
            );


          this.roles =
            this.roles.map(
              role =>
                role.id ===
                  this.selectedRole?.id
                  ? {
                      ...role,
                      permissionCount:
                        result.permissions.length
                    }
                  : role
            );


          this.selectedRole =
            this.roles.find(
              role =>
                role.id ===
                  result.roleId
            )
            ?? this.selectedRole;


          this.successMessage =
            'تم تحديث صلاحيات الدور بنجاح.';

          this.saving =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );

          this.saving =
            false;
        }

      });
  }


  openCreateRole(): void {

    this.editingRole =
      null;

    this.roleName =
      '';

    this.roleDescription =
      '';

    this.showRoleForm =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';
  }


  openEditRole(
    role: RoleItem
  ): void {

    if (
      role.isSystemRole
    ) {

      return;
    }


    this.editingRole =
      role;

    this.roleName =
      role.name;

    this.roleDescription =
      role.description ?? '';

    this.showRoleForm =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';
  }


  closeRoleForm(): void {

    if (
      this.saving
    ) {

      return;
    }


    this.showRoleForm =
      false;

    this.editingRole =
      null;
  }


  saveRole(): void {

    const name =
      this.roleName.trim();


    if (
      name.length < 2
    ) {

      this.errorMessage =
        'اسم الدور يجب أن يحتوي حرفين على الأقل.';

      return;
    }


    this.saving =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    if (
      this.editingRole
    ) {

      this.service
        .updateRole(
          this.editingRole.id,
          {
            name,
            description:
              this.cleanDescription(
                this.roleDescription
              )
          }
        )
        .subscribe({

          next: updatedRole => {

            this.roles =
              this.roles.map(
                role =>
                  role.id ===
                    updatedRole.id
                    ? updatedRole
                    : role
              );


            if (
              this.selectedRole?.id ===
              updatedRole.id
            ) {

              this.selectedRole =
                updatedRole;
            }


            this.showRoleForm =
              false;

            this.editingRole =
              null;

            this.successMessage =
              'تم تعديل الدور بنجاح.';

            this.saving =
              false;
          },


          error: error => {

            this.errorMessage =
              this.extractApiError(
                error
              );

            this.saving =
              false;
          }

        });


      return;
    }


    this.service
      .createRole(
        {
          name,
          description:
            this.cleanDescription(
              this.roleDescription
            ),
          permissionIds: []
        }
      )
      .subscribe({

        next: createdRole => {

          this.roles = [
            ...this.roles,
            createdRole
          ];


          this.showRoleForm =
            false;

          this.successMessage =
            'تم إنشاء الدور بنجاح.';

          this.saving =
            false;


          this.selectRole(
            createdRole
          );
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );

          this.saving =
            false;
        }

      });
  }


  deleteRole(
    role: RoleItem
  ): void {

    if (
      role.isSystemRole
    ) {

      return;
    }


    const confirmed =
      confirm(
        `هل أنت متأكد من حذف الدور "${role.name}"؟`
      );


    if (
      !confirmed
    ) {

      return;
    }


    this.saving =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.service
      .deleteRole(
        role.id
      )
      .subscribe({

        next: () => {

          this.roles =
            this.roles.filter(
              current =>
                current.id !==
                  role.id
            );


          if (
            this.selectedRole?.id ===
            role.id
          ) {

            this.selectedRole =
              null;

            this.selectedPermissionIds =
              new Set<number>();


            const firstRole =
              this.roles[0];


            if (
              firstRole
            ) {

              this.selectRole(
                firstRole
              );
            }
          }


          this.successMessage =
            'تم حذف الدور بنجاح.';

          this.saving =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );

          this.saving =
            false;
        }

      });
  }


  permissionsByModule(
    module: string
  ): PermissionItem[] {

    return this.permissions.filter(
      permission =>
        permission.module ===
          module
    );
  }


  get modules():
    string[] {

    return [
      ...new Set(
        this.permissions.map(
          permission =>
            permission.module
        )
      )
    ];
  }


  roleTypeLabel(
    role: RoleItem
  ): string {

    return role.isSystemRole
      ? 'دور نظام'
      : 'دور مخصص';
  }


  private cleanDescription(
    value: string
  ): string | null {

    const description =
      value.trim();


    return description.length > 0
      ? description
      : null;
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
          '\n'
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