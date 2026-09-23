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
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';

import {
  AdminUser,
  AdminUsers
} from '../../../../core/services/admin-users';

import {
  WorkspaceAccess
} from '../../../../core/services/workspace-access';


@Component({
  selector: 'app-workspace-management',

  standalone: true,

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './workspace-management.html',

  styleUrl:
    './workspace-management.scss'
})
export class WorkspaceManagementPage
  implements OnInit {

  private readonly fb =
    inject(FormBuilder);


  private readonly workspacesService =
    inject(Workspaces);


  private readonly adminUsers =
    inject(AdminUsers);


  private readonly access =
    inject(WorkspaceAccess);


  private readonly router =
    inject(Router);


  private readonly route =
    inject(ActivatedRoute);


  /*
   * هذا الفلاج يحفظ طلب فتح Modal
   * إلى أن تنتهي Workspaces من التحميل.
   *
   * وهو حل مشكلة الـRace Condition.
   */
  private createRequested =
    false;


  workspaces:
    Workspace[] = [];


  loading =
    true;


  submitting =
    false;


  deleting =
    false;


  errorMessage =
    '';


  successMessage =
    '';


  createModalOpen =
    false;


  assignModalOpen =
    false;


  assignWorkspace:
    Workspace | null = null;


  eligibleOwners:
    AdminUser[] = [];


  loadingOwners =
    false;


  assigning =
    false;


  editModalOpen =
    false;


  deleteModalOpen =
    false;


  selectedWorkspace:
    Workspace | null =
      null;


  deleteConfirmation =
    '';


  readonly workspaceForm =
    this.fb.nonNullable.group({

      name: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(150)
        ]
      ],

      description: [
        '',
        [
          Validators.maxLength(1000)
        ]
      ],

      ownerUserId: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ]

    });


  readonly assignForm =
    this.fb.nonNullable.group({

      newOwnerUserId: [
        0,
        [
          Validators.required,
          Validators.min(1)
        ]
      ]

    });


  /* =========================================================
     INIT
     ========================================================= */

  ngOnInit(): void {

    /*
     * نقرأ Query Params، لكن لا نفتح
     * Modal أثناء تحميل Workspaces.
     */
    this.route.queryParamMap
      .subscribe(params => {

        this.createRequested =
          params.get('create') ===
          '1';


        /*
         * إذا كانت البيانات محملة مسبقًا،
         * نستطيع معالجة الطلب فورًا.
         */
        if (
          this.createRequested &&
          !this.loading
        ) {

          this.handleCreateRequest();
        }

      });


    this.loadWorkspaces();
  }


  /* =========================================================
     LOAD
     ========================================================= */

  loadWorkspaces(): void {

    this.loading =
      true;

    this.errorMessage =
      '';


    this.access
      .refresh()
      .subscribe({

        next: snapshot => {

          if (
            !this.access.isSystemAdmin &&
            !this.access.showWorkspacesNav
          ) {

            this.router.navigateByUrl(
              '/dashboard'
            );

            return;
          }

          this.workspaces =
            this.access.isSystemAdmin
              ? snapshot.workspaces
              : this.access.scopedWorkspaces;


          this.loading =
            false;


          /*
           * القرار حول إنشاء Workspace
           * لا يتم إلا بعد معرفة Workspaces
           * الفعلية الخاصة بالمستخدم.
           */
          if (
            this.createRequested
          ) {

            this.handleCreateRequest();
          }
        },


        error: error => {

          this.loading =
            false;


          this.createRequested =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     OWNER
     ========================================================= */

  isOwner(
    workspace: Workspace
  ): boolean {

    return (
      workspace.currentUserRole ===
        'WorkspaceOwner'
      ||
      workspace.currentUserRole ===
        'Owner'
    );
  }


  get ownedWorkspace():
    Workspace | null {

    return this.workspaces.find(
      workspace =>
        this.isOwner(
          workspace
        )
    ) ?? null;
  }


  get canCreateWorkspace():
    boolean {

    return (
      !this.loading &&
      this.access.isSystemAdmin
    );
  }


  get isSystemAdmin():
    boolean {

    return this.access.isSystemAdmin;
  }


  /* =========================================================
     CREATE REQUEST
     ========================================================= */

  private handleCreateRequest():
    void {

    if (
      this.loading
    ) {

      return;
    }


    /*
     * نعالج الطلب مرة واحدة فقط.
     */
    this.createRequested =
      false;


    /*
     * نحذف ?create=1 من الرابط حتى
     * لا يعاد فتح Modal عند Refresh
     * أو عند تغييرات داخل الصفحة.
     */
    this.clearCreateQueryParameter();


    /*
     * إذا كان المستخدم Owner:
     *
     * لا Modal.
     * لا Error أحمر.
     *
     * صفحة Workspaces نفسها تعرض
     * التنبيه الطبيعي بأن لديه مساحة.
     */
    if (
      !this.canCreateWorkspace
    ) {

      this.createModalOpen =
        false;

      return;
    }


    this.openCreate();
  }


  private clearCreateQueryParameter():
    void {

    this.router.navigate(
      [],
      {
        relativeTo:
          this.route,

        queryParams: {
          create: null
        },

        queryParamsHandling:
          'merge',

        replaceUrl:
          true
      }
    );
  }


  /* =========================================================
     CREATE
     ========================================================= */

  openCreate(): void {

    /*
     * ممنوع اتخاذ القرار أثناء تحميل
     * قائمة Workspaces.
     */
    if (
      this.loading
    ) {

      return;
    }


    /*
     * إذا كان Owner، لا نفتح Modal.
     * التنبيه الموجود أعلى الصفحة كافٍ.
     */
    if (
      !this.canCreateWorkspace
    ) {

      this.createModalOpen =
        false;

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.workspaceForm
      .reset({
        name: '',
        description: '',
        ownerUserId: 0
      });


    this.createModalOpen =
      true;


    this.loadEligibleOwners();
  }


  closeCreate(): void {

    if (
      this.submitting
    ) {

      return;
    }


    this.createModalOpen =
      false;


    this.workspaceForm
      .reset({
        name: '',
        description: '',
        ownerUserId: 0
      });
  }


  private loadEligibleOwners():
    void {

    if (
      !this.access.isSystemAdmin
    ) {

      this.eligibleOwners =
        [];

      return;
    }


    this.loadingOwners =
      true;


    this.adminUsers
      .getUsers(
        undefined,
        true
      )
      .subscribe({

        next: users => {

          this.loadingOwners =
            false;


          this.eligibleOwners =
            users.filter(user =>
              !user.isSystemAdmin &&
              user.isActive &&
              user.ownsWorkspace !==
                true
            );
        },


        error: error => {

          this.loadingOwners =
            false;


          this.eligibleOwners =
            [];


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  openAssignOwner(
    workspace: Workspace
  ): void {

    if (
      !this.access.isSystemAdmin
    ) {

      this.errorMessage =
        'تعيين مالك مساحة العمل متاح لمسؤول النظام فقط.';

      return;
    }


    this.assignWorkspace =
      workspace;

    this.assignModalOpen =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.assignForm
      .reset({
        newOwnerUserId: 0
      });


    this.loadEligibleOwners();
  }


  closeAssignOwner():
    void {

    if (
      this.assigning
    ) {

      return;
    }


    this.assignModalOpen =
      false;

    this.assignWorkspace =
      null;


    this.assignForm
      .reset({
        newOwnerUserId: 0
      });
  }


  assignOwner(): void {

    if (
      this.assigning ||
      !this.assignWorkspace
    ) {

      return;
    }


    if (
      !this.access.isSystemAdmin
    ) {

      this.closeAssignOwner();

      this.errorMessage =
        'تعيين مالك مساحة العمل متاح لمسؤول النظام فقط.';

      return;
    }


    if (
      this.assignForm.invalid
    ) {

      this.assignForm
        .markAllAsTouched();


      this.errorMessage =
        'اختر المستخدم الذي سيصبح المالك الجديد.';

      return;
    }


    const newOwnerUserId =
      Number(
        this.assignForm
          .getRawValue()
          .newOwnerUserId
      );


    this.assigning =
      true;

    this.errorMessage =
      '';


    this.workspacesService
      .transferOwnership(
        this.assignWorkspace.id,
        newOwnerUserId
      )
      .subscribe({

        next: () => {

          this.assigning =
            false;


          const workspaceName =
            this.assignWorkspace
              ?.name
            ?? '';


          this.closeAssignOwner();


          this.successMessage =
            `تم تعيين مالك جديد لمساحة العمل "${workspaceName}".`;


          this.loadWorkspaces();
        },


        error: error => {

          this.assigning =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  createWorkspace(): void {

    if (
      this.submitting
    ) {

      return;
    }


    /*
     * حماية Frontend ثانية قبل الإرسال.
     */
    if (
      !this.canCreateWorkspace
    ) {

      this.createModalOpen =
        false;


      this.errorMessage =
        'لا يمكن إنشاء مساحة عمل إلا بواسطة مسؤول النظام.';

      return;
    }


    if (
      this.workspaceForm.invalid
    ) {

      this.workspaceForm
        .markAllAsTouched();


      this.errorMessage =
        'راجع بيانات مساحة العمل وصحح الحقول المشار إليها.';

      return;
    }


    const value =
      this.workspaceForm
        .getRawValue();


    const name =
      value.name.trim();


    const description =
      value.description.trim();


    /*
     * Validators.minLength يحسب المسافات،
     * لذلك نتحقق أيضًا بعد Trim.
     */
    if (
      name.length < 2
    ) {

      this.workspaceForm
        .controls
        .name
        .setErrors({
          minlength: true
        });


      this.workspaceForm
        .controls
        .name
        .markAsTouched();


      this.errorMessage =
        'اسم مساحة العمل يجب أن يتكون من حرفين على الأقل.';

      return;
    }


    this.submitting =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.workspacesService
      .create({

        name,

        description:
          description
            ? description
            : null,

        ownerUserId:
          Number(
            value.ownerUserId
          )

      })
      .subscribe({

        next: workspace => {

          this.submitting =
            false;


          this.createModalOpen =
            false;


          this.successMessage =
            `تم إنشاء مساحة العمل "${workspace.name}" وإسنادها إلى المالك المحدد.`;


          this.saveWorkspaceContext(
            workspace
          );


          this.loadWorkspaces();
        },


        error: error => {

          this.submitting =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     EDIT
     ========================================================= */

  openEdit(
    workspace: Workspace
  ): void {

    if (
      !this.isOwner(
        workspace
      )
    ) {

      this.errorMessage =
        'تعديل مساحة العمل متاح للمالك فقط.';

      return;
    }


    this.selectedWorkspace =
      workspace;


    this.workspaceForm
      .reset({

        name:
          workspace.name,

        description:
          workspace.description ?? '',

        ownerUserId:
          workspace.ownerUserId || 0

      });


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.editModalOpen =
      true;
  }


  closeEdit(): void {

    if (
      this.submitting
    ) {

      return;
    }


    this.editModalOpen =
      false;


    this.selectedWorkspace =
      null;
  }


  updateWorkspace(): void {

    if (
      !this.selectedWorkspace ||
      this.submitting
    ) {

      return;
    }


    if (
      !this.isOwner(
        this.selectedWorkspace
      )
    ) {

      this.errorMessage =
        'تعديل مساحة العمل متاح للمالك فقط.';

      return;
    }


    if (
      this.workspaceForm.invalid
    ) {

      this.workspaceForm
        .markAllAsTouched();


      this.errorMessage =
        'راجع بيانات مساحة العمل وصحح الحقول المشار إليها.';

      return;
    }


    const value =
      this.workspaceForm
        .getRawValue();


    const name =
      value.name.trim();


    const description =
      value.description.trim();


    if (
      name.length < 2
    ) {

      this.workspaceForm
        .controls
        .name
        .setErrors({
          minlength: true
        });


      this.workspaceForm
        .controls
        .name
        .markAsTouched();


      this.errorMessage =
        'اسم مساحة العمل يجب أن يتكون من حرفين على الأقل.';

      return;
    }


    const workspaceId =
      this.selectedWorkspace.id;


    this.submitting =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.workspacesService
      .update(
        workspaceId,
        {
          name,

          description:
            description
              ? description
              : null
        }
      )
      .subscribe({

        next: workspace => {

          this.submitting =
            false;


          this.editModalOpen =
            false;


          this.selectedWorkspace =
            null;


          this.successMessage =
            `تم تحديث مساحة العمل "${workspace.name}" بنجاح.`;


          const selectedId =
            Number(
              localStorage.getItem(
                'taskmanagement_selected_workspace_id'
              )
            );


          if (
            selectedId ===
            workspace.id
          ) {

            this.saveWorkspaceContext(
              workspace
            );
          }


          this.loadWorkspaces();
        },


        error: error => {

          this.submitting =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     DELETE
     ========================================================= */

  openDelete(
    workspace: Workspace
  ): void {

    if (
      !this.isOwner(
        workspace
      )
    ) {

      this.errorMessage =
        'حذف مساحة العمل متاح للمالك فقط.';

      return;
    }


    this.selectedWorkspace =
      workspace;


    this.deleteConfirmation =
      '';


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.deleteModalOpen =
      true;
  }


  closeDelete(): void {

    if (
      this.deleting
    ) {

      return;
    }


    this.deleteModalOpen =
      false;


    this.selectedWorkspace =
      null;


    this.deleteConfirmation =
      '';
  }


  setDeleteConfirmation(
    value: string
  ): void {

    this.deleteConfirmation =
      value;
  }


  get deleteConfirmationValid():
    boolean {

    return (
      !!this.selectedWorkspace
      &&
      this.deleteConfirmation.trim() ===
        this.selectedWorkspace.name
    );
  }


  deleteWorkspace(): void {

    if (
      !this.selectedWorkspace ||
      this.deleting
    ) {

      return;
    }


    if (
      !this.isOwner(
        this.selectedWorkspace
      )
    ) {

      this.errorMessage =
        'حذف مساحة العمل متاح للمالك فقط.';

      return;
    }


    if (
      !this.deleteConfirmationValid
    ) {

      this.errorMessage =
        'اكتب اسم مساحة العمل كما هو تمامًا لتأكيد الحذف.';

      return;
    }


    const workspace =
      this.selectedWorkspace;


    this.deleting =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.workspacesService
      .delete(
        workspace.id
      )
      .subscribe({

        next: () => {

          this.deleting =
            false;


          this.deleteModalOpen =
            false;


          this.selectedWorkspace =
            null;


          this.deleteConfirmation =
            '';


          const selectedId =
            Number(
              localStorage.getItem(
                'taskmanagement_selected_workspace_id'
              )
            );


          if (
            selectedId ===
            workspace.id
          ) {

            this.clearWorkspaceContext();
          }


          this.successMessage =
            `تم حذف مساحة العمل "${workspace.name}".`;


          this.loadWorkspaces();
        },


        error: error => {

          this.deleting =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     NAVIGATION
     ========================================================= */

  openProjects(
    workspace: Workspace
  ): void {

    this.saveWorkspaceContext(
      workspace
    );


    localStorage.removeItem(
      'taskmanagement_selected_project_id'
    );


    localStorage.removeItem(
      'taskmanagement_project_name'
    );


    this.router.navigateByUrl(
      `/workspaces/${workspace.id}/projects`
    );
  }


  /* =========================================================
     LOCAL STORAGE
     ========================================================= */

  private saveWorkspaceContext(
    workspace: Workspace
  ): void {

    localStorage.setItem(
      'taskmanagement_workspace_id',
      String(
        workspace.id
      )
    );


    localStorage.setItem(
      'taskmanagement_selected_workspace_id',
      String(
        workspace.id
      )
    );


    localStorage.setItem(
      'taskmanagement_workspace_name',
      workspace.name
    );


    localStorage.setItem(
      'taskmanagement_selected_workspace_name',
      workspace.name
    );
  }


  private clearWorkspaceContext():
    void {

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
      'taskmanagement_selected_project_id'
    );


    localStorage.removeItem(
      'taskmanagement_project_name'
    );
  }


  /* =========================================================
     DISPLAY
     ========================================================= */

  roleLabel(
    roleName: string
  ): string {

    switch (roleName) {

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

        return roleName;
    }
  }


  formatDate(
    value: string
  ): string {

    return new Date(
      value
    )
      .toLocaleDateString(
        'ar-SY',
        {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }
      );
  }


  /* =========================================================
     ERRORS
     ========================================================= */

  private extractApiError(
    error: any
  ): string {

    const validationErrors =
      error?.error?.errors;


    if (
      validationErrors &&
      typeof validationErrors ===
        'object'
    ) {

      const messages =
        Object.values(
          validationErrors
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
        messages.length > 0
      ) {

        return messages.join(
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
          'cannot own more than one active workspace'
        )
        ||
        detail.includes(
          'already owns an active workspace'
        )
        ||
        detail.includes(
          'already owns another active workspace'
        )
        ||
        detail.includes(
          'only one active workspace'
        )
      ) {

        return 'لا يمكن إسناد مساحة العمل إلى مستخدم يملك مساحة عمل نشطة أخرى.';
      }


      if (
        detail.includes(
          'Only the system administrator can create'
        )
      ) {

        return 'إنشاء مساحات العمل متاح لمسؤول النظام فقط.';
      }


      if (
        detail.includes(
          'Only the system administrator can assign'
        )
      ) {

        return 'تعيين مالك مساحة العمل متاح لمسؤول النظام فقط.';
      }


      if (
        detail.includes(
          'System administrator cannot be assigned'
        )
      ) {

        return 'لا يمكن تعيين مسؤول النظام مالكًا لمساحة العمل.';
      }


      if (
        detail.includes(
          'selected owner was not found'
        )
        ||
        detail.includes(
          'selected owner account is inactive'
        )
      ) {

        return 'المستخدم المحدد غير صالح لإسناد مساحة العمل.';
      }


      if (
        detail.includes(
          'Only workspace owner'
        )
      ) {

        return 'هذه العملية متاحة لمالك مساحة العمل فقط.';
      }


      if (
        detail.includes(
          'Workspace not found'
        )
      ) {

        return 'مساحة العمل غير موجودة أو لم تعد متاحة.';
      }


      return detail;
    }


    return 'تعذر تنفيذ العملية. حاول مرة أخرى.';
  }
}