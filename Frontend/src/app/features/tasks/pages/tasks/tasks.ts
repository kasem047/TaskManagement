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
  CdkDragDrop,
  DragDropModule
} from '@angular/cdk/drag-drop';

import {
  Observable,
  map,
  of,
  switchMap
} from 'rxjs';

import {
  TaskDependency,
  TaskPriority,
  TaskPriorityValue,
  TaskStatus,
  TaskStatusValue,
  Tasks
} from '../../../../core/services/tasks';

import {
  BoardProject,
  BoardTask,
  BoardWorkspace,
  TaskBoardScope
} from '../../../../core/services/task-board-scope';

import {
  ActivityLogs,
  TaskActivityLog
} from '../../../../core/services/activity-logs';

import {
  TaskAssignee,
  TaskAssignees
} from '../../../../core/services/task-assignees';

import {
  WorkspaceMember,
  WorkspaceMembers
} from '../../../../core/services/workspace-members';

import {
  TaskInteraction
} from '../../components/task-interaction/task-interaction';


type DueFilter =
  | 'all'
  | 'overdue'
  | 'today'
  | 'week'
  | 'no-date';


type ScopeMode =
  | 'all'
  | 'workspace'
  | 'project'
  | 'custom';


type TaskPanel =
  | 'edit'
  | 'interaction'
  | 'history';


interface PendingStatusChange {

  task: BoardTask;

  targetStatus:
    TaskStatus;

  position: number;

  changeReason:
    string | null;
}


@Component({
  selector: 'app-tasks',

  imports: [
    ReactiveFormsModule,
    DragDropModule,
    TaskInteraction
  ],

  templateUrl: './tasks.html',

  styleUrl: './tasks.scss'
})
export class TasksPage
  implements OnInit {

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly tasksService =
    inject(Tasks);

  private readonly boardScope =
    inject(TaskBoardScope);

  private readonly activityLogs =
    inject(ActivityLogs);

  private readonly taskAssigneesService =
    inject(TaskAssignees);

  private readonly workspaceMembersService =
    inject(WorkspaceMembers);

  private readonly formBuilder =
    inject(FormBuilder);


  /* =========================
     ROUTE
     ========================= */

  workspaceId = 0;

  projectId = 0;

  workspaceName =
    'مساحة العمل';

  projectName =
    'المشروع';


  /* =========================
     BOARD
     ========================= */

  workspaces:
    BoardWorkspace[] = [];

  projects:
    BoardProject[] = [];

  tasks:
    BoardTask[] = [];


  loading =
    true;

  errorMessage =
    '';

  boardActionError =
    '';

  movingTaskId:
    number | null = null;


  /* =========================
     FILTERS
     ========================= */

  showFilters =
    false;

  scopeMode:
    ScopeMode = 'all';

  filterSearch =
    '';

  dueFilter:
    DueFilter = 'all';

  includeArchivedProjects =
    false;


  selectedWorkspaceIds =
    new Set<number>();

  selectedProjectIds =
    new Set<number>();

  selectedStatuses =
    new Set<TaskStatus>();

  selectedPriorities =
    new Set<TaskPriority>();


  /* =========================
     PAGINATION
     ========================= */

  readonly pageSize = 5;


  columnPages:
    Record<TaskStatus, number> = {

      Todo: 1,

      InProgress: 1,

      InReview: 1,

      Done: 1,

      Cancelled: 1

    };


  /* =========================
     CREATE
     ========================= */

  showCreateModal =
    false;

  creatingTask =
    false;

  createError =
    '';


  readonly createForm =
    this.formBuilder
      .nonNullable
      .group({

        workspaceId: [
          0,
          [
            Validators.required,
            Validators.min(1)
          ]
        ],

        projectId: [
          0,
          [
            Validators.required,
            Validators.min(1)
          ]
        ],

        title: [
          '',
          [
            Validators.required,
            Validators.maxLength(200)
          ]
        ],

        description: [
          ''
        ],

        priority: [
          2,
          Validators.required
        ],

        dueDate: [
          ''
        ]

      });


  /* =========================
     TASK PANEL
     ========================= */

  selectedTask:
    BoardTask | null = null;

  selectedTaskPanel:
    TaskPanel = 'edit';

  editingTask =
    false;

  editError =
    '';


  readonly editForm =
    this.formBuilder
      .nonNullable
      .group({

        title: [
          '',
          [
            Validators.required,
            Validators.maxLength(200)
          ]
        ],

        description: [
          ''
        ],

        priority: [
          2,
          Validators.required
        ],

        dueDate: [
          ''
        ],

        status:
          this.formBuilder
            .nonNullable
            .control<TaskStatus>(
              'Todo',
              Validators.required
            ),

        progressPercentage: [
          0
        ],

        progressNote: [
          ''
        ]

      });


  /* =========================
     ASSIGNEES
     ========================= */

  workspaceMembers:
    WorkspaceMember[] = [];

  assigneesLoading =
    false;

  assigneeError =
    '';

  assigneeActionUserId:
    number | null = null;

  showAssigneePicker =
    false;

  assigneeSearch =
    '';

  loadedMembersWorkspaceId:
    number | null = null;

  readonly assigneePickerLimit =
    8;


  /* =========================
     ASSIGNEE DRAFT
     ========================= */

  draftAssignee:
    TaskAssignee | null = null;

  originalAssigneeUserId:
    number | null = null;


  /* =========================
     DEPENDENCIES DRAFT
     ========================= */

  taskDependencies:
    TaskDependency[] = [];

  selectedDependencyIds =
    new Set<number>();

  initialDependencyIds =
    new Set<number>();

  dependenciesLoading =
    false;

  dependencyError =
    '';


  /* =========================
     HISTORY
     ========================= */

  taskHistory:
    TaskActivityLog[] = [];

  historyLoading =
    false;

  historyError =
    '';


  /* =========================
     PARTIAL COMPLETION
     ========================= */

  showProgressModal =
    false;

  pendingStatusChange:
    PendingStatusChange | null =
    null;

  savingProgress =
    false;

  progressError =
    '';


  readonly progressForm =
    this.formBuilder
      .nonNullable
      .group({

        percentage: [
          50,
          [
            Validators.required,
            Validators.min(1),
            Validators.max(99)
          ]
        ],

        note: [
          '',
          [
            Validators.required,
            Validators.minLength(3),
            Validators.maxLength(1000)
          ]
        ]

      });


  /* =========================
     ENUMS
     ========================= */

  readonly statusValues:
    Record<
      TaskStatus,
      TaskStatusValue
    > = {

      Todo: 1,

      InProgress: 2,

      InReview: 3,

      Done: 4,

      Cancelled: 5

    };


  readonly columns = [

    {
      status: 'Todo',
      label: 'للعمل'
    },

    {
      status: 'InProgress',
      label: 'قيد التنفيذ'
    },

    {
      status: 'InReview',
      label: 'مكتملة جزئيًا'
    },

    {
      status: 'Done',
      label: 'مكتملة'
    },

    {
      status: 'Cancelled',
      label: 'ملغاة'
    }

  ] as const;


  readonly priorities:
    {
      value: TaskPriority;
      label: string;
    }[] = [

      {
        value: 'Low',
        label: 'منخفضة'
      },

      {
        value: 'Medium',
        label: 'متوسطة'
      },

      {
        value: 'High',
        label: 'مرتفعة'
      },

      {
        value: 'Critical',
        label: 'حرجة'
      }

    ];


  /* =========================
     INIT
     ========================= */

  ngOnInit(): void {

    this.workspaceId =
      Number(
        this.route.snapshot
          .paramMap
          .get('workspaceId')
      );


    this.projectId =
      Number(
        this.route.snapshot
          .paramMap
          .get('projectId')
      );


    this.workspaceName =
      localStorage.getItem(
        'taskmanagement_workspace_name'
      ) ?? 'مساحة العمل';


    this.projectName =
      localStorage.getItem(
        'taskmanagement_project_name'
      ) ?? 'المشروع';


    if (
      !this.workspaceId ||
      !this.projectId
    ) {

      this.router.navigateByUrl(
        '/dashboard'
      );

      return;
    }


    this.useAllScope();

    this.loadTasks();
  }


  /* =========================
     LOAD BOARD
     ========================= */

  loadTasks(): void {

    this.loading =
      true;

    this.errorMessage =
      '';

    this.boardActionError =
      '';


    this.boardScope
      .loadAccessibleBoard()
      .subscribe({

        next: snapshot => {

          this.workspaces =
            snapshot.workspaces;

          this.projects =
            snapshot.projects;

          /*
           * Progress يأتي الآن من Backend مباشرة.
           * لم يعد هناك localStorage Progress.
           */
          this.tasks =
            snapshot.tasks;

          this.ensureValidPages();

          this.loading =
            false;
        },


        error: error => {

          console.error(
            'Board request failed:',
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


  /* =========================
     FILTERS
     ========================= */

  openFilters(): void {

    this.showFilters =
      true;
  }


  closeFilters(): void {

    this.showFilters =
      false;
  }


  useAllScope(): void {

    this.scopeMode =
      'all';

    this.selectedWorkspaceIds
      .clear();

    this.selectedProjectIds
      .clear();

    this.resetPagination();
  }


  useCurrentWorkspaceScope():
    void {

    this.scopeMode =
      'workspace';

    this.selectedWorkspaceIds =
      new Set([
        this.workspaceId
      ]);

    this.selectedProjectIds
      .clear();

    this.resetPagination();
  }


  useCurrentProjectScope():
    void {

    this.scopeMode =
      'project';

    this.selectedWorkspaceIds =
      new Set([
        this.workspaceId
      ]);

    this.selectedProjectIds =
      new Set([
        this.projectId
      ]);

    this.resetPagination();
  }


  clearAllFilters(): void {

    this.scopeMode =
      'all';

    this.filterSearch =
      '';

    this.dueFilter =
      'all';

    this.includeArchivedProjects =
      false;

    this.selectedWorkspaceIds
      .clear();

    this.selectedProjectIds
      .clear();

    this.selectedStatuses
      .clear();

    this.selectedPriorities
      .clear();

    this.resetPagination();
  }


  setFilterSearch(
    value: string
  ): void {

    this.filterSearch =
      value;

    this.resetPagination();
  }


  toggleWorkspace(
    workspaceId: number
  ): void {

    this.scopeMode =
      'custom';


    if (
      this.selectedWorkspaceIds
        .has(workspaceId)
    ) {

      this.selectedWorkspaceIds
        .delete(workspaceId);

    } else {

      this.selectedWorkspaceIds
        .add(workspaceId);
    }


    if (
      this.selectedWorkspaceIds
        .size > 0
    ) {

      const allowedProjects =
        new Set(
          this.projects
            .filter(
              project =>
                this.selectedWorkspaceIds
                  .has(
                    project.workspaceId
                  )
            )
            .map(
              project =>
                project.id
            )
        );


      for (
        const selectedProject
        of Array.from(
          this.selectedProjectIds
        )
      ) {

        if (
          !allowedProjects.has(
            selectedProject
          )
        ) {

          this.selectedProjectIds
            .delete(
              selectedProject
            );
        }
      }
    }


    this.resetPagination();
  }


  toggleProject(
    projectId: number
  ): void {

    this.scopeMode =
      'custom';


    if (
      this.selectedProjectIds
        .has(projectId)
    ) {

      this.selectedProjectIds
        .delete(projectId);

    } else {

      this.selectedProjectIds
        .add(projectId);
    }


    this.resetPagination();
  }


  toggleStatus(
    status: TaskStatus
  ): void {

    if (
      this.selectedStatuses
        .has(status)
    ) {

      this.selectedStatuses
        .delete(status);

    } else {

      this.selectedStatuses
        .add(status);
    }


    this.resetPagination();
  }


  togglePriority(
    priority: TaskPriority
  ): void {

    if (
      this.selectedPriorities
        .has(priority)
    ) {

      this.selectedPriorities
        .delete(priority);

    } else {

      this.selectedPriorities
        .add(priority);
    }


    this.resetPagination();
  }


  setDueFilter(
    value: DueFilter
  ): void {

    this.dueFilter =
      value;

    this.resetPagination();
  }


  setIncludeArchivedProjects(
    value: boolean
  ): void {

    this.includeArchivedProjects =
      value;

    this.resetPagination();
  }


  get availableProjects():
    BoardProject[] {

    if (
      this.selectedWorkspaceIds
        .size === 0
    ) {

      return this.projects;
    }


    return this.projects.filter(
      project =>
        this.selectedWorkspaceIds
          .has(
            project.workspaceId
          )
    );
  }


  get createProjects():
    BoardProject[] {

    const workspaceId =
      Number(
        this.createForm.controls
          .workspaceId.value
      );


    return this.projects.filter(
      project =>
        project.workspaceId ===
          workspaceId &&
        !project.isArchived
    );
  }


  onCreateWorkspaceChange():
    void {

    this.createForm.controls
      .projectId
      .setValue(
        this.createProjects[0]
          ?.id ?? 0
      );
  }


  get activeFilterCount():
    number {

    let count = 0;


    if (
      this.selectedWorkspaceIds
        .size > 0
    ) {
      count++;
    }


    if (
      this.selectedProjectIds
        .size > 0
    ) {
      count++;
    }


    if (
      this.selectedStatuses
        .size > 0
    ) {
      count++;
    }


    if (
      this.selectedPriorities
        .size > 0
    ) {
      count++;
    }


    if (
      this.filterSearch.trim()
    ) {
      count++;
    }


    if (
      this.dueFilter !== 'all'
    ) {
      count++;
    }


    if (
      this.includeArchivedProjects
    ) {
      count++;
    }


    return count;
  }


  /* =========================
     FILTERED TASKS
     ========================= */

  get filteredTasks():
    BoardTask[] {

    const query =
      this.normalizeSearch(
        this.filterSearch
      );


    return this.tasks.filter(
      task => {

        if (
          !this.includeArchivedProjects &&
          task.projectArchived
        ) {
          return false;
        }


        if (
          this.selectedWorkspaceIds
            .size > 0 &&
          !this.selectedWorkspaceIds
            .has(
              task.workspaceId
            )
        ) {
          return false;
        }


        if (
          this.selectedProjectIds
            .size > 0 &&
          !this.selectedProjectIds
            .has(
              task.projectId
            )
        ) {
          return false;
        }


        if (
          this.selectedStatuses
            .size > 0 &&
          !this.selectedStatuses
            .has(
              task.status
            )
        ) {
          return false;
        }


        if (
          this.selectedPriorities
            .size > 0 &&
          !this.selectedPriorities
            .has(
              task.priority
            )
        ) {
          return false;
        }


        if (query) {

          const searchable =
            this.normalizeSearch(
              [
                task.id,
                task.title,
                task.description ?? '',
                task.workspaceName,
                task.projectName,
                ...task.assignees.map(
                  assignee =>
                    assignee.userFullName
                )
              ].join(' ')
            );


          if (
            !searchable.includes(
              query
            )
          ) {
            return false;
          }
        }


        return this.matchesDueFilter(
          task
        );
      }
    );
  }


  tasksByStatus(
    status: TaskStatus
  ): BoardTask[] {

    return this.filteredTasks
      .filter(
        task =>
          task.status ===
          status
      )
      .sort(
        (a, b) =>
          a.position -
          b.position
      );
  }


  /* =========================
     PAGINATION
     ========================= */

  pagedTasksByStatus(
    status: TaskStatus
  ): BoardTask[] {

    const tasks =
      this.tasksByStatus(
        status
      );


    const start =
      (
        this.columnPages[
          status
        ] - 1
      ) *
      this.pageSize;


    return tasks.slice(
      start,
      start +
      this.pageSize
    );
  }


  columnPageCount(
    status: TaskStatus
  ): number {

    return Math.max(
      1,
      Math.ceil(
        this.tasksByStatus(
          status
        ).length /
        this.pageSize
      )
    );
  }


  previousColumnPage(
    status: TaskStatus
  ): void {

    if (
      this.columnPages[
        status
      ] <= 1
    ) {
      return;
    }


    this.columnPages = {

      ...this.columnPages,

      [status]:
        this.columnPages[
          status
        ] - 1

    };
  }


  nextColumnPage(
    status: TaskStatus
  ): void {

    if (
      this.columnPages[
        status
      ] >=
      this.columnPageCount(
        status
      )
    ) {
      return;
    }


    this.columnPages = {

      ...this.columnPages,

      [status]:
        this.columnPages[
          status
        ] + 1

    };
  }


  private resetPagination():
    void {

    this.columnPages = {

      Todo: 1,

      InProgress: 1,

      InReview: 1,

      Done: 1,

      Cancelled: 1

    };
  }


  private ensureValidPages():
    void {

    for (
      const column of this.columns
    ) {

      this.columnPages[
        column.status
      ] =
        Math.min(
          this.columnPages[
            column.status
          ],
          this.columnPageCount(
            column.status
          )
        );
    }
  }


  /* =========================
     DRAG DROP
     ========================= */

  dropTask(
    event:
      CdkDragDrop<BoardTask[]>,
    targetStatus:
      TaskStatus
  ): void {

    const task =
      event.item.data as
        BoardTask;


    if (
      !task ||
      this.movingTaskId !==
        null
    ) {
      return;
    }


    this.boardActionError =
      '';


    if (
      task.projectArchived
    ) {

      this.boardActionError =
        'لا يمكن تعديل مهام مشروع مؤرشف.';

      return;
    }


    if (
      !this.canMoveTask(
        task,
        targetStatus
      )
    ) {

      this.boardActionError =
        'لا تسمح صلاحيتك بنقل المهمة إلى هذه الحالة.';

      return;
    }


    const position =
      task.status ===
        targetStatus

        ? event.currentIndex + 1

        : this.nextPosition(
            task.projectId,
            targetStatus
          );


    const reasonResult =
      this.resolveStatusChangeReason(
        task,
        targetStatus
      );


    if (!reasonResult.allowed) {
      return;
    }


    if (
      targetStatus ===
        'InReview' &&
      task.status !==
        'InReview'
    ) {

      this.requestPartialCompletion(
        task,
        position,
        reasonResult.reason
      );

      return;
    }


    this.commitStatusChange(
      task,
      targetStatus,
      position,
      undefined,
      undefined,
      undefined,
      reasonResult.reason
    );
  }


  private requestPartialCompletion(
    task: BoardTask,
    position: number,
    changeReason:
      string | null = null
  ): void {

    this.pendingStatusChange = {

      task,

      targetStatus:
        'InReview',

      position,

      changeReason

    };


    this.progressError =
      '';


    this.progressForm.reset({

      percentage:
        task.progressPercentage
        ?? 50,

      note:
        task.progressNote
        ?? ''

    });


    this.showProgressModal =
      true;
  }


  closeProgressModal():
    void {

    if (
      this.savingProgress
    ) {
      return;
    }


    this.showProgressModal =
      false;

    this.pendingStatusChange =
      null;

    this.progressError =
      '';
  }


  confirmPartialCompletion():
    void {

    if (
      !this.pendingStatusChange ||
      this.savingProgress
    ) {
      return;
    }


    if (
      this.progressForm.invalid
    ) {

      this.progressForm
        .markAllAsTouched();

      return;
    }


    const value =
      this.progressForm
        .getRawValue();


    const percentage =
      Number(
        value.percentage
      );


    const note =
      value.note.trim();


    if (
      percentage < 1 ||
      percentage > 99
    ) {

      this.progressError =
        'نسبة الإنجاز الجزئي يجب أن تكون بين 1% و99%.';

      return;
    }


    if (
      note.length < 3
    ) {

      this.progressError =
        'يجب كتابة توضيح لما تم إنجازه.';

      return;
    }


    const pending =
      this.pendingStatusChange;


    this.savingProgress =
      true;


    this.commitStatusChange(
      pending.task,
      pending.targetStatus,
      pending.position,
      {
        percentage,
        note
      },
      () => {

        this.savingProgress =
          false;

        this.showProgressModal =
          false;

        this.pendingStatusChange =
          null;

      },
      () => {

        this.savingProgress =
          false;

      },
      pending.changeReason
    );
  }


  private commitStatusChange(
    task: BoardTask,
    targetStatus: TaskStatus,
    position: number,
    progress?: {
      percentage: number;
      note: string;
    },
    successCallback?: () => void,
    errorCallback?: () => void,
    changeReason:
      string | null = null
  ): void {

    /*
     * حتى عند إعادة ترتيب مهمة داخل
     * عمود "مكتملة جزئيًا"، Backend
     * يحتاج ProgressPercentage + ProgressNote.
     */
    const progressPercentage =
      targetStatus ===
        'InReview'

        ? (
            progress?.percentage
            ?? task.progressPercentage
            ?? null
          )

        : null;


    const progressNote =
      targetStatus ===
        'InReview'

        ? (
            progress?.note
            ?? task.progressNote
            ?? null
          )

        : null;


    if (
      targetStatus ===
        'InReview' &&
      (
        progressPercentage ===
          null ||
        !progressNote
      )
    ) {

      this.boardActionError =
        'يجب تحديد نسبة الإنجاز وتوضيح ما تم إنجازه.';

      errorCallback?.();

      return;
    }


    this.movingTaskId =
      task.id;


    this.tasksService
      .updateStatus(
        task.workspaceId,
        task.projectId,
        task.id,
        {

          status:
            this.statusValues[
              targetStatus
            ],

          position,

          progressPercentage,

          progressNote,

          changeReason

        }
      )
      .subscribe({

        next: updated => {

          /*
           * updated يحتوي الآن على Progress
           * الحقيقي القادم من قاعدة البيانات.
           */
          const merged:
            BoardTask = {

            ...task,

            ...updated

          };


          this.replaceTask(
            merged
          );


          this.movingTaskId =
            null;

          this.ensureValidPages();

          successCallback?.();
        },


        error: error => {

          console.error(
            'Move task failed:',
            error
          );


          this.boardActionError =
            this.extractApiError(
              error
            );


          this.movingTaskId =
            null;

          errorCallback?.();
        }

      });
  }


  canSelectStatus(
    task: BoardTask | null,
    targetStatus: TaskStatus
  ): boolean {

    if (!task) {
      return false;
    }


    return this.canMoveTask(
      task,
      targetStatus
    );
  }


  private canMoveTask(
    task: BoardTask,
    targetStatus: TaskStatus
  ): boolean {

    if (
      task.status ===
      targetStatus
    ) {
      return true;
    }


    /*
     * لا يمكن تغيير حالة مهمة
     * قبل إسنادها لمستخدم.
     *
     * داخل نافذة التعديل نعتمد
     * المسؤول المؤقت Draft، أما
     * السحب على اللوحة فيعتمد
     * المسؤول المحفوظ فعليًا.
     */
    const hasAssignee =
      (
        this.selectedTask?.id ===
          task.id &&
        this.selectedTaskPanel ===
          'edit'
      )
        ? this.draftAssignee !==
            null
        : task.assignees.length >
            0;


    if (!hasAssignee) {
      return false;
    }


    const role =
      task.workspaceRole;


    if (
      role ===
        'WorkspaceOwner' ||
      role ===
        'Owner' ||
      role ===
        'ProjectManager'
    ) {

      return true;
    }


    if (
      role === 'Member'
    ) {

      if (
        task.status ===
          'Done' ||
        task.status ===
          'Cancelled' ||
        targetStatus ===
          'Cancelled'
      ) {

        return false;
      }


      if (
        task.status ===
          'Todo'
      ) {

        return (
          targetStatus ===
          'InProgress'
        );
      }


      if (
        task.status ===
          'InProgress'
      ) {

        return (
          targetStatus ===
            'InReview' ||
          targetStatus ===
            'Done'
        );
      }


      if (
        task.status ===
          'InReview'
      ) {

        return (
          targetStatus ===
          'Done'
        );
      }
    }


    return false;
  }


  private resolveStatusChangeReason(
    task: BoardTask,
    targetStatus: TaskStatus
  ): {
    allowed: boolean;
    reason: string | null;
  } {

    if (
      !this.requiresStatusChangeReason(
        task.status,
        targetStatus
      )
    ) {

      return {
        allowed: true,
        reason: null
      };
    }


    const value =
      window.prompt(
        `سبب تغيير حالة المهمة من «${this.statusLabel(task.status)}» إلى «${this.statusLabel(targetStatus)}»:`
      );


    if (value === null) {

      return {
        allowed: false,
        reason: null
      };
    }


    const reason =
      value.trim();


    if (
      reason.length < 3
    ) {

      this.boardActionError =
        'يجب كتابة سبب واضح للإرجاع أو إعادة فتح المهمة.';

      return {
        allowed: false,
        reason: null
      };
    }


    return {
      allowed: true,
      reason
    };
  }


  private requiresStatusChangeReason(
    currentStatus: TaskStatus,
    targetStatus: TaskStatus
  ): boolean {

    if (
      currentStatus ===
        targetStatus
    ) {
      return false;
    }


    /*
     * يجب أن يطابق ترتيب Backend:
     * الخروج من Done أو Cancelled يحتاج سببًا.
     */
    if (
      currentStatus ===
        'Done' ||
      currentStatus ===
        'Cancelled'
    ) {
      return true;
    }


    /*
     * الإلغاء من حالة غير نهائية
     * لا يحتاج سببًا حسب القواعد الحالية.
     */
    if (
      targetStatus ===
        'Cancelled'
    ) {
      return false;
    }


    return (
      this.statusRank(
        targetStatus
      )
      <
      this.statusRank(
        currentStatus
      )
    );
  }


  private statusRank(
    status: TaskStatus
  ): number {

    switch (
      status
    ) {

      case 'Todo':
        return 1;

      case 'InProgress':
        return 2;

      case 'InReview':
        return 3;

      case 'Done':
        return 4;

      case 'Cancelled':
        return 5;
    }
  }


  private nextPosition(
    projectId: number,
    status: TaskStatus
  ): number {

    const positions =
      this.tasks
        .filter(
          task =>
            task.projectId ===
              projectId &&
            task.status ===
              status
        )
        .map(
          task =>
            task.position
        );


    return positions.length === 0
      ? 1
      : Math.max(
          ...positions
        ) + 1;
  }


  /* =========================
     OVERDUE
     ========================= */

  isOverdue(
    task: BoardTask
  ): boolean {

    if (
      !task.dueDate ||
      task.status ===
        'Done' ||
      task.status ===
        'Cancelled'
    ) {
      return false;
    }


    return (
      new Date(
        task.dueDate
      ).getTime()
      <
      Date.now()
    );
  }


  overdueDays(
    task: BoardTask
  ): number {

    if (
      !task.dueDate ||
      !this.isOverdue(
        task
      )
    ) {
      return 0;
    }


    return Math.max(
      1,
      Math.floor(
        (
          Date.now() -
          new Date(
            task.dueDate
          ).getTime()
        ) /
        86_400_000
      )
    );
  }


  /* =========================
     PROGRESS
     ========================= */

  shouldShowProgress(
    task: BoardTask
  ): boolean {

    return (
      (
        task.status ===
          'InReview' ||
        task.hasDependencies ===
          true
      )
      &&
      task.progressPercentage !==
        null &&
      task.progressPercentage !==
        undefined
    );
  }


  needsProgressInfo(
    task: BoardTask
  ): boolean {

    return (
      task.status ===
        'InReview' &&
      (
        task.progressPercentage ===
          null ||
        task.progressPercentage ===
          undefined
      )
    );
  }


  taskProgress(
    task: BoardTask
  ): number {

    if (
      task.status ===
      'Done'
    ) {
      return 100;
    }


    return Math.max(
      0,
      Math.min(
        100,
        task.progressPercentage
        ?? 0
      )
    );
  }


  /* =========================
     ASSIGNEES DISPLAY
     ========================= */

  assigneeSummary(
    task: BoardTask
  ): string {

    if (
      task.assignees.length === 0
    ) {

      return 'غير مسندة';
    }


    if (
      task.assignees.length === 1
    ) {

      return task.assignees[0]
        .userFullName;
    }


    return (
      `${task.assignees[0].userFullName} +${task.assignees.length - 1}`
    );
  }


  assigneeNames(
    task: BoardTask
  ): string {

    if (
      task.assignees.length === 0
    ) {

      return 'المهمة غير مسندة';
    }


    return task.assignees
      .map(
        assignee =>
          assignee.userFullName
      )
      .join('، ');
  }


  /* =========================
     ASSIGNEE PICKER
     ========================= */

  canManageAssignees(
    task:
      BoardTask | null
  ): boolean {

    if (!task) {
      return false;
    }


    if (
      task.projectArchived
    ) {
      return false;
    }


    return (
      task.workspaceRole ===
        'WorkspaceOwner' ||
      task.workspaceRole ===
        'Owner' ||
      task.workspaceRole ===
        'ProjectManager'
    );
  }


  openAssigneePicker():
    void {

    const task =
      this.selectedTask;


    if (!task) {
      return;
    }


    if (
      !this.canManageAssignees(
        task
      )
    ) {

      this.assigneeError =
        'لا تملك صلاحية تعديل مسؤول هذه المهمة.';

      return;
    }


    this.showAssigneePicker =
      true;

    this.assigneeSearch =
      '';

    this.assigneeError =
      '';


    if (
      this.loadedMembersWorkspaceId ===
        task.workspaceId &&
      this.workspaceMembers.length >
        0
    ) {
      return;
    }


    this.loadWorkspaceMembers(
      task
    );
  }


  closeAssigneePicker():
    void {

    this.showAssigneePicker =
      false;

    this.assigneeSearch =
      '';

    this.assigneeError =
      '';
  }


  setAssigneeSearch(
    value: string
  ): void {

    this.assigneeSearch =
      value;
  }


  reloadAssigneeMembers():
    void {

    if (
      !this.selectedTask
    ) {
      return;
    }


    this.loadedMembersWorkspaceId =
      null;

    this.workspaceMembers =
      [];


    this.loadWorkspaceMembers(
      this.selectedTask
    );
  }


  private loadWorkspaceMembers(
    task: BoardTask
  ): void {

    this.assigneesLoading =
      true;

    this.assigneeError =
      '';


    this.workspaceMembersService
      .getByWorkspace(
        task.workspaceId
      )
      .subscribe({

        next: (
          members:
            WorkspaceMember[]
        ) => {

          this.workspaceMembers =
            [...members]
              .sort(
                (a, b) =>
                  a.fullName
                    .localeCompare(
                      b.fullName,
                      'ar'
                    )
              );


          this.loadedMembersWorkspaceId =
            task.workspaceId;


          this.assigneesLoading =
            false;
        },


        error: (
          error: any
        ) => {

          console.error(
            'Workspace members failed:',
            error
          );


          this.assigneeError =
            this.extractApiError(
              error
            );


          this.assigneesLoading =
            false;
        }

      });
  }


  private availableAssignableMembers():
    WorkspaceMember[] {

    const task =
      this.selectedTask;


    if (!task) {
      return [];
    }


    const query =
      this.normalizeSearch(
        this.assigneeSearch
      );


    return this.workspaceMembers
      .filter(
        member =>
          member.userId !==
          this.draftAssignee?.userId
      )
      .filter(
        member => {

          if (!query) {
            return true;
          }


          const searchable =
            this.normalizeSearch(
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


  get visibleAssignableMembers():
    WorkspaceMember[] {

    return this
      .availableAssignableMembers()
      .slice(
        0,
        this.assigneePickerLimit
      );
  }


  get assignableMatchCount():
    number {

    return this
      .availableAssignableMembers()
      .length;
  }


  selectAssignee(
    member:
      WorkspaceMember
  ): void {

    const task =
      this.selectedTask;


    if (!task) {
      return;
    }


    if (
      !this.canManageAssignees(
        task
      )
    ) {

      this.assigneeError =
        'لا تملك صلاحية تعديل مسؤول هذه المهمة.';

      return;
    }


    /*
     * Draft فقط.
     * لا يتم استدعاء Backend هنا.
     */
    this.draftAssignee = {

      id: 0,

      taskItemId:
        task.id,

      userId:
        member.userId,

      userFullName:
        member.fullName,

      assignedAt:
        new Date()
          .toISOString()

    };


    this.showAssigneePicker =
      false;

    this.assigneeSearch =
      '';

    this.assigneeError =
      '';
  }


  removeAssignedUser(
    userId: number
  ): void {

    const task =
      this.selectedTask;


    if (!task) {
      return;
    }


    if (
      !this.canManageAssignees(
        task
      )
    ) {

      this.assigneeError =
        'لا تملك صلاحية إزالة مسؤول هذه المهمة.';

      return;
    }


    if (
      this.draftAssignee?.userId !==
      userId
    ) {
      return;
    }


    /*
     * Draft فقط.
     * الإزالة الحقيقية تحصل عند الحفظ.
     */
    this.draftAssignee =
      null;

    this.assigneeError =
      '';
  }


  /* =========================
     TASK DEPENDENCIES
     ========================= */

  private loadTaskDependencies(
    task: BoardTask
  ): void {

    this.dependenciesLoading =
      true;

    this.dependencyError =
      '';

    this.taskDependencies =
      [];

    this.selectedDependencyIds =
      new Set<number>();

    this.initialDependencyIds =
      new Set<number>();


    this.tasksService
      .getDependencies(
        task.workspaceId,
        task.projectId,
        task.id
      )
      .subscribe({

        next: dependencies => {

          this.taskDependencies =
            dependencies;


          const ids =
            dependencies.map(
              dependency =>
                dependency.dependsOnTaskId
            );


          this.selectedDependencyIds =
            new Set(ids);

          this.initialDependencyIds =
            new Set(ids);

          this.dependenciesLoading =
            false;
        },


        error: error => {

          console.error(
            'Task dependencies failed:',
            error
          );


          this.dependencyError =
            this.extractApiError(
              error
            );

          this.dependenciesLoading =
            false;
        }

      });
  }


  canEditDependencies(
    task:
      BoardTask | null
  ): boolean {

    if (!task) {
      return false;
    }


    return (
      task.status ===
        'Todo' &&
      this.canManageAssignees(
        task
      )
    );
  }


  get dependencyCandidateTasks():
    BoardTask[] {

    const task =
      this.selectedTask;


    if (!task) {
      return [];
    }


    return this.tasks
      .filter(
        candidate =>
          candidate.projectId ===
            task.projectId &&
          candidate.id !==
            task.id &&
          !candidate.projectArchived &&
          candidate.status !==
            'Cancelled'
      )
      .sort(
        (a, b) =>
          a.title.localeCompare(
            b.title,
            'ar'
          )
      );
  }


  get dependencyDisplayTasks():
    BoardTask[] {

    const task =
      this.selectedTask;


    if (!task) {
      return [];
    }


    /*
     * قبل بدء المهمة نعرض كل المرشحين.
     * بعد بدء المهمة نعرض الاعتماديات
     * المسجلة فقط بشكل Read-only.
     */
    if (
      this.canEditDependencies(
        task
      )
    ) {
      return this.dependencyCandidateTasks;
    }


    return this.tasks
      .filter(
        candidate =>
          candidate.projectId ===
            task.projectId &&
          this.selectedDependencyIds
            .has(
              candidate.id
            )
      )
      .sort(
        (a, b) =>
          a.title.localeCompare(
            b.title,
            'ar'
          )
      );
  }


  isDependencySelected(
    taskId: number
  ): boolean {

    return this
      .selectedDependencyIds
      .has(
        taskId
      );
  }


  toggleDependency(
    taskId: number
  ): void {

    const task =
      this.selectedTask;


    if (
      !this.canEditDependencies(
        task
      )
    ) {

      this.dependencyError =
        'يمكن تعديل اعتماديات المهمة فقط عندما تكون حالتها «للعمل».';

      return;
    }


    const candidate =
      this.tasks.find(
        item =>
          item.id === taskId
      );


    if (
      !candidate ||
      candidate.status ===
        'Cancelled'
    ) {

      this.dependencyError =
        'لا يمكن اعتماد مهمة ملغاة.';

      return;
    }


    const next =
      new Set(
        this.selectedDependencyIds
      );


    if (
      next.has(
        taskId
      )
    ) {
      next.delete(
        taskId
      );
    } else {
      next.add(
        taskId
      );
    }


    this.selectedDependencyIds =
      next;

    this.dependencyError =
      '';
  }


  selectedDependenciesCount():
    number {

    return this
      .selectedDependencyIds
      .size;
  }


  private selectedDependenciesSatisfied():
    boolean {

    for (
      const dependencyId
      of this.selectedDependencyIds
    ) {

      const dependencyTask =
        this.tasks.find(
          task =>
            task.id ===
              dependencyId
        );


      if (
        !dependencyTask ||
        dependencyTask.status !==
          'Done'
      ) {
        return false;
      }
    }


    return true;
  }


  private dependencySetsEqual():
    boolean {

    if (
      this.initialDependencyIds.size !==
      this.selectedDependencyIds.size
    ) {
      return false;
    }


    for (
      const dependencyId
      of this.initialDependencyIds
    ) {

      if (
        !this.selectedDependencyIds
          .has(
            dependencyId
          )
      ) {
        return false;
      }
    }


    return true;
  }


  private persistDependencyDraft(
    task: BoardTask
  ): Observable<unknown> {

    if (
      this.dependencySetsEqual()
    ) {
      return of(
        this.taskDependencies
      );
    }


    if (
      !this.canEditDependencies(
        task
      )
    ) {

      this.selectedDependencyIds =
        new Set(
          this.initialDependencyIds
        );

      return of(
        this.taskDependencies
      );
    }


    return this.tasksService
      .setDependencies(
        task.workspaceId,
        task.projectId,
        task.id,
        Array.from(
          this.selectedDependencyIds
        )
      );
  }


  private persistAssigneeBeforeStatus(
    task: BoardTask
  ): Observable<unknown> {

    const draftUserId =
      this.draftAssignee
        ?.userId
      ?? null;


    if (
      draftUserId ===
      this.originalAssigneeUserId
    ) {
      return of(null);
    }


    if (
      draftUserId !==
      null
    ) {

      return this
        .taskAssigneesService
        .assign(
          task.workspaceId,
          task.projectId,
          task.id,
          draftUserId
        );
    }


    return of(null);
  }


  private persistAssigneeRemovalAfterStatus(
    task: BoardTask
  ): Observable<unknown> {

    const draftUserId =
      this.draftAssignee
        ?.userId
      ?? null;


    if (
      draftUserId !== null ||
      this.originalAssigneeUserId ===
        null
    ) {
      return of(null);
    }


    return this
      .taskAssigneesService
      .remove(
        task.workspaceId,
        task.projectId,
        task.id,
        this.originalAssigneeUserId
      );
  }


  /* =========================
     CREATE
     ========================= */

  openCreateModal(): void {

    let targetWorkspaceId =
      this.workspaceId;

    let targetProjectId =
      this.projectId;


    if (
      this.selectedWorkspaceIds
        .size === 1
    ) {

      targetWorkspaceId =
        Array.from(
          this.selectedWorkspaceIds
        )[0];
    }


    if (
      this.selectedProjectIds
        .size === 1
    ) {

      targetProjectId =
        Array.from(
          this.selectedProjectIds
        )[0];


      const project =
        this.projects.find(
          item =>
            item.id ===
            targetProjectId
        );


      if (project) {

        targetWorkspaceId =
          project.workspaceId;
      }
    }


    this.createForm.reset({

      workspaceId:
        targetWorkspaceId,

      projectId:
        targetProjectId,

      title: '',

      description: '',

      priority: 2,

      dueDate: ''

    });


    if (
      !this.createProjects.some(
        project =>
          project.id ===
          targetProjectId
      )
    ) {

      this.onCreateWorkspaceChange();
    }


    this.createError =
      '';

    this.showCreateModal =
      true;
  }


  closeCreateModal(): void {

    if (
      this.creatingTask
    ) {
      return;
    }


    this.showCreateModal =
      false;
  }


  createTask(): void {

    if (
      this.createForm.invalid ||
      this.creatingTask
    ) {

      this.createForm
        .markAllAsTouched();

      return;
    }


    const value =
      this.createForm
        .getRawValue();


    const workspaceId =
      Number(
        value.workspaceId
      );

    const projectId =
      Number(
        value.projectId
      );


    this.creatingTask =
      true;

    this.createError =
      '';


    this.tasksService
      .create(
        workspaceId,
        projectId,
        {

          title:
            value.title.trim(),

          description:
            value.description.trim()
              || null,

          priority:
            Number(
              value.priority
            ) as TaskPriorityValue,

          dueDate:
            value.dueDate
              ? new Date(
                  value.dueDate
                ).toISOString()
              : null

        }
      )
      .subscribe({

        next: task => {

          const workspace =
            this.workspaces.find(
              item =>
                item.id ===
                workspaceId
            );


          const project =
            this.projects.find(
              item =>
                item.id ===
                projectId
            );


          this.tasks = [
            ...this.tasks,
            {

              ...task,

              workspaceId,

              workspaceName:
                workspace?.name
                ?? 'مساحة العمل',

              projectName:
                project?.name
                ?? 'المشروع',

              workspaceRole:
                workspace
                  ?.currentUserRole
                ?? '',

              projectArchived:
                project
                  ?.isArchived
                ?? false,

              assignees: []

            }
          ];


          this.creatingTask =
            false;

          this.showCreateModal =
            false;

          this.ensureValidPages();
        },


        error: error => {

          this.createError =
            this.extractApiError(
              error
            );

          this.creatingTask =
            false;
        }

      });
  }


  /* =========================
     TASK PANEL
     ========================= */

  openTaskPanel(
    task: BoardTask,
    panel: TaskPanel
  ): void {

    this.selectedTask =
      task;

    this.selectedTaskPanel =
      panel;

    this.editError =
      '';

    this.assigneeError =
      '';

    this.assigneeActionUserId =
      null;

    this.showAssigneePicker =
      false;

    this.assigneeSearch =
      '';

    this.historyError =
      '';

    this.taskHistory =
      [];

    this.dependencyError =
      '';


    if (
      panel === 'history'
    ) {

      this.loadTaskHistory(
        task
      );

      return;
    }


    if (
      panel !== 'edit'
    ) {
      return;
    }


    const currentAssignee =
      task.assignees[0]
      ?? null;


    this.draftAssignee =
      currentAssignee
        ? {
            ...currentAssignee
          }
        : null;


    this.originalAssigneeUserId =
      currentAssignee
        ?.userId
      ?? null;


    this.editForm.reset({

      title:
        task.title,

      description:
        task.description
        ?? '',

      priority:
        this.priorityToValue(
          task.priority
        ),

      dueDate:
        this.toDateTimeLocal(
          task.dueDate
        ),

      status:
        task.status,

      progressPercentage:
        task.progressPercentage
        ?? 0,

      progressNote:
        task.progressNote
        ?? ''

    });


    this.loadTaskDependencies(
      task
    );
  }


  closeTaskPanel(): void {

    if (
      this.editingTask
    ) {
      return;
    }


    this.selectedTask =
      null;

    this.draftAssignee =
      null;

    this.originalAssigneeUserId =
      null;

    this.showAssigneePicker =
      false;

    this.assigneeSearch =
      '';

    this.assigneeError =
      '';

    this.assigneeActionUserId =
      null;

    this.workspaceMembers =
      [];

    this.loadedMembersWorkspaceId =
      null;

    this.taskDependencies =
      [];

    this.selectedDependencyIds =
      new Set<number>();

    this.initialDependencyIds =
      new Set<number>();

    this.dependenciesLoading =
      false;

    this.dependencyError =
      '';

    this.taskHistory =
      [];

    this.historyLoading =
      false;

    this.historyError =
      '';

    this.editError =
      '';
  }


  /* =========================
     REAL TASK HISTORY
     ========================= */

  loadTaskHistory(
    task: BoardTask
  ): void {

    this.historyLoading =
      true;

    this.historyError =
      '';

    this.taskHistory =
      [];


    this.activityLogs
      .getTaskHistory(
        task.workspaceId,
        task.projectId,
        task.id
      )
      .subscribe({

        next: logs => {

          this.taskHistory =
            logs;

          this.historyLoading =
            false;
        },


        error: error => {

          console.error(
            'Task history failed:',
            error
          );


          this.historyError =
            this.extractApiError(
              error
            );

          this.historyLoading =
            false;
        }

      });
  }


  historyTitle(
    log: TaskActivityLog
  ): string {

    switch (
      log.action
    ) {

      case 'task.created':
        return 'إنشاء المهمة';

      case 'task.updated':
        return 'تعديل تفاصيل المهمة';

      case 'task.status_changed':
        return 'تغيير حالة المهمة';

      case 'task.position_changed':
        return 'تغيير ترتيب المهمة';

      case 'task.progress_updated':
        return 'تحديث نسبة الإنجاز';

      case 'comment.created':
        return 'إضافة تعليق';

      case 'comment.updated':
        return 'تعديل تعليق';

      case 'comment.deleted':
        return 'حذف تعليق';

      case 'attachment.uploaded':
        return 'رفع مرفق';

      case 'attachment.deleted':
        return 'حذف مرفق';

      case 'task.assignee_added':
      case 'task.assigned':
        return 'إسناد المهمة';

      case 'task.assignee_removed':
      case 'task.unassigned':
        return 'إزالة إسناد';

      case 'task.deleted':
        return 'حذف المهمة';

      default:

        if (
          log.action
            .toLowerCase()
            .includes(
              'assignee'
            )
        ) {

          return log.action
            .toLowerCase()
            .includes(
              'remove'
            )
            ? 'إزالة إسناد'
            : 'إسناد المهمة';
        }


        if (
          log.action
            .toLowerCase()
            .includes(
              'comment'
            )
        ) {

          return 'نشاط على تعليق';
        }


        if (
          log.action
            .toLowerCase()
            .includes(
              'attachment'
            )
        ) {

          return 'نشاط على مرفق';
        }


        return 'نشاط على المهمة';
    }
  }


  historyDescription(
    log: TaskActivityLog
  ): string {

    if (
      log.targetUserFullName
    ) {

      const isRemoval =
        log.action
          .toLowerCase()
          .includes(
            'remove'
          ) ||
        log.action
          .toLowerCase()
          .includes(
            'unassign'
          );


      return isRemoval
        ? `أزال إسناد المهمة عن ${log.targetUserFullName}.`
        : `أسند المهمة إلى ${log.targetUserFullName}.`;
    }


    if (
      log.action ===
      'task.progress_updated'
    ) {

      return this.translateProgressChange(
        log.description
      );
    }


    if (
      log.action ===
      'task.status_changed'
    ) {

      const translated =
        this.translateStatusChange(
          log.description
        );


      if (translated) {
        return translated;
      }


      return 'تم تغيير حالة المهمة.';
    }


    if (
      log.action ===
      'task.created'
    ) {

      return 'تم إنشاء المهمة.';
    }


    if (
      log.action ===
      'task.updated'
    ) {

      return 'تم تعديل بيانات المهمة.';
    }


    if (
      log.action ===
      'task.position_changed'
    ) {

      return 'تم تغيير ترتيب المهمة داخل اللوحة.';
    }


    return (
      log.description
      ?? 'تم تنفيذ إجراء على المهمة.'
    );
  }


  private translateProgressChange(
    description:
      string | null
  ): string {

    if (!description) {

      return 'تم تحديث نسبة إنجاز المهمة.';
    }


    const match =
      description.match(
        /Recorded task progress at\s+(\d+)%\.\s*(?:Progress note:\s*)?(.*)?/i
      );


    if (!match) {

      return description;
    }


    const percentage =
      match[1];

    const note =
      match[2]
        ?.trim();


    return note
      ? `تم تسجيل إنجاز جزئي بنسبة ${percentage}%: ${note}`
      : `تم تسجيل إنجاز جزئي بنسبة ${percentage}%.`;
  }


  private translateStatusChange(
    description:
      string | null
  ): string | null {

    if (!description) {
      return null;
    }


    const match =
      description.match(
        /from\s+(\w+)\s+to\s+(\w+)/i
      );


    if (
      !match
    ) {
      return null;
    }


    const from =
      this.statusLabelFromString(
        match[1]
      );

    const to =
      this.statusLabelFromString(
        match[2]
      );


    const reasonMatch =
      description.match(
        /Reason:\s*(.+)$/i
      );


    const reason =
      reasonMatch?.[1]
        ?.trim();


    if (reason) {

      return (
        `غيّر حالة المهمة من «${from}» إلى «${to}». السبب: ${reason}`
      );
    }


    return (
      `غيّر حالة المهمة من «${from}» إلى «${to}».`
    );
  }


  private statusLabelFromString(
    status: string
  ): string {

    switch (
      status
    ) {

      case 'Todo':
        return 'للعمل';

      case 'InProgress':
        return 'قيد التنفيذ';

      case 'InReview':
      case 'PartiallyCompleted':
        return 'مكتملة جزئيًا';

      case 'Done':
        return 'مكتملة';

      case 'Cancelled':
        return 'ملغاة';

      default:
        return status;
    }
  }

  /* =========================
     EDIT
     ========================= */

  saveTaskChanges(): void {

    if (
      !this.selectedTask ||
      this.editingTask
    ) {
      return;
    }


    if (
      this.editForm.invalid
    ) {

      this.editForm
        .markAllAsTouched();

      return;
    }


    if (
      this.dependenciesLoading
    ) {

      this.editError =
        'انتظر حتى ينتهي تحميل اعتماديات المهمة.';

      return;
    }


    if (
      this.dependencyError
    ) {

      this.editError =
        'تعذر تحميل اعتماديات المهمة. أغلق النافذة وافتحها من جديد ثم حاول مرة أخرى.';

      return;
    }


    const value =
      this.editForm
        .getRawValue();


    const currentTask =
      this.selectedTask;


    const requestedStatus =
      value.status;


    const statusChanged =
      requestedStatus !==
      currentTask.status;


    /*
     * نحافظ على قيمة الموعد الأصلية
     * إذا لم يغيرها المستخدم.
     *
     * هذا مهم خصوصًا للمهام القديمة
     * التي أصبح موعدها في الماضي:
     * لا نريد أن يعتبر Backend مجرد
     * فتح المهمة وحفظها تعديلًا للموعد.
     */
    const originalDueDateLocal =
      this.toDateTimeLocal(
        currentTask.dueDate
      );


    const requestedDueDate =
      value.dueDate ===
        originalDueDateLocal

        ? currentTask.dueDate

        : value.dueDate

          ? new Date(
              value.dueDate
            ).toISOString()

          : null;


    /*
     * لا تغيير حالة بدون مسؤول.
     */
    if (
      statusChanged &&
      !this.draftAssignee
    ) {

      this.editError =
        'يجب إسناد المهمة إلى مستخدم قبل تغيير حالتها.';

      return;
    }


    /*
     * لا تبدأ/تكتمل المهمة إذا كان
     * أحد اعتمادياتها غير مكتمل.
     */
    if (
      (
        requestedStatus ===
          'InProgress' ||
        requestedStatus ===
          'InReview' ||
        requestedStatus ===
          'Done'
      ) &&
      !this.selectedDependenciesSatisfied()
    ) {

      this.editError =
        'لا يمكن تشغيل أو إكمال المهمة قبل اكتمال جميع المهام التي تعتمد عليها.';

      return;
    }


    if (
      !this.canMoveTask(
        currentTask,
        requestedStatus
      )
    ) {

      this.editError =
        statusChanged &&
        !this.draftAssignee

          ? 'يجب إسناد المهمة إلى مستخدم قبل تغيير حالتها.'

          : 'لا تسمح صلاحيتك بتغيير المهمة إلى الحالة المحددة.';

      return;
    }


    if (
      requestedStatus ===
      'InReview'
    ) {

      const percentage =
        Number(
          value.progressPercentage
        );


      const note =
        value.progressNote
          .trim();


      if (
        percentage < 1 ||
        percentage > 99
      ) {

        this.editError =
          'عند اختيار "مكتملة جزئيًا" يجب تحديد نسبة بين 1% و99%.';

        return;
      }


      if (
        note.length < 3
      ) {

        this.editError =
          'يجب توضيح ما تم إنجازه.';

        return;
      }
    }


    const reasonResult =
      statusChanged

        ? this.resolveStatusChangeReason(
            currentTask,
            requestedStatus
          )

        : {
            allowed: true,
            reason: null
          };


    if (
      !reasonResult.allowed
    ) {
      return;
    }


    const requestedProgressPercentage =
      requestedStatus ===
        'InReview'

        ? Number(
            value.progressPercentage
          )

        : null;


    const requestedProgressNote =
      requestedStatus ===
        'InReview'

        ? value.progressNote
            .trim()

        : null;


    const progressChanged =
      requestedStatus ===
        'InReview' &&
      (
        currentTask.progressPercentage !==
          requestedProgressPercentage ||

        (
          currentTask.progressNote
          ?? ''
        ) !==
        (
          requestedProgressNote
          ?? ''
        )
      );


    this.editingTask =
      true;


    this.editError =
      '';


    /*
     * لا يتم أي تعديل عند اختيار المسؤول
     * أو الاعتمادية داخل النافذة.
     *
     * كل الطلبات التالية تبدأ حصريًا
     * عند الضغط على "حفظ التعديلات".
     */
    this.tasksService
      .update(
        currentTask.workspaceId,
        currentTask.projectId,
        currentTask.id,
        {

          title:
            value.title
              .trim(),

          description:
            value.description
              .trim()
              || null,

          priority:
            Number(
              value.priority
            ) as TaskPriorityValue,

          /*
           * المهم هنا:
           * نستخدم requestedDueDate
           * وليس value.dueDate مباشرة.
           */
          dueDate:
            requestedDueDate

        }
      )
      .pipe(

        /*
         * الإسناد أولًا لأن Backend
         * يمنع تغيير الحالة دون مسؤول.
         */
        switchMap(
          updatedDetails =>

            this
              .persistAssigneeBeforeStatus(
                currentTask
              )
              .pipe(

                map(
                  () =>
                    updatedDetails
                )

              )
        ),


        /*
         * نحفظ الاعتماديات قبل الحالة
         * حتى يتحقق Backend من النسخة
         * الجديدة عند تغيير الحالة.
         */
        switchMap(
          updatedDetails =>

            this
              .persistDependencyDraft(
                currentTask
              )
              .pipe(

                map(
                  () =>
                    updatedDetails
                )

              )
        ),


        switchMap(
          updatedDetails => {

            if (
              !statusChanged &&
              !progressChanged
            ) {

              return of(
                updatedDetails
              );
            }


            return this.tasksService
              .updateStatus(
                currentTask.workspaceId,
                currentTask.projectId,
                currentTask.id,
                {

                  status:
                    this.statusValues[
                      requestedStatus
                    ],

                  position:
                    statusChanged

                      ? this.nextPosition(
                          currentTask.projectId,
                          requestedStatus
                        )

                      : currentTask.position,

                  progressPercentage:
                    requestedProgressPercentage,

                  progressNote:
                    requestedProgressNote,

                  changeReason:
                    reasonResult.reason

                }
              )
              .pipe(

                map(
                  updatedStatus => ({

                    ...updatedDetails,

                    ...updatedStatus

                  })
                )

              );
          }
        ),


        /*
         * إذا اختير "بدون مسؤول" ولم
         * تتغير الحالة، تتم الإزالة
         * في نهاية عملية الحفظ.
         */
        switchMap(
          updatedTask =>

            this
              .persistAssigneeRemovalAfterStatus(
                currentTask
              )
              .pipe(

                map(
                  () =>
                    updatedTask
                )

              )
        )

      )
      .subscribe({

        next: () => {

          this.editingTask =
            false;


          this.closeTaskPanel();


          /*
           * إعادة تحميل المصدر الحقيقي
           * مهم لأن المسؤول والاعتماديات
           * تم تعديلهما أيضًا.
           */
          this.loadTasks();
        },


        error: error => {

          console.error(
            'Update task failed:',
            error
          );


          this.editError =
            this.extractApiError(
              error
            );


          this.editingTask =
            false;
        }

      });
  }


  /* =========================
     HELPERS
     ========================= */

  private replaceTask(
    task: BoardTask
  ): void {

    this.tasks =
      this.tasks.map(
        current =>
          current.id ===
            task.id &&
          current.workspaceId ===
            task.workspaceId &&
          current.projectId ===
            task.projectId

            ? task
            : current
      );


    if (
      this.selectedTask &&
      this.selectedTask.id ===
        task.id &&
      this.selectedTask.workspaceId ===
        task.workspaceId &&
      this.selectedTask.projectId ===
        task.projectId
    ) {

      this.selectedTask =
        task;
    }
  }


  priorityLabel(
    priority: TaskPriority
  ): string {

    switch (
      priority
    ) {

      case 'Low':
        return 'منخفضة';

      case 'Medium':
        return 'متوسطة';

      case 'High':
        return 'مرتفعة';

      case 'Critical':
        return 'حرجة';
    }
  }


  priorityToValue(
    priority: TaskPriority
  ): TaskPriorityValue {

    switch (
      priority
    ) {

      case 'Low':
        return 1;

      case 'Medium':
        return 2;

      case 'High':
        return 3;

      case 'Critical':
        return 4;
    }
  }


  statusLabel(
    status: TaskStatus
  ): string {

    switch (
      status
    ) {

      case 'Todo':
        return 'للعمل';

      case 'InProgress':
        return 'قيد التنفيذ';

      case 'InReview':
        return 'مكتملة جزئيًا';

      case 'Done':
        return 'مكتملة';

      case 'Cancelled':
        return 'ملغاة';
    }
  }


  roleLabel(
    role: string
  ): string {

    switch (
      role
    ) {

      case 'Owner':
      case 'WorkspaceOwner':
        return 'مالك مساحة العمل';

      case 'ProjectManager':
        return 'مدير مشروع';

      case 'Member':
        return 'عضو';

      default:
        return role;
    }
  }


  firstLetter(
    value:
      string |
      null |
      undefined
  ): string {

    const normalized =
      value?.trim();


    return normalized

      ? normalized
          .charAt(0)
          .toUpperCase()

      : '؟';
  }


  formatDate(
    value: string | null
  ): string {

    if (!value) {
      return 'بدون موعد';
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


  formatDateTime(
    value:
      string |
      null |
      undefined
  ): string {

    if (!value) {
      return '—';
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


  private toDateTimeLocal(
    value: string | null
  ): string {

    if (!value) {
      return '';
    }


    const date =
      new Date(
        value
      );


    const local =
      new Date(
        date.getTime() -
        date.getTimezoneOffset() *
        60_000
      );


    return local
      .toISOString()
      .slice(
        0,
        16
      );
  }


  private matchesDueFilter(
    task: BoardTask
  ): boolean {

    if (
      this.dueFilter ===
      'all'
    ) {
      return true;
    }


    if (
      this.dueFilter ===
      'no-date'
    ) {
      return !task.dueDate;
    }


    if (!task.dueDate) {
      return false;
    }


    if (
      this.dueFilter ===
      'overdue'
    ) {

      return this.isOverdue(
        task
      );
    }


    const due =
      new Date(
        task.dueDate
      );


    const now =
      new Date();


    if (
      this.dueFilter ===
      'today'
    ) {

      return (
        due.getFullYear() ===
          now.getFullYear() &&

        due.getMonth() ===
          now.getMonth() &&

        due.getDate() ===
          now.getDate()
      );
    }


    if (
      this.dueFilter ===
      'week'
    ) {

      const week =
        new Date(
          now.getTime() +
          7 *
          86_400_000
        );


      return (
        due >= now &&
        due <= week
      );
    }


    return true;
  }


  private normalizeSearch(
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
      error?.error?.message
      ??
      error?.error?.detail
      ??
      error?.error?.title
      ??
      error?.message
      ??
      'حدث خطأ غير متوقع.'
    );
  }


  backToProjects(): void {

    this.router.navigate([
      '/workspaces',
      this.workspaceId,
      'projects'
    ]);
  }
}