import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormsModule
} from '@angular/forms';

import {
  ActivityWorkspace,
  WorkspaceActivityLog,
  WorkspaceActivityLogs
} from '../../../../core/services/workspace-activity-logs';

import {
  ActivityLogs,
  GlobalActivityLog
} from '../../../../core/services/activity-logs';

import {
  WorkspaceAccess
} from '../../../../core/services/workspace-access';


type ActivityEntityFilter =
  | 'all'
  | 'Workspace'
  | 'WorkspaceInvitation'
  | 'WorkspaceMember'
  | 'Project'
  | 'TaskItem'
  | 'TaskAssignee'
  | 'TaskComment'
  | 'TaskAttachment'
  | 'Permission'
  | 'UserPermissionOverride';


type ActivityTone =
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'violet';


interface DisplayActivityLog {

  id: number;

  workspaceId: number;

  workspaceName:
    string | null;

  userId: number;

  userFullName: string;

  action: string;

  entityName: string;

  entityId: number;

  description:
    string | null;

  createdAt: string;

  targetUserId:
    number | null;

  targetUserFullName:
    string | null;
}


@Component({
  selector:
    'app-activity-logs',

  imports: [
    FormsModule
  ],

  templateUrl:
    './activity-logs.html',

  styleUrl:
    './activity-logs.scss'
})
export class ActivityLogsPage
  implements OnInit {

  private readonly workspaceActivityService =
    inject(
      WorkspaceActivityLogs
    );


  private readonly activityLogsService =
    inject(
      ActivityLogs
    );


  private readonly access =
    inject(
      WorkspaceAccess
    );


  /* =========================================================
     MODE
     ========================================================= */

  isSystemAdmin =
    false;


  /* =========================================================
     WORKSPACES
     ========================================================= */

  workspaces:
    ActivityWorkspace[] = [];


  selectedWorkspaceId =
    0;


  loadingWorkspaces =
    true;


  /* =========================================================
     LOGS
     ========================================================= */

  logs:
    DisplayActivityLog[] = [];


  loadingLogs =
    false;


  errorMessage =
    '';


  /* =========================================================
     FILTERS
     ========================================================= */

  search =
    '';


  searchDraft =
    '';


  entityFilter:
    ActivityEntityFilter =
      'all';


  entityFilterDraft:
    ActivityEntityFilter =
      'all';


  globalUserId =
    0;


  globalFrom =
    '';


  globalTo =
    '';


  /* =========================================================
     PAGINATION
     ========================================================= */

  readonly localPageSize =
    15;


  readonly globalPageSize =
    25;


  currentPage =
    1;


  globalTotalCount =
    0;


  globalTotalPages =
    0;


  /* =========================================================
     ENTITY FILTERS
     ========================================================= */

  readonly entityFilters:
    {
      value:
        ActivityEntityFilter;

      label:
        string;
    }[] = [

      {
        value: 'all',
        label: 'كل الأنشطة'
      },

      {
        value: 'Workspace',
        label: 'مساحة العمل'
      },

      {
        value: 'WorkspaceInvitation',
        label: 'دعوات المساحات'
      },

      {
        value: 'WorkspaceMember',
        label: 'الفريق'
      },

      {
        value: 'Project',
        label: 'المشاريع'
      },

      {
        value: 'TaskItem',
        label: 'المهام'
      },

      {
        value: 'TaskAssignee',
        label: 'الإسناد'
      },

      {
        value: 'TaskComment',
        label: 'التعليقات'
      },

      {
        value: 'TaskAttachment',
        label: 'المرفقات'
      },

      {
        value: 'Permission',
        label: 'الصلاحيات'
      },

      {
        value: 'UserPermissionOverride',
        label: 'تجاوزات الصلاحيات'
      }

    ];


  get isManagerMode():
    boolean {

    return this.access.activeRoleMode ===
      'manager';
  }


  get isMemberMode():
    boolean {

    return this.access.activeRoleMode ===
      'member';
  }


  get visibleEntityFilters():
    {
      value: ActivityEntityFilter;
      label: string;
    }[] {

    if (
      !this.isManagerMode &&
      !this.isMemberMode
    ) {
      return this.entityFilters;
    }


    const allowed =
      new Set([
        'all',
        'Project',
        'TaskItem',
        'TaskAssignee',
        'TaskComment',
        'TaskAttachment'
      ]);


    return this.entityFilters
      .filter(filter =>
        allowed.has(
          filter.value
        )
      );
  }


  /* =========================================================
     INIT
     ========================================================= */

  ngOnInit():
    void {

    this.loadWorkspaces();
  }


  /* =========================================================
     WORKSPACES + ADMIN DETECTION
     ========================================================= */

  loadWorkspaces():
    void {

    this.loadingWorkspaces =
      true;

    this.errorMessage =
      '';


    this.access
      .refresh()
      .subscribe({

        next: snapshot => {

          this.isSystemAdmin =
            snapshot.profile?.isSystemAdmin === true;

          this.workspaces =
            snapshot.workspaces
              .filter(workspace =>
                this.isSystemAdmin ||
                this.access.matchesActiveRole(
                  workspace.currentUserRole
                )
              );


          this.loadingWorkspaces =
            false;


          if (
            this.isSystemAdmin
          ) {

            this.selectedWorkspaceId =
              0;

            this.currentPage =
              1;

            this.loadGlobalActivity();

            return;
          }


          const manageable =
            this.manageableWorkspaces;


          if (
            manageable.length >
            0
          ) {

            this.selectedWorkspaceId =
              this.resolveInitialWorkspaceId(
                manageable
              );

            this.loadWorkspaceActivity();
          }

        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.loadingWorkspaces =
            false;
        }

      });
  }


  get manageableWorkspaces():
    ActivityWorkspace[] {

    if (
      this.isSystemAdmin
    ) {

      return this.workspaces;
    }


    return this.workspaces
      .filter(
        workspace =>
          workspace.currentUserRole ===
            'WorkspaceOwner' ||
          workspace.currentUserRole ===
            'Owner' ||
          workspace.currentUserRole ===
            'ProjectManager' ||
          workspace.currentUserRole ===
            'Member'
      );
  }


  get selectedWorkspace():
    ActivityWorkspace | null {

    return (
      this.workspaces
        .find(
          workspace =>
            workspace.id ===
            this.selectedWorkspaceId
        )
      ?? null
    );
  }


  private resolveInitialWorkspaceId(
    manageable:
      ActivityWorkspace[]
  ): number {

    const stored =
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
      manageable.some(
        workspace =>
          workspace.id ===
            stored
      )
    ) {

      return stored;
    }


    return manageable[0]?.id ??
      0;
  }


  selectWorkspace(
    value: string
  ): void {

    const workspaceId =
      Number(
        value
      );


    if (
      this.isSystemAdmin
    ) {

      this.selectedWorkspaceId =
        Number.isFinite(
          workspaceId
        )
          ? workspaceId
          : 0;


      this.currentPage =
        1;


      this.loadGlobalActivity();

      return;
    }


    if (
      !this.manageableWorkspaces
        .some(
          workspace =>
            workspace.id ===
              workspaceId
        )
    ) {

      this.selectedWorkspaceId =
        0;

      this.logs =
        [];

      return;
    }


    this.selectedWorkspaceId =
      workspaceId;


    this.clearFilters(
      false
    );


    this.loadWorkspaceActivity();
  }


  /* =========================================================
     MAIN LOAD
     ========================================================= */

  loadActivity():
    void {

    if (
      this.isSystemAdmin
    ) {

      this.loadGlobalActivity();

      return;
    }


    this.loadWorkspaceActivity();
  }


  /* =========================================================
     LOCAL WORKSPACE AUDIT
     ========================================================= */

  private loadWorkspaceActivity():
    void {

    if (
      this.selectedWorkspaceId <=
        0
    ) {

      return;
    }


    this.loadingLogs =
      true;

    this.errorMessage =
      '';


    this.workspaceActivityService
      .getByWorkspace(
        this.selectedWorkspaceId
      )
      .subscribe({

        next: logs => {

          this.logs =
            logs.map(
              log =>
                this.mapWorkspaceLog(
                  log
                )
            );


          this.currentPage =
            1;


          this.loadingLogs =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.loadingLogs =
            false;
        }

      });
  }


  /* =========================================================
     GLOBAL AUDIT
     ========================================================= */

  loadGlobalActivity():
    void {

    this.loadingLogs =
      true;

    this.errorMessage =
      '';


    this.activityLogsService
      .getGlobalAudit({

        search:
          this.search ||
          null,

        workspaceId:
          this.selectedWorkspaceId ||
          null,

        userId:
          this.globalUserId ||
          null,

        entityName:
          this.entityFilter ===
            'all'
            ? null
            : this.entityFilter,

        from:
          this.toUtcStart(
            this.globalFrom
          ),

        to:
          this.toUtcEnd(
            this.globalTo
          ),

        page:
          this.currentPage,

        pageSize:
          this.globalPageSize

      })
      .subscribe({

        next: response => {

          this.logs =
            response.items.map(
              log =>
                this.mapGlobalLog(
                  log
                )
            );


          this.currentPage =
            response.page;


          this.globalTotalCount =
            response.totalCount;


          this.globalTotalPages =
            response.totalPages;


          this.loadingLogs =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.loadingLogs =
            false;
        }

      });
  }


  /* =========================================================
     FILTERS
     ========================================================= */

  setSearch(
    value: string
  ): void {

    this.searchDraft =
      value;
  }


  setEntityFilter(
    value: string
  ): void {

    const exists =
      this.entityFilters
        .some(
          filter =>
            filter.value ===
              value
        );


    this.entityFilterDraft =
      exists

        ? value as
            ActivityEntityFilter

        : 'all';
  }


  applyRoleFilters():
    void {

    this.search =
      this.searchDraft
        .trim();


    this.entityFilter =
      this.entityFilterDraft;


    this.currentPage =
      1;
  }


  applyGlobalFilters():
    void {

    this.currentPage =
      1;


    this.loadGlobalActivity();
  }


  clearFilters(
    reload = true
  ): void {

    this.search =
      '';


    this.searchDraft =
      '';


    this.entityFilter =
      'all';


    this.entityFilterDraft =
      'all';


    this.globalUserId =
      0;


    this.globalFrom =
      '';


    this.globalTo =
      '';


    this.currentPage =
      1;


    if (
      reload &&
      this.isSystemAdmin
    ) {

      this.loadGlobalActivity();
    }
  }


  /* =========================================================
     LOCAL FILTERING
     ========================================================= */

  get filteredLogs():
    DisplayActivityLog[] {

    if (
      this.isSystemAdmin
    ) {

      return this.logs;
    }


    const query =
      this.normalizeSearch(
        this.search
      );


    return this.logs
      .filter(
        log => {

          if (!this.isMemberMode) {
            return true;
          }

          return log.userId === this.access.currentUserId;
        }
      )
      .filter(
        log => {

          if (
            this.entityFilter ===
              'all'
          ) {

            return true;
          }


          return (
            log.entityName ===
              this.entityFilter
          );
        }
      )
      .filter(
        log => {

          if (!query) {

            return true;
          }


          const searchable =
            this.normalizeSearch(
              [
                log.userFullName,
                log.action,
                log.entityName,
                log.entityId,
                log.description,
                log.targetUserFullName
              ]
                .filter(
                  value =>
                    value !== null &&
                    value !== undefined
                )
                .join(' ')
            );


          return searchable
            .includes(
              query
            );
        }
      );
  }


  get pagedLogs():
    DisplayActivityLog[] {

    if (
      this.isSystemAdmin
    ) {

      return this.logs;
    }


    const start =
      (
        this.currentPage -
          1
      ) *
      this.localPageSize;


    return this.filteredLogs
      .slice(
        start,
        start +
          this.localPageSize
      );
  }


  get pageCount():
    number {

    if (
      this.isSystemAdmin
    ) {

      return Math.max(
        1,
        this.globalTotalPages
      );
    }


    return Math.max(
      1,
      Math.ceil(
        this.filteredLogs.length /
          this.localPageSize
      )
    );
  }


  previousPage():
    void {

    if (
      this.currentPage <=
        1
    ) {

      return;
    }


    this.currentPage--;


    if (
      this.isSystemAdmin
    ) {

      this.loadGlobalActivity();
    }
  }


  nextPage():
    void {

    if (
      this.currentPage >=
        this.pageCount
    ) {

      return;
    }


    this.currentPage++;


    if (
      this.isSystemAdmin
    ) {

      this.loadGlobalActivity();
    }
  }


  /* =========================================================
     STATISTICS
     ========================================================= */

  get displayedTotalCount():
    number {

    return this.isSystemAdmin

      ? this.globalTotalCount

      : this.logs.length;
  }


  get todayCount():
    number {

    const today =
      new Date();


    return this.logs
      .filter(
        log => {

          const date =
            new Date(
              log.createdAt
            );


          return (
            date.getFullYear() ===
              today.getFullYear() &&

            date.getMonth() ===
              today.getMonth() &&

            date.getDate() ===
              today.getDate()
          );
        }
      )
      .length;
  }


  get taskEventsCount():
    number {

    return this.logs
      .filter(
        log =>
          log.entityName ===
            'TaskItem' ||
          log.entityName ===
            'TaskAssignee'
      )
      .length;
  }


  get uniqueUsersCount():
    number {

    return new Set(
      this.logs.map(
        log =>
          log.userId
      )
    )
      .size;
  }


  /* =========================================================
     TITLES
     ========================================================= */

  activityTitle(
    log:
      DisplayActivityLog
  ): string {

    switch (
      log.action
    ) {

      case 'workspace.created':
        return 'إنشاء مساحة عمل';

      case 'workspace.updated':
        return 'تعديل مساحة عمل';

      case 'workspace.deleted':
        return 'حذف مساحة عمل';

      case 'workspace.invitation_created':
        return 'إنشاء دعوة لمساحة عمل';

      case 'workspace.invitation_accepted':
        return 'قبول دعوة مساحة عمل';

      case 'workspace.invitation_rejected':
        return 'رفض دعوة مساحة عمل';

      case 'workspace.invitation_cancelled':
        return 'إلغاء دعوة مساحة عمل';

      case 'workspace.ownership_transferred':
      case 'ownership.transferred':
        return 'نقل ملكية مساحة العمل';

      case 'member.added':
      case 'member.invited':
        return 'إضافة عضو';

      case 'member.role_changed':
        return 'تغيير دور عضو';

      case 'member.removed':
        return 'إزالة عضو';

      case 'member.left':
        return 'مغادرة مساحة العمل';

      case 'project.created':
        return 'إنشاء مشروع';

      case 'project.updated':
        return 'تعديل مشروع';

      case 'project.archived':
        return 'أرشفة مشروع';

      case 'project.unarchived':
        return 'إلغاء أرشفة مشروع';

      case 'project.deleted':
        return 'حذف مشروع';

      case 'task.created':
        return 'إنشاء مهمة';

      case 'task.updated':
        return 'تعديل مهمة';

      case 'task.status_changed':
        return 'تغيير حالة مهمة';

      case 'task.position_changed':
        return 'تغيير ترتيب مهمة';

      case 'task.progress_updated':
        return 'تحديث إنجاز مهمة';

      case 'task.deleted':
        return 'حذف مهمة';

      case 'task.assigned':
      case 'task.assignee_added':
        return 'إسناد مهمة';

      case 'task.unassigned':
      case 'task.assignee_removed':
        return 'إزالة إسناد';

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

      case 'permission.granted':
        return 'منح صلاحية';

      case 'permission.denied':
        return 'منع صلاحية';

      case 'permission.override_changed':
        return 'تعديل صلاحية مستخدم';

      default:
        return this.humanizeAction(
          log.action
        );
    }
  }


  /* =========================================================
     DESCRIPTION
     ========================================================= */

  activityDescription(
    log:
      DisplayActivityLog
  ): string {

    if (
      log.targetUserFullName
    ) {

      const action =
        log.action
          .toLowerCase();


      if (
        action.includes(
          'remove'
        ) ||
        action.includes(
          'unassign'
        )
      ) {

        return (
          `تم تنفيذ الإجراء على ${log.targetUserFullName}.`
        );
      }


      if (
        action.includes(
          'assign'
        )
      ) {

        return (
          `تم إسناد المهمة إلى ${log.targetUserFullName}.`
        );
      }
    }


    if (
      log.action ===
        'task.status_changed'
    ) {

      const translated =
        this.translateStatusChange(
          log.description
        );


      if (
        translated
      ) {

        return translated;
      }
    }


    if (
      log.action ===
        'task.progress_updated'
    ) {

      return this.translateProgress(
        log.description
      );
    }


    return (
      log.description
      ??
      'تم تنفيذ إجراء داخل النظام.'
    );
  }


  /* =========================================================
     ENTITY LABEL
     ========================================================= */

  entityLabel(
    entityName: string
  ): string {

    switch (
      entityName
    ) {

      case 'Workspace':
        return 'مساحة العمل';

      case 'WorkspaceInvitation':
        return 'دعوة';

      case 'WorkspaceMember':
        return 'عضو';

      case 'Project':
        return 'مشروع';

      case 'TaskItem':
        return 'مهمة';

      case 'TaskAssignee':
        return 'إسناد';

      case 'TaskComment':
        return 'تعليق';

      case 'TaskAttachment':
        return 'مرفق';

      case 'Permission':
      case 'UserPermissionOverride':
        return 'صلاحية';

      default:
        return entityName;
    }
  }


  /* =========================================================
     TONES
     ========================================================= */

  activityTone(
    log:
      DisplayActivityLog
  ): ActivityTone {

    const action =
      log.action
        .toLowerCase();


    if (
      action.includes(
        'delete'
      ) ||
      action.includes(
        'remove'
      ) ||
      action.includes(
        'cancel'
      ) ||
      action.includes(
        'reject'
      ) ||
      action.includes(
        'denied'
      )
    ) {

      return 'danger';
    }


    if (
      action.includes(
        'created'
      ) ||
      action.includes(
        'accepted'
      ) ||
      action.includes(
        'completed'
      ) ||
      action.includes(
        'granted'
      )
    ) {

      return 'success';
    }


    if (
      action.includes(
        'status'
      ) ||
      action.includes(
        'progress'
      ) ||
      action.includes(
        'archive'
      )
    ) {

      return 'warning';
    }


    if (
      action.includes(
        'member'
      ) ||
      action.includes(
        'assign'
      ) ||
      action.includes(
        'ownership'
      ) ||
      action.includes(
        'invitation'
      )
    ) {

      return 'violet';
    }


    return 'primary';
  }


  /* =========================================================
     DISPLAY
     ========================================================= */

  firstLetter(
    value: string
  ): string {

    return (
      value
        ?.trim()
        .charAt(0)
        .toUpperCase()
      ||
      'U'
    );
  }


  formatDateTime(
    value: string
  ): string {

    return new Date(
      value
    )
      .toLocaleString(
        'ar-SY',
        {
          year:
            'numeric',

          month:
            'short',

          day:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit'
        }
      );
  }


  /* =========================================================
     MAP
     ========================================================= */

  private mapWorkspaceLog(
    log:
      WorkspaceActivityLog
  ): DisplayActivityLog {

    return {

      id:
        log.id,

      workspaceId:
        log.workspaceId,

      workspaceName:
        this.workspaces.find(
          workspace =>
            workspace.id ===
              log.workspaceId
        )?.name ??
        null,

      userId:
        log.userId,

      userFullName:
        log.userFullName,

      action:
        log.action,

      entityName:
        log.entityName,

      entityId:
        log.entityId,

      description:
        log.description,

      createdAt:
        log.createdAt,

      targetUserId:
        log.targetUserId,

      targetUserFullName:
        log.targetUserFullName
    };
  }


  private mapGlobalLog(
    log:
      GlobalActivityLog
  ): DisplayActivityLog {

    return {

      id:
        log.id,

      workspaceId:
        log.workspaceId,

      workspaceName:
        log.workspaceName,

      userId:
        log.userId,

      userFullName:
        log.userFullName,

      action:
        log.action,

      entityName:
        log.entityName,

      entityId:
        log.entityId,

      description:
        log.description,

      createdAt:
        log.createdAt,

      targetUserId:
        null,

      targetUserFullName:
        null
    };
  }


  /* =========================================================
     DATES
     ========================================================= */

  private toUtcStart(
    value: string
  ): string | null {

    if (!value) {

      return null;
    }


    return new Date(
      `${value}T00:00:00`
    )
      .toISOString();
  }


  private toUtcEnd(
    value: string
  ): string | null {

    if (!value) {

      return null;
    }


    return new Date(
      `${value}T23:59:59.999`
    )
      .toISOString();
  }


  /* =========================================================
     TRANSLATION
     ========================================================= */

  private translateProgress(
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

      ? `تم تسجيل إنجاز بنسبة ${percentage}%: ${note}`

      : `تم تسجيل إنجاز بنسبة ${percentage}%.`;
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


    if (!match) {

      return null;
    }


    const from =
      this.statusLabel(
        match[1]
      );


    const to =
      this.statusLabel(
        match[2]
      );


    const reasonMatch =
      description.match(
        /Reason:\s*(.+)$/i
      );


    const reason =
      reasonMatch?.[1]
        ?.trim();


    return reason

      ? `تم تغيير الحالة من «${from}» إلى «${to}». السبب: ${reason}`

      : `تم تغيير الحالة من «${from}» إلى «${to}».`;
  }


  private statusLabel(
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


  private humanizeAction(
    action: string
  ): string {

    return action
      .replace(
        /[._-]+/g,
        ' '
      )
      .trim();
  }


  /* =========================================================
     SEARCH NORMALIZATION
     ========================================================= */

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


  /* =========================================================
     ERRORS
     ========================================================= */

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
          .filter(
            Boolean
          )
          .map(
            String
          );


      if (
        messages.length >
          0
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
      'حدث خطأ أثناء تحميل سجل النشاط.'
    );
  }
}