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
  catchError,
  forkJoin,
  of
} from 'rxjs';

import {
  Project,
  ProjectMember,
  Projects
} from '../../../../core/services/projects';

import {
  TaskItem,
  Tasks
} from '../../../../core/services/tasks';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';

import {
  WorkspaceAccess
} from '../../../../core/services/workspace-access';

import {
  WorkspaceMember,
  WorkspaceMembers
} from '../../../../core/services/workspace-members';


type ProjectTaskStats = {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  done: number;
  cancelled: number;
  completion: number;
};


const emptyProjectTaskStats: ProjectTaskStats = {
  total: 0,
  todo: 0,
  inProgress: 0,
  inReview: 0,
  done: 0,
  cancelled: 0,
  completion: 0
};


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


  private readonly access =
    inject(WorkspaceAccess);


  private readonly workspaceMembersService =
    inject(WorkspaceMembers);


  private readonly tasksApi =
    inject(Tasks);


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


  workspaceMembers:
    WorkspaceMember[] = [];


  projectMembers:
    ProjectMember[] = [];


  projectMembersById:
    Record<number, ProjectMember[]> =
      {};


  projectTaskStatsById:
    Record<number, ProjectTaskStats> =
      {};


  membersModalOpen =
    false;


  loadingManagers =
    false;


  loadingProjectMembers =
    false;


  addingProjectMember =
    false;


  selectedAddMemberUserId =
    0;


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

          if (
            !this.access.matchesActiveRole(
              workspace.currentUserRole
            )
          ) {

            this.router.navigateByUrl(
              '/projects'
            );

            return;
          }

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


  get canAddProjectMembers():
    boolean {

    return this.canManageProjects;
  }


  get canViewProjectMembers():
    boolean {

    return (
      this.canManageProjects ||
      this.isManagerView ||
      this.isMemberView
    );
  }


  get isManagerView():
    boolean {

    return this.access.activeRoleMode ===
      'manager';
  }


  get isMemberView():
    boolean {

    return this.access.activeRoleMode ===
      'member';
  }


  get isFocusedProjectView():
    boolean {

    return this.isManagerView ||
      this.isMemberView;
  }


  get pageTitle():
    string {

    if (
      this.isFocusedProjectView &&
      this.projects.length === 1
    ) {

      return this.projects[0].name;
    }


    if (this.isManagerView) {
      return 'المشاريع التي تديرها';
    }


    if (this.isMemberView) {
      return 'المشاريع التي أنت ضمنها';
    }


    return this.workspaceName;
  }


  get pageSubtitle():
    string {

    if (
      this.canManageProjects
    ) {

      return 'أنشئ المشاريع وعيّن مديريها وأضف أعضاء مساحة العمل إلى كل مشروع.';
    }


    if (this.isManagerView) {

      return this.workspaceName
        ? `تفاصيل المشروع الذي تديره داخل مساحة ${this.workspaceName}: الفريق، المهام، وتاريخ العمل.`
        : 'تفاصيل المشروع الذي تديره: الفريق، المهام، وتاريخ العمل.';
    }


    if (this.isMemberView) {

      return this.workspaceName
        ? `المشاريع التي أنت عضو فيها داخل مساحة ${this.workspaceName}. يمكنك عرض الأعضاء ومهامك المسندة.`
        : 'المشاريع التي أنت عضو فيها. يمكنك عرض الأعضاء ومهامك المسندة.';
    }


    return 'المشاريع التي أنت عضو فيها. المهام تظهر فقط إذا أُسندت باسمك.';
  }


  formatDateTime(
    value: string | null | undefined
  ): string {

    if (!value) {
      return '—';
    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '—';
    }


    return new Intl
      .DateTimeFormat(
        'ar-SY',
        {
          dateStyle:
            'medium',
          timeStyle:
            'short'
        }
      )
      .format(
        date
      );
  }


  taskStatsOf(
    project: Project
  ): ProjectTaskStats {

    return this.projectTaskStatsById[project.id]
      ?? emptyProjectTaskStats;
  }


  formatDate(
    value: string | null | undefined
  ): string {

    if (!value) {
      return '—';
    }


    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '—';
    }


    return new Intl
      .DateTimeFormat(
        'ar-SY',
        {
          dateStyle:
            'medium'
        }
      )
      .format(
        date
      );
  }


  get eligibleProjectMembers():
    WorkspaceMember[] {

    const addedUserIds =
      new Set(
        this.projectMembers.map(
          member =>
            member.userId
        )
      );


    return this.workspaceMembers
      .filter(member =>
        member.status ===
          'Active'
        &&
        member.roleName ===
          'Member'
        &&
        !addedUserIds.has(
          member.userId
        )
      )
      .sort(
        (a, b) =>
          a.fullName
            .localeCompare(
              b.fullName,
              'ar'
            )
      );
  }


  onAddMemberUserChange(
    event: Event
  ): void {

    const select =
      event.target as HTMLSelectElement;


    this.selectedAddMemberUserId =
      Number(
        select.value
      ) || 0;
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


          this.loadProjectMemberLists();
          this.loadProjectTaskStats();
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

          this.workspaceMembers =
            members;


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


          this.projectManagers =
            [];
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


    this.selectedAddMemberUserId =
      0;


    this.loadProjectManagers();

    this.loadProjectMembers(
      project
    );


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


    this.projectMembers =
      [];


    this.selectedAddMemberUserId =
      0;
  }


  membersOf(
    project: Project
  ): ProjectMember[] {

    return this.projectMembersById[project.id]
      ?? [];
  }


  openMembers(
    project: Project
  ): void {

    if (
      !this.canViewProjectMembers
    ) {
      return;
    }


    if (
      this.canAddProjectMembers
    ) {

      this.openEdit(
        project
      );

      return;
    }


    this.selectedProject =
      project;

    this.membersModalOpen =
      true;

    this.errorMessage =
      '';


    this.loadProjectMembers(
      project
    );
  }


  closeMembers(): void {

    this.membersModalOpen =
      false;


    if (
      !this.editModalOpen
    ) {

      this.selectedProject =
        null;
    }
  }


  private loadProjectMemberLists():
    void {

    if (
      !this.canViewProjectMembers ||
      this.projects.length ===
        0
    ) {

      this.projectMembersById =
        {};

      return;
    }


    forkJoin(
      this.projects.map(project =>
        this.projectsService
          .getMembers(
            this.workspaceId,
            project.id
          )
      )
    )
      .subscribe({

        next: groups => {

          const next:
            Record<number, ProjectMember[]> =
              {};


          this.projects.forEach(
            (project, index) => {

              next[project.id] =
                groups[index]
                ?? [];

            }
          );


          this.projectMembersById =
            next;
        },


        error: () => {

          this.projectMembersById =
            {};
        }

      });
  }


  private loadProjectTaskStats():
    void {

    if (
      !this.isManagerView ||
      this.projects.length ===
        0
    ) {

      this.projectTaskStatsById =
        {};

      return;
    }


    forkJoin(
      this.projects.map(project =>
        this.tasksApi
          .getByProject(
            this.workspaceId,
            project.id
          )
          .pipe(
            catchError(
              () =>
                of(
                  [] as TaskItem[]
                )
            )
          )
      )
    )
      .subscribe({

        next: groups => {

          const next:
            Record<number, ProjectTaskStats> =
              {};


          this.projects.forEach(
            (project, index) => {

              const tasks =
                groups[index]
                ?? [];

              const done =
                tasks.filter(task =>
                  task.status ===
                    'Done'
                )
                  .length;

              next[project.id] = {
                total:
                  tasks.length,
                todo:
                  tasks.filter(task =>
                    task.status ===
                      'Todo'
                  )
                    .length,
                inProgress:
                  tasks.filter(task =>
                    task.status ===
                      'InProgress'
                  )
                    .length,
                inReview:
                  tasks.filter(task =>
                    task.status ===
                      'InReview'
                  )
                    .length,
                done,
                cancelled:
                  tasks.filter(task =>
                    task.status ===
                      'Cancelled'
                  )
                    .length,
                completion:
                  tasks.length > 0
                    ? Math.round(
                        (
                          done /
                          tasks.length
                        )
                        *
                        100
                      )
                    : 0
              };

            }
          );


          this.projectTaskStatsById =
            next;
        },


        error: () => {

          this.projectTaskStatsById =
            {};
        }

      });
  }


  private loadProjectMembers(
    project: Project
  ): void {

    if (
      !this.canViewProjectMembers
    ) {

      this.projectMembers =
        [];

      return;
    }


    const cachedMembers =
      this.projectMembersById[project.id];


    if (
      cachedMembers
    ) {

      this.projectMembers =
        cachedMembers;
    }


    this.loadingProjectMembers =
      !cachedMembers;


    this.projectsService
      .getMembers(
        this.workspaceId,
        project.id
      )
      .subscribe({

        next: members => {

          this.projectMembers =
            members;


          this.projectMembersById = {
            ...this.projectMembersById,
            [project.id]:
              members
          };


          this.loadingProjectMembers =
            false;
        },


        error: error => {

          this.loadingProjectMembers =
            false;


          if (
            !cachedMembers
          ) {

            this.projectMembers =
              [];
          }
        }

      });
  }


  addProjectMember(): void {

    if (
      this.addingProjectMember ||
      !this.selectedProject ||
      !this.canAddProjectMembers
    ) {

      return;
    }


    const userId =
      Number(
        this.selectedAddMemberUserId
      );


    if (
      userId < 1
    ) {

      this.errorMessage =
        'اختر عضوًا من مساحة العمل الحالية لإضافته إلى المشروع.';

      return;
    }


    this.addingProjectMember =
      true;

    this.errorMessage =
      '';


    this.projectsService
      .addMember(
        this.workspaceId,
        this.selectedProject.id,
        userId
      )
      .subscribe({

        next: member => {

          this.addingProjectMember =
            false;


          this.projectMembers =
            [
              ...this.projectMembers,
              member
            ]
              .sort(
                (a, b) =>
                  a.fullName
                    .localeCompare(
                      b.fullName,
                      'ar'
                    )
              );


          this.selectedAddMemberUserId =
            0;


          if (
            this.selectedProject
          ) {

            this.projectMembersById = {
              ...this.projectMembersById,
              [this.selectedProject.id]:
                this.projectMembers
            };

          }


          this.successMessage =
            `تمت إضافة ${member.fullName} إلى المشروع.`;
        },


        error: error => {

          this.addingProjectMember =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  removeProjectMember(
    member: ProjectMember
  ): void {

    if (
      this.addingProjectMember ||
      !this.selectedProject ||
      !this.canAddProjectMembers
    ) {

      return;
    }


    this.addingProjectMember =
      true;

    this.errorMessage =
      '';


    this.projectsService
      .removeMember(
        this.workspaceId,
        this.selectedProject.id,
        member.userId
      )
      .subscribe({

        next: () => {

          this.addingProjectMember =
            false;


          this.projectMembers =
            this.projectMembers.filter(
              current =>
                current.userId !==
                member.userId
            );


          if (
            this.selectedProject
          ) {

            this.projectMembersById = {
              ...this.projectMembersById,
              [this.selectedProject.id]:
                this.projectMembers
            };

          }


          this.successMessage =
            `تمت إزالة ${member.fullName} من المشروع.`;
        },


        error: error => {

          this.addingProjectMember =
            false;


          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
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
          'unexpected error occurred'
        )
        ||
        detail.includes(
          'Internal Server Error'
        )
      ) {

        return 'تعذر تحميل بيانات المشروع. يمكنك تعديل الاسم والمدير ثم الحفظ.';
      }


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
        detail.includes(
          'must be an active member of this workspace'
        )
      ) {

        return 'يمكن إضافة أعضاء من مساحة العمل الحالية فقط.';
      }


      if (
        detail.includes(
          'must be a member of this project'
        )
      ) {

        return 'يمكن إسناد المهمة لأعضاء المشروع أو أعضاء مساحة العمل بدور عضو.';
      }


      if (
        detail.includes(
          'already a member of this project'
        )
      ) {

        return 'هذا المستخدم عضو في المشروع بالفعل.';
      }


      if (
        detail.includes(
          'Only the workspace owner can add members'
        )
        ||
        detail.includes(
          'Only the workspace owner can remove members'
        )
      ) {

        return 'إضافة أعضاء المشروع متاحة لمالك مساحة العمل فقط.';
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