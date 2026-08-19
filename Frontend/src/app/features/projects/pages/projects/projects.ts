import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  Project,
  Projects
} from '../../../../core/services/projects';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';

import {
  WorkspaceMember,
  WorkspaceMembers
} from '../../../../core/services/workspace-members';


@Component({
  selector: 'app-projects',

  standalone: true,

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './projects.html',

  styleUrl:
    './projects.scss'
})
export class ProjectsPage
  implements OnInit {

  private readonly route =
    inject(ActivatedRoute);


  private readonly router =
    inject(Router);


  private readonly projectsService =
    inject(Projects);


  private readonly workspacesService =
    inject(Workspaces);


  private readonly workspaceMembersService =
    inject(WorkspaceMembers);


  private readonly fb =
    inject(FormBuilder);


  /* =========================================================
     CONTEXT
     ========================================================= */

  workspaceId =
    0;


  workspaceName =
    'مساحة العمل';


  workspace:
    Workspace | null =
      null;


  /* =========================================================
     PROJECTS
     ========================================================= */

  projects:
    Project[] = [];


  loading =
    true;


  errorMessage =
    '';


  successMessage =
    '';


  /* =========================================================
     MANAGERS
     ========================================================= */

  projectManagers:
    WorkspaceMember[] = [];


  loadingManagers =
    false;


  /* =========================================================
     MODALS
     ========================================================= */

  createModalOpen =
    false;


  editModalOpen =
    false;


  archiveModalOpen =
    false;


  deleteModalOpen =
    false;


  selectedProject:
    Project | null =
      null;


  submitting =
    false;


  archiving =
    false;


  deleting =
    false;


  deleteConfirmation =
    '';


  readonly projectForm =
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

      managerUserId: [
        0
      ]

    });


  /* =========================================================
     INIT
     ========================================================= */

  ngOnInit(): void {

    this.workspaceId =
      Number(
        this.route.snapshot
          .paramMap
          .get('workspaceId')
      );


    if (!this.workspaceId) {

      this.router.navigateByUrl(
        '/dashboard'
      );

      return;
    }


    this.workspaceName =
      localStorage.getItem(
        'taskmanagement_workspace_name'
      )
      ??
      localStorage.getItem(
        'taskmanagement_selected_workspace_name'
      )
      ??
      'مساحة العمل';


    this.loadWorkspaceContext();

    this.loadProjects();
  }


  /* =========================================================
     WORKSPACE
     ========================================================= */

  private loadWorkspaceContext():
    void {

    this.workspacesService
      .getById(
        this.workspaceId
      )
      .subscribe({

        next: workspace => {

          this.workspace =
            workspace;


          this.workspaceName =
            workspace.name;


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

        },


        error: error => {

          console.error(
            'Workspace request failed:',
            error
          );

        }

      });
  }


  get currentWorkspaceRole():
    string {

    return (
      this.workspace
        ?.currentUserRole
      ??
      ''
    );
  }


  get canManageProjects():
    boolean {

    /*
     * حسب الصلاحيات الافتراضية الحالية:
     * WorkspaceOwner هو الذي يملك
     * ProjectCreate / Update / Delete.
     *
     * الـBackend يبقى المرجع النهائي.
     */
    return (
      this.currentWorkspaceRole ===
        'WorkspaceOwner'
      ||
      this.currentWorkspaceRole ===
        'Owner'
    );
  }


  roleLabel(
    role: string
  ): string {

    switch (role) {

      case 'WorkspaceOwner':
      case 'Owner':

        return 'مالك مساحة العمل';


      case 'ProjectManager':

        return 'مدير مشروع';


      case 'Member':

        return 'عضو';


      default:

        return role || '—';
    }
  }


  /* =========================================================
     LOAD PROJECTS
     ========================================================= */

  loadProjects(): void {

    this.loading =
      true;


    this.errorMessage =
      '';


    this.projectsService
      .getByWorkspace(
        this.workspaceId
      )
      .subscribe({

        next: projects => {

          this.projects =
            [...projects]
              .sort(
                (a, b) => {

                  if (
                    a.isArchived !==
                    b.isArchived
                  ) {

                    return a.isArchived
                      ? 1
                      : -1;
                  }


                  return a.name
                    .localeCompare(
                      b.name,
                      'ar'
                    );
                }
              );


          this.loading =
            false;
        },


        error: error => {

          console.error(
            'Projects request failed:',
            error
          );


          this.errorMessage =
            this.extractApiError(
              error
            );


          this.loading =
            false;
        }

      });
  }


  /* =========================================================
     MANAGERS
     ========================================================= */

  private loadProjectManagers():
    void {

    if (
      this.loadingManagers
    ) {

      return;
    }


    this.loadingManagers =
      true;


    this.workspaceMembersService
      .getByWorkspace(
        this.workspaceId
      )
      .subscribe({

        next: members => {

          /*
           * الـBackend يقبل فقط مستخدم
           * دوره ProjectManager.
           */
          this.projectManagers =
            members
              .filter(
                member =>
                  member.roleName ===
                    'ProjectManager'
                  &&
                  member.status ===
                    'Active'
              )
              .sort(
                (a, b) =>
                  a.fullName
                    .localeCompare(
                      b.fullName,
                      'ar'
                    )
              );


          this.loadingManagers =
            false;
        },


        error: error => {

          this.loadingManagers =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     CREATE
     ========================================================= */

  openCreate(): void {

    if (
      !this.canManageProjects
    ) {

      this.errorMessage =
        'لا تملك صلاحية إنشاء مشروع ضمن مساحة العمل هذه.';

      return;
    }


    this.selectedProject =
      null;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.projectForm
      .reset({

        name: '',

        description: '',

        managerUserId: 0

      });


    this.loadProjectManagers();


    this.createModalOpen =
      true;
  }


  closeCreate(): void {

    if (
      this.submitting
    ) {

      return;
    }


    this.createModalOpen =
      false;


    this.projectForm
      .reset({

        name: '',

        description: '',

        managerUserId: 0

      });
  }


  createProject(): void {

    if (
      this.submitting
    ) {

      return;
    }


    if (
      !this.canManageProjects
    ) {

      this.errorMessage =
        'لا تملك صلاحية إنشاء مشروع.';

      return;
    }


    if (
      this.projectForm.invalid
    ) {

      this.projectForm
        .markAllAsTouched();


      this.errorMessage =
        'راجع بيانات المشروع وصحح الحقول المشار إليها.';

      return;
    }


    const value =
      this.projectForm
        .getRawValue();


    const name =
      value.name.trim();


    if (
      name.length < 2
    ) {

      this.projectForm
        .controls
        .name
        .setErrors({
          minlength: true
        });


      this.projectForm
        .controls
        .name
        .markAsTouched();


      this.errorMessage =
        'اسم المشروع يجب أن يتكون من حرفين على الأقل.';

      return;
    }


    this.submitting =
      true;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.projectsService
      .create(
        this.workspaceId,
        {

          name,

          description:
            value.description.trim()
              || null,

          managerUserId:
            Number(
              value.managerUserId
            ) > 0
              ? Number(
                  value.managerUserId
                )
              : null

        }
      )
      .subscribe({

        next: project => {

          this.submitting =
            false;


          this.createModalOpen =
            false;


          this.projects =
            [
              project,
              ...this.projects
            ];


          this.successMessage =
            `تم إنشاء المشروع "${project.name}" بنجاح.`;

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
    project: Project
  ): void {

    if (
      !this.canManageProjects
    ) {

      this.errorMessage =
        'لا تملك صلاحية تعديل المشاريع.';

      return;
    }


    if (
      project.isArchived
    ) {

      this.errorMessage =
        'لا يمكن تعديل مشروع مؤرشف.';

      return;
    }


    this.selectedProject =
      project;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.projectForm
      .reset({

        name:
          project.name,

        description:
          project.description
          ??
          '',

        managerUserId:
          project.managerUserId
          ??
          0

      });


    this.loadProjectManagers();


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


    this.selectedProject =
      null;
  }


  updateProject(): void {

    if (
      !this.selectedProject ||
      this.submitting
    ) {

      return;
    }


    if (
      !this.canManageProjects
    ) {

      this.errorMessage =
        'لا تملك صلاحية تعديل المشروع.';

      return;
    }


    if (
      this.selectedProject
        .isArchived
    ) {

      this.errorMessage =
        'لا يمكن تعديل مشروع مؤرشف.';

      return;
    }


    if (
      this.projectForm.invalid
    ) {

      this.projectForm
        .markAllAsTouched();


      this.errorMessage =
        'راجع بيانات المشروع وصحح الحقول المشار إليها.';

      return;
    }


    const value =
      this.projectForm
        .getRawValue();


    const name =
      value.name.trim();


    if (
      name.length < 2
    ) {

      this.projectForm
        .controls
        .name
        .setErrors({
          minlength: true
        });


      this.projectForm
        .controls
        .name
        .markAsTouched();


      this.errorMessage =
        'اسم المشروع يجب أن يتكون من حرفين على الأقل.';

      return;
    }


    const projectId =
      this.selectedProject.id;


    this.submitting =
      true;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.projectsService
      .update(
        this.workspaceId,
        projectId,
        {

          name,

          description:
            value.description.trim()
              || null,

          managerUserId:
            Number(
              value.managerUserId
            ) > 0
              ? Number(
                  value.managerUserId
                )
              : null

        }
      )
      .subscribe({

        next: updated => {

          this.projects =
            this.projects
              .map(
                project =>
                  project.id ===
                    updated.id
                    ? updated
                    : project
              );


          this.submitting =
            false;


          this.editModalOpen =
            false;


          this.selectedProject =
            null;


          this.successMessage =
            `تم تحديث المشروع "${updated.name}" بنجاح.`;


          const currentProjectId =
            Number(
              localStorage.getItem(
                'taskmanagement_project_id'
              )
            );


          if (
            currentProjectId ===
            updated.id
          ) {

            localStorage.setItem(
              'taskmanagement_project_name',
              updated.name
            );
          }

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
     ARCHIVE
     ========================================================= */

  openArchive(
    project: Project
  ): void {

    if (
      !this.canManageProjects
    ) {

      this.errorMessage =
        'لا تملك صلاحية أرشفة المشروع.';

      return;
    }


    if (
      project.isArchived
    ) {

      return;
    }


    this.selectedProject =
      project;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.archiveModalOpen =
      true;
  }


  closeArchive(): void {

    if (
      this.archiving
    ) {

      return;
    }


    this.archiveModalOpen =
      false;


    this.selectedProject =
      null;
  }


  archiveProject(): void {

    if (
      !this.selectedProject ||
      this.archiving
    ) {

      return;
    }


    const project =
      this.selectedProject;


    this.archiving =
      true;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.projectsService
      .archive(
        this.workspaceId,
        project.id
      )
      .subscribe({

        next: () => {

          this.projects =
            this.projects
              .map(
                item =>
                  item.id ===
                    project.id
                    ? {
                        ...item,
                        isArchived: true,
                        updatedAt:
                          new Date()
                            .toISOString()
                      }
                    : item
              );


          this.archiving =
            false;


          this.archiveModalOpen =
            false;


          this.selectedProject =
            null;


          this.successMessage =
            `تمت أرشفة المشروع "${project.name}".`;

        },


        error: error => {

          this.archiving =
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
    project: Project
  ): void {

    if (
      !this.canManageProjects
    ) {

      this.errorMessage =
        'لا تملك صلاحية حذف المشروع.';

      return;
    }


    this.selectedProject =
      project;


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


    this.selectedProject =
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
      !!this.selectedProject
      &&
      this.deleteConfirmation
        .trim() ===
        this.selectedProject.name
    );
  }


  deleteProject(): void {

    if (
      !this.selectedProject ||
      this.deleting
    ) {

      return;
    }


    if (
      !this.deleteConfirmationValid
    ) {

      this.errorMessage =
        'اكتب اسم المشروع كما هو تمامًا لتأكيد الحذف.';

      return;
    }


    const project =
      this.selectedProject;


    this.deleting =
      true;


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.projectsService
      .delete(
        this.workspaceId,
        project.id
      )
      .subscribe({

        next: () => {

          this.projects =
            this.projects
              .filter(
                item =>
                  item.id !==
                  project.id
              );


          this.deleting =
            false;


          this.deleteModalOpen =
            false;


          this.selectedProject =
            null;


          this.deleteConfirmation =
            '';


          this.successMessage =
            `تم حذف المشروع "${project.name}".`;

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

  back(): void {

    this.router.navigateByUrl(
      '/dashboard'
    );
  }


  openProject(
    project: Project
  ): void {

    localStorage.setItem(
      'taskmanagement_project_id',
      String(
        project.id
      )
    );


    localStorage.setItem(
      'taskmanagement_selected_project_id',
      String(
        project.id
      )
    );


    localStorage.setItem(
      'taskmanagement_project_name',
      project.name
    );


    this.router.navigate([
      '/workspaces',
      this.workspaceId,
      'projects',
      project.id,
      'tasks'
    ]);
  }


  /* =========================================================
     COUNTS
     ========================================================= */

  get activeProjects():
    Project[] {

    return this.projects
      .filter(
        project =>
          !project.isArchived
      );
  }


  get archivedProjects():
    Project[] {

    return this.projects
      .filter(
        project =>
          project.isArchived
      );
  }


  /* =========================================================
     DISPLAY
     ========================================================= */

  managerName(
    project: Project
  ): string {

    return (
      project.managerUserFullName
      ??
      'غير معيّن'
    );
  }


  firstLetter(
    name: string
  ): string {

    return (
      name
        ?.trim()
        ?.charAt(0)
        ?.toUpperCase()
      ||
      'P'
    );
  }


  /* =========================================================
     ERROR
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
          'same name already exists'
        )
      ) {

        return 'يوجد مشروع آخر بالاسم نفسه ضمن مساحة العمل.';
      }


      if (
        detail.includes(
          'Archived projects cannot be updated'
        )
      ) {

        return 'لا يمكن تعديل مشروع مؤرشف.';
      }


      if (
        detail.includes(
          'already archived'
        )
      ) {

        return 'المشروع مؤرشف بالفعل.';
      }


      if (
        detail.includes(
          'must be an active member'
        )
      ) {

        return 'مدير المشروع المحدد يجب أن يكون عضوًا فعالًا في مساحة العمل.';
      }


      if (
        detail.includes(
          'must have the ProjectManager role'
        )
      ) {

        return 'يمكن تعيين مستخدم بدور «مدير مشروع» فقط كمدير للمشروع.';
      }


      if (
        error?.status ===
        403
      ) {

        return 'لا تملك الصلاحية المطلوبة لتنفيذ هذه العملية.';
      }


      return detail;
    }


    if (
      error?.status ===
      403
    ) {

      return 'لا تملك الصلاحية المطلوبة لتنفيذ هذه العملية.';
    }


    return 'تعذر تنفيذ العملية.';
  }
}