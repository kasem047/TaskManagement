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
  forkJoin,
  of
} from 'rxjs';

import {
  catchError,
  map,
  switchMap
} from 'rxjs/operators';

import {
  AdminUser,
  AdminUsers
} from '../../../../core/services/admin-users';

import {
  Project,
  ProjectMember,
  Projects
} from '../../../../core/services/projects';

import {
  WorkspaceMember,
  WorkspaceMembers
} from '../../../../core/services/workspace-members';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';


interface RoleInfo {
  role: string;
  description: string;
}


interface UserAssignment {
  roles: Set<string>;
  ownedWorkspaces: string[];
  managedProjects: {
    projectName: string;
    workspaceName: string;
  }[];
  memberWorkspaces: string[];
  memberProjects: {
    projectName: string;
    workspaceName: string;
  }[];
}


@Component({
  selector:
    'app-admin-users',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './admin-users.html',

  styleUrl:
    './admin-users.scss'
})
export class AdminUsersPage
  implements OnInit {

  private readonly fb =
    inject(FormBuilder);


  private readonly adminUsers =
    inject(AdminUsers);

  private readonly workspacesApi =
    inject(Workspaces);

  private readonly workspaceMembersApi =
    inject(WorkspaceMembers);

  private readonly projectsApi =
    inject(Projects);


  users:
    AdminUser[] = [];


  selectedUser:
    AdminUser | null =
      null;


  loading =
    false;


  createOpen =
    false;


  creating =
    false;


  updatingUserId:
    number | null =
      null;


  errorMessage =
    '';


  successMessage =
    '';


  readonly filterForm =
    this.fb.nonNullable.group({

      search: [
        ''
      ],

      status: [
        'all'
      ]

    });


  readonly createForm =
    this.fb.nonNullable.group({

      fullName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(150)
        ]
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(256)
        ]
      ],

      password: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),
          Validators.pattern(
            /^(?=.*[a-z])(?=.*\d).+$/
          )
        ]
      ],

      confirmPassword: [
        '',
        [
          Validators.required
        ]
      ],

      isActive: [
        true
      ]

    });


  ngOnInit(): void {

    this.loadUsers();
  }


  loadUsers(): void {

    this.loading =
      true;

    this.errorMessage =
      '';


    const filters =
      this.filterForm
        .getRawValue();


    let isActive:
      boolean | null =
        null;


    if (
      filters.status ===
      'active'
    ) {

      isActive =
        true;

    } else if (
      filters.status ===
      'inactive'
    ) {

      isActive =
        false;
    }


    this.adminUsers
      .getUsers(
        filters.search,
        isActive
      )
      .pipe(
        switchMap(users =>
          this.attachWorkspaceRoles(users)
        )
      )
      .subscribe({

        next: users => {

          this.users =
            users;

          this.loading =
            false;
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


  clearFilters(): void {

    this.filterForm
      .setValue({
        search: '',
        status: 'all'
      });


    this.loadUsers();
  }


  openUser(
    user: AdminUser
  ): void {

    this.errorMessage =
      '';


    this.adminUsers
      .getUser(
        user.id
      )
      .subscribe({

        next: response => {

          this.selectedUser =
            this.mergeUserRole(
              response
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


  closeUserDetails(): void {

    this.selectedUser =
      null;
  }


  openCreate(): void {

    this.createOpen =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.createForm
      .reset({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        isActive: true
      });
  }


  closeCreate(): void {

    if (
      this.creating
    ) {

      return;
    }


    this.createOpen =
      false;
  }


  createUser(): void {

    if (
      this.creating
    ) {

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';


    if (
      this.createForm.invalid
    ) {

      this.createForm
        .markAllAsTouched();


      this.errorMessage =
        'راجع البيانات المدخلة وصحح الحقول المشار إليها.';

      return;
    }


    const value =
      this.createForm
        .getRawValue();


    if (
      value.password !==
      value.confirmPassword
    ) {

      const confirmControl =
        this.createForm.controls
          .confirmPassword;


      confirmControl.setErrors({
        ...(confirmControl.errors ?? {}),
        passwordMismatch:
          true
      });


      confirmControl
        .markAsTouched();


      this.errorMessage =
        'كلمة المرور وتأكيد كلمة المرور غير متطابقين.';

      return;
    }


    this.creating =
      true;


    this.adminUsers
      .createUser({

        fullName:
          value.fullName.trim(),

        email:
          value.email.trim(),

        password:
          value.password,

        confirmPassword:
          value.confirmPassword,

        isActive:
          value.isActive

      })
      .subscribe({

        next: user => {

          this.users = [
            this.mergeUserRole(user),
            ...this.users
          ];


          this.successMessage =
            'تم إنشاء حساب المستخدم بنجاح.';


          this.creating =
            false;

          this.createOpen =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.creating =
            false;
        }

      });
  }


  toggleUserStatus(
    user: AdminUser
  ): void {

    if (
      this.updatingUserId !==
        null ||
      user.isSystemAdmin
    ) {

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.updatingUserId =
      user.id;


    const newStatus =
      !user.isActive;


    this.adminUsers
      .setActiveStatus(
        user.id,
        newStatus
      )
      .subscribe({

        next: updated => {

          this.users =
            this.users.map(
              current =>
                current.id ===
                  updated.id
                  ? this.mergeUserRole({
                      ...current,
                      ...updated
                    })
                  : current
            );


          if (
            this.selectedUser?.id ===
            updated.id
          ) {

            this.selectedUser =
              this.mergeUserRole({
                ...this.selectedUser,
                ...updated
              });
          }


          this.successMessage =
            updated.isActive
              ? 'تم تفعيل الحساب بنجاح.'
              : 'تم تعطيل الحساب بنجاح.';


          this.updatingUserId =
            null;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.updatingUserId =
            null;
        }

      });
  }


  get totalUsers(): number {

    return this.users.length;
  }


  get activeUsers(): number {

    return this.users
      .filter(
        user =>
          user.isActive
      )
      .length;
  }


  get inactiveUsers(): number {

    return this.users
      .filter(
        user =>
          !user.isActive
      )
      .length;
  }


  userTypeLabel(
    user: AdminUser
  ): string {

    switch (user.workspaceRole) {

      case 'SystemAdmin':
        return 'مدير النظام';

      case 'WorkspaceOwner':
        return 'مالك مساحة عمل';

      case 'ProjectManager':
        return 'مدير مشروع';

      case 'Member':
        return 'عضو';

      default:
        return user.isSystemAdmin
          ? 'مدير النظام'
          : 'بدون دور';
    }
  }


  private attachWorkspaceRoles(
    users: AdminUser[]
  ) {

    return this.workspacesApi
      .getAll()
      .pipe(
        catchError(() =>
          of([] as Workspace[])
        ),
        switchMap(workspaces => {

          if (workspaces.length === 0) {

            return of(
              users.map(user =>
                this.mergeUserRole(user)
              )
            );
          }


          return forkJoin(
            workspaces.map(workspace =>
              this.loadWorkspaceContext(
                workspace
              )
            )
          ).pipe(
            map(contexts => {

              this.roleInfoByUserId =
                this.buildRoleInfo(
                  contexts
                );


              return users.map(user =>
                this.mergeUserRole(user)
              );
            })
          );
        })
      );
  }


  private loadWorkspaceContext(
    workspace: Workspace
  ) {

    return forkJoin({
      members:
        this.workspaceMembersApi
          .getByWorkspace(
            workspace.id
          )
          .pipe(
            catchError(() =>
              of([] as WorkspaceMember[])
            )
          ),

      projects:
        this.projectsApi
          .getByWorkspace(
            workspace.id
          )
          .pipe(
            catchError(() =>
              of([] as Project[])
            )
          )
    }).pipe(
      switchMap(({ members, projects }) => {

        if (projects.length === 0) {

          return of({
            workspace,
            members,
            projectMembers: [] as {
              project: Project;
              members: ProjectMember[];
            }[]
          });
        }


        return forkJoin(
          projects.map(project =>
            this.projectsApi
              .getMembers(
                workspace.id,
                project.id
              )
              .pipe(
                catchError(() =>
                  of([] as ProjectMember[])
                ),
                map(projectMembers => ({
                  project,
                  members:
                    projectMembers
                }))
              )
          )
        ).pipe(
          map(projectMembers => ({
            workspace,
            members,
            projectMembers
          }))
        );
      })
    );
  }


  private buildRoleInfo(
    contexts: {
      workspace: Workspace;
      members: WorkspaceMember[];
      projectMembers: {
        project: Project;
        members: ProjectMember[];
      }[];
    }[]
  ): Map<number, RoleInfo> {

    const assignments =
      new Map<number, UserAssignment>();


    const assignmentFor = (
      userId: number
    ): UserAssignment => {

      const existing =
        assignments.get(userId);

      if (existing) {

        return existing;
      }


      const created: UserAssignment = {
        roles: new Set<string>(),
        ownedWorkspaces: [],
        managedProjects: [],
        memberWorkspaces: [],
        memberProjects: []
      };


      assignments.set(
        userId,
        created
      );

      return created;
    };


    for (const context of contexts) {

      const workspaceName =
        context.workspace.name;


      if (
        context.workspace.ownerUserId
      ) {

        const owner =
          assignmentFor(
            context.workspace.ownerUserId
          );

        owner.roles.add(
          'WorkspaceOwner'
        );

        if (
          !owner.ownedWorkspaces.includes(
            workspaceName
          )
        ) {

          owner.ownedWorkspaces.push(
            workspaceName
          );
        }
      }


      for (const member of context.members) {

        const assignment =
          assignmentFor(
            member.userId
          );

        const role =
          this.normalizeRole(
            member.roleName
          );

        if (!role) {

          continue;
        }


        assignment.roles.add(role);


        if (role === 'WorkspaceOwner') {

          if (
            !assignment.ownedWorkspaces.includes(
              workspaceName
            )
          ) {

            assignment.ownedWorkspaces.push(
              workspaceName
            );
          }

          continue;
        }


        if (
          !assignment.memberWorkspaces.includes(
            workspaceName
          )
        ) {

          assignment.memberWorkspaces.push(
            workspaceName
          );
        }
      }


      for (const item of context.projectMembers) {

        if (item.project.managerUserId) {

          const manager =
            assignmentFor(
              item.project.managerUserId
            );

          manager.roles.add(
            'ProjectManager'
          );

          manager.managedProjects.push({
            projectName:
              item.project.name,
            workspaceName
          });
        }


        for (const member of item.members) {

          assignmentFor(
            member.userId
          ).memberProjects.push({
            projectName:
              item.project.name,
            workspaceName
          });
        }
      }
    }


    const result =
      new Map<number, RoleInfo>();


    for (const [userId, assignment] of assignments) {

      result.set(
        userId,
        this.resolveRoleInfo(
          assignment
        )
      );
    }


    return result;
  }


  private resolveRoleInfo(
    assignment: UserAssignment
  ): RoleInfo {

    if (assignment.ownedWorkspaces.length > 0) {

      return {
        role: 'WorkspaceOwner',
        description:
          assignment.ownedWorkspaces.join(
            ' · '
          )
      };
    }


    if (
      assignment.managedProjects.length > 0 ||
      assignment.roles.has('ProjectManager')
    ) {

      const description =
        assignment.managedProjects.length > 0
          ? assignment.managedProjects
              .map(item =>
                `${item.projectName} ضمن مساحة ${item.workspaceName}`
              )
              .join(' · ')
          : assignment.memberWorkspaces.join(
              ' · '
            );


      return {
        role: 'ProjectManager',
        description
      };
    }


    if (
      assignment.memberProjects.length > 0 ||
      assignment.memberWorkspaces.length > 0 ||
      assignment.roles.has('Member')
    ) {

      const description =
        assignment.memberProjects.length > 0
          ? assignment.memberProjects
              .map(item =>
                `مشروع ${item.projectName} ضمن مساحة ${item.workspaceName}`
              )
              .join(' · ')
          : assignment.memberWorkspaces.join(
              ' · '
            );


      return {
        role: 'Member',
        description
      };
    }


    return {
      role: 'None',
      description:
        'لا ينتمي إلى مساحة عمل'
    };
  }


  private mergeUserRole(
    user: AdminUser
  ): AdminUser {

    if (user.isSystemAdmin) {

      return {
        ...user,
        workspaceRole:
          'SystemAdmin',
        roleDescription:
          'حساب إدارة النظام'
      };
    }


    const info =
      this.roleInfoByUserId.get(
        user.id
      );


    if (info) {

      return {
        ...user,
        workspaceRole:
          info.role,
        roleDescription:
          info.description
      };
    }


    if (
      user.workspaceRole &&
      user.workspaceRole !==
        'None'
    ) {

      return {
        ...user,
        roleDescription:
          user.roleDescription
          || 'لا ينتمي إلى مساحة عمل'
      };
    }


    return {
      ...user,
      workspaceRole:
        'None',
      roleDescription:
        'لا ينتمي إلى مساحة عمل'
    };
  }


  private normalizeRole(
    roleName: string | null | undefined
  ): string | null {

    const value =
      (roleName ?? '')
        .trim()
        .toLowerCase();


    if (
      value === 'workspaceowner' ||
      value === 'owner'
    ) {

      return 'WorkspaceOwner';
    }


    if (
      value === 'projectmanager' ||
      value === 'manager'
    ) {

      return 'ProjectManager';
    }


    if (value === 'member') {

      return 'Member';
    }


    return null;
  }


  private roleInfoByUserId =
    new Map<number, RoleInfo>();


  formatDate(
    value:
      string | null
  ): string {

    if (!value) {

      return 'لم يسجل الدخول بعد';
    }


    return new Date(
      value
    )
      .toLocaleString(
        'ar-SY',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }


  initial(
    user: AdminUser
  ): string {

    return (
      user.fullName
        ?.trim()
        .charAt(0)
        .toUpperCase()
      ||
      'U'
    );
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
      'حدث خطأ غير متوقع.'
    );
  }
}