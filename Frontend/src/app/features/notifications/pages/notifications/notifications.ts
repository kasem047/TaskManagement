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
  NotificationItem,
  NotificationPagedResponse,
  NotificationRecipient,
  Notifications,
  NotificationWorkspace
} from '../../../../core/services/notifications';

import {
  WorkspaceInvitation,
  WorkspaceInvitations
} from '../../../../core/services/workspace-invitations';

import {
  Auth
} from '../../../../core/services/auth';

import {
  WorkspaceAccess
} from '../../../../core/services/workspace-access';

import {
  arabicNotificationMessage,
  arabicNotificationTitle
} from '../../../../core/utils/notification-text';


type ReadFilter =
  | 'all'
  | 'unread'
  | 'read';


@Component({
  selector:
    'app-notifications-page',

  imports: [
    FormsModule
  ],

  templateUrl:
    './notifications.html',

  styleUrl:
    './notifications.scss'
})
export class NotificationsPage
  implements OnInit {

  private readonly notificationsService =
    inject(Notifications);


  private readonly invitationsService =
    inject(WorkspaceInvitations);


  private readonly auth =
    inject(Auth);


  private readonly access =
    inject(WorkspaceAccess);


  /* =========================================================
     NOTIFICATIONS
     ========================================================= */

  notifications:
    NotificationItem[] = [];


  workspaces:
    NotificationWorkspace[] = [];


  recipients:
    NotificationRecipient[] = [];


  unreadCount =
    0;


  /* =========================================================
     WORKSPACE INVITATIONS
     ========================================================= */

  invitations:
    WorkspaceInvitation[] = [];


  invitationsLoading =
    false;


  invitationActionId:
    number | null =
      null;


  /* =========================================================
     GENERAL STATE
     ========================================================= */

  loading =
    true;


  recipientsLoading =
    false;


  sending =
    false;


  errorMessage =
    '';


  successMessage =
    '';


  isSystemAdmin =
    false;


  get canCompose():
    boolean {

    if (this.isSystemAdmin) {
      return true;
    }

    return this.access.activeRoleMode ===
      'owner' ||
      this.access.activeRoleMode ===
        'manager';
  }


  get showSender():
    boolean {

    return this.isSystemAdmin;
  }


  get visibleWorkspaces():
    NotificationWorkspace[] {

    if (this.isSystemAdmin) {
      return this.workspaces;
    }

    return this.workspaces.filter(
      workspace =>
        this.access.matchesActiveRole(
          workspace.currentUserRole
        )
    );
  }


  get showWorkspaceFilter():
    boolean {

    return this.isSystemAdmin ||
      this.visibleWorkspaces.length >
        1;
  }


  get pageSubtitle():
    string {

    if (this.isSystemAdmin) {
      return 'متابعة إشعارات النظام وإدارة حالة القراءة.';
    }

    if (this.access.activeRoleMode === 'owner') {
      return 'إشعارات مساحتك والمشاريع التابعة لها.';
    }

    if (this.access.activeRoleMode === 'manager') {
      return 'إشعارات المشروع الذي تديره ومهامه.';
    }

    return 'إشعارات مهامك والمشاريع التي أنت عضو فيها.';
  }


  /* =========================================================
     PAGINATION
     ========================================================= */

  page =
    1;


  pageSize =
    20;


  totalCount =
    0;


  totalPages =
    0;


  private pageRequestToken =
    0;


  /* =========================================================
     FILTERS
     ========================================================= */

  readFilter:
    ReadFilter =
      'all';


  filterWorkspaceId =
    0;


  filterActorUserId =
    0;


  filterSource =
    '';


  filterFrom =
    '';


  filterTo =
    '';


  /* =========================================================
     COMPOSE
     ========================================================= */

  composeOpen =
    false;


  composeWorkspaceId =
    0;


  selectedRecipientIds =
    new Set<number>();


  recipientSearch =
    '';


  composeTitle =
    '';


  composeMessage =
    '';


  /* =========================================================
     INIT
     ========================================================= */

  ngOnInit(): void {

    this.isSystemAdmin =
      this.access.isSystemAdmin;

    this.detectAdmin();

    this.loadInitial();
  }


  /* =========================================================
     SYSTEM ADMIN
     ========================================================= */

  private detectAdmin():
    void {

    this.auth
      .getProfile()
      .subscribe({

        next: profile => {

          this.isSystemAdmin =
            profile.isSystemAdmin ===
              true;
        },


        error: () => {

          this.isSystemAdmin =
            false;
        }

      });
  }


  /* =========================================================
     INITIAL
     ========================================================= */

  loadInitial():
    void {

    this.loading =
      true;

    this.invitationsLoading =
      true;

    this.errorMessage =
      '';


    forkJoin({

      workspaces:
        this.notificationsService
          .getWorkspaces(),

      unread:
        this.notificationsService
          .getUnreadCount(),

      invitations:
        this.invitationsService
          .getMine()

    })
      .subscribe({

        next: result => {

          this.workspaces =
            result.workspaces;

          this.unreadCount =
            result.unread;

          this.invitations =
            result.invitations;

          this.invitationsLoading =
            false;

          this.loadPage();
        },

        error: error => {

          this.loading =
            false;

          this.invitationsLoading =
            false;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  /* =========================================================
     INVITATIONS
     ========================================================= */

  get pendingInvitations():
    WorkspaceInvitation[] {

    return this.invitations
      .filter(
        invitation =>
          String(
            invitation.status
          ) ===
            'Pending'
      )
      .sort(
        (
          first,
          second
        ) =>
          new Date(
            second.createdAt
          )
            .getTime()
          -
          new Date(
            first.createdAt
          )
            .getTime()
      );
  }


  acceptInvitation(
    invitation:
      WorkspaceInvitation
  ): void {

    if (
      this.invitationActionId !==
        null
    ) {

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';

    this.invitationActionId =
      invitation.id;


    this.invitationsService
      .accept(
        invitation.id
      )
      .subscribe({

        next: () => {

          this.invitationActionId =
            null;

          this.successMessage =
            `تم قبول دعوتك للانضمام إلى مساحة العمل "${invitation.workspaceName}".`;


          this.updateInvitationStatus(
            invitation.id,
            'Accepted'
          );


          this.reloadWorkspaces();
        },

        error: error => {

          this.invitationActionId =
            null;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  rejectInvitation(
    invitation:
      WorkspaceInvitation
  ): void {

    if (
      this.invitationActionId !==
        null
    ) {

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';

    this.invitationActionId =
      invitation.id;


    this.invitationsService
      .reject(
        invitation.id
      )
      .subscribe({

        next: () => {

          this.invitationActionId =
            null;

          this.successMessage =
            `تم رفض دعوة مساحة العمل "${invitation.workspaceName}".`;


          this.updateInvitationStatus(
            invitation.id,
            'Rejected'
          );
        },

        error: error => {

          this.invitationActionId =
            null;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  private updateInvitationStatus(
    invitationId: number,
    status:
      'Accepted' |
      'Rejected'
  ): void {

    this.invitations =
      this.invitations
        .map(
          invitation => {

            if (
              invitation.id !==
                invitationId
            ) {

              return invitation;
            }


            return {
              ...invitation,

              status,

              respondedAt:
                new Date()
                  .toISOString()
            };
          }
        );
  }


  private reloadWorkspaces():
    void {

    this.notificationsService
      .getWorkspaces()
      .subscribe({

        next: workspaces => {

          this.workspaces =
            workspaces;
        },

        error: error => {

          console.error(
            'Reload workspaces failed:',
            error
          );
        }

      });
  }


  invitationActionRunning(
    invitationId: number
  ): boolean {

    return (
      this.invitationActionId ===
        invitationId
    );
  }


  /* =========================================================
     PAGE
     ========================================================= */

  loadPage():
    void {

    const requestToken =
      ++this.pageRequestToken;


    if (
      this.notifications.length ===
        0
    ) {

      this.loading =
        true;
    }


    this.errorMessage =
      '';


    this.notificationsService
      .getPage({

        isRead:
          this.readFilter ===
            'all'
            ? null
            : this.readFilter ===
                'read',

        actorUserId:
          this.filterActorUserId ||
          null,

        workspaceId:
          this.filterWorkspaceId ||
          null,

        source:
          this.filterSource ||
          null,

        from:
          this.toUtcStart(
            this.filterFrom
          ),

        to:
          this.toUtcEnd(
            this.filterTo
          ),

        page:
          this.page,

        pageSize:
          this.pageSize

      })
      .subscribe({

        next: response => {

          if (
            requestToken !==
              this.pageRequestToken
          ) {

            return;
          }


          this.applyPage(
            response
          );

          this.loading =
            false;
        },

        error: error => {

          if (
            requestToken !==
              this.pageRequestToken
          ) {

            return;
          }


          this.errorMessage =
            this.extractApiError(
              error
            );

          this.loading =
            false;
        }

      });
  }


  private applyPage(
    response:
      NotificationPagedResponse
  ): void {

    this.notifications =
      response.items
      ??
      [];

    this.page =
      response.page
      ||
      this.page;

    this.pageSize =
      response.pageSize
      ||
      this.pageSize;

    this.totalCount =
      response.totalCount
      ??
      0;

    this.totalPages =
      response.totalPages
      ??
      0;
  }


  applyFilters():
    void {

    this.page =
      1;

    this.loadPage();
  }


  get isTodayFilter():
    boolean {

    const today =
      this.todayLocalDate();

    return this.filterFrom ===
      today
      &&
      this.filterTo ===
        today;
  }


  filterToday():
    void {

    const today =
      this.todayLocalDate();

    this.filterFrom =
      today;

    this.filterTo =
      today;

    this.applyFilters();
  }


  resetFilters():
    void {

    this.readFilter =
      'all';

    this.filterWorkspaceId =
      0;

    this.filterActorUserId =
      0;

    this.filterSource =
      '';

    this.filterFrom =
      '';

    this.filterTo =
      '';

    this.page =
      1;

    this.loadPage();
  }


  previousPage():
    void {

    if (
      this.page <= 1
    ) {

      return;
    }


    this.page--;

    this.loadPage();
  }


  nextPage():
    void {

    if (
      this.totalPages <= 0 ||
      this.page >=
        this.totalPages
    ) {

      return;
    }


    this.page++;

    this.loadPage();
  }


  /* =========================================================
     READ
     ========================================================= */

  markAsRead(
    notification:
      NotificationItem
  ): void {

    if (
      notification.isRead
    ) {

      return;
    }


    this.notificationsService
      .markAsRead(
        notification.id
      )
      .subscribe({

        next: () => {

          notification.isRead =
            true;

          notification.readAt =
            new Date()
              .toISOString();

          this.unreadCount =
            Math.max(
              0,
              this.unreadCount - 1
            );


          if (
            this.readFilter ===
              'unread'
          ) {

            this.loadPage();
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


  markAllAsRead():
    void {

    if (
      this.unreadCount ===
        0
    ) {

      return;
    }


    this.notificationsService
      .markAllAsRead()
      .subscribe({

        next: () => {

          this.unreadCount =
            0;

          this.loadPage();
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
     COMPOSE
     ========================================================= */

  toggleCompose():
    void {

    this.composeOpen =
      !this.composeOpen;

    this.successMessage =
      '';

    this.errorMessage =
      '';


    if (
      this.composeOpen
    ) {

      if (
        this.isSystemAdmin
      ) {

        this.composeWorkspaceId =
          0;

        this.loadRecipients();

      } else if (
        this.visibleWorkspaces.length ===
          1
      ) {

        this.composeWorkspaceId =
          this.visibleWorkspaces[0].id;

        this.loadRecipients();
      }
    }
  }


  composeWorkspaceChanged():
    void {

    this.selectedRecipientIds
      .clear();

    this.recipientSearch =
      '';

    this.loadRecipients();
  }


  loadRecipients():
    void {

    if (
      !this.isSystemAdmin &&
      this.composeWorkspaceId <=
        0
    ) {

      this.recipients =
        [];

      return;
    }


    this.recipientsLoading =
      true;


    this.notificationsService
      .getAllowedRecipients(
        this.isSystemAdmin
          ? (
              this.composeWorkspaceId ||
              null
            )
          : this.composeWorkspaceId
      )
      .subscribe({

        next: recipients => {

          this.recipients =
            recipients;

          this.recipientsLoading =
            false;
        },

        error: error => {

          this.recipients =
            [];

          this.recipientsLoading =
            false;

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  get filteredRecipients():
    NotificationRecipient[] {

    const query =
      this.recipientSearch
        .trim()
        .toLocaleLowerCase();


    if (!query) {

      return this.recipients;
    }


    return this.recipients
      .filter(
        recipient => {

          const text =
            [
              recipient.fullName,
              recipient.email,
              recipient.roleName ??
                '',
              recipient.workspaceName ??
                ''
            ]
              .join(' ')
              .toLocaleLowerCase();


          return text.includes(
            query
          );
        }
      );
  }


  toggleRecipient(
    userId: number
  ): void {

    if (
      this.selectedRecipientIds
        .has(userId)
    ) {

      this.selectedRecipientIds
        .delete(userId);

    } else {

      this.selectedRecipientIds
        .add(userId);
    }
  }


  isRecipientSelected(
    userId: number
  ): boolean {

    return this.selectedRecipientIds
      .has(userId);
  }


  sendNotification():
    void {

    this.errorMessage =
      '';

    this.successMessage =
      '';


    if (
      !this.composeTitle.trim()
    ) {

      this.errorMessage =
        'أدخل عنوان الإشعار.';

      return;
    }


    if (
      !this.composeMessage.trim()
    ) {

      this.errorMessage =
        'أدخل نص الإشعار.';

      return;
    }


    if (
      this.selectedRecipientIds
        .size === 0
    ) {

      this.errorMessage =
        'اختر مستلمًا واحدًا على الأقل.';

      return;
    }


    if (
      !this.isSystemAdmin &&
      this.composeWorkspaceId <=
        0
    ) {

      this.errorMessage =
        'اختر مساحة العمل.';

      return;
    }


    this.sending =
      true;


    this.notificationsService
      .send({

        workspaceId:
          this.composeWorkspaceId >
            0
            ? this.composeWorkspaceId
            : null,

        recipientUserIds:
          [
            ...this.selectedRecipientIds
          ],

        title:
          this.composeTitle.trim(),

        message:
          this.composeMessage.trim()

      })
      .subscribe({

        next: () => {

          this.sending =
            false;

          this.successMessage =
            'تم إرسال الإشعار بنجاح.';

          this.composeTitle =
            '';

          this.composeMessage =
            '';

          this.selectedRecipientIds
            .clear();
        },

        error: error => {

          this.sending =
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

  formatDate(
    value:
      string | null
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


  sourceLabel(
    type: string
  ): string {

    if (
      type.startsWith(
        'task.'
      )
    ) {

      return 'المهام';
    }


    if (
      type.startsWith(
        'workspace.'
      )
    ) {

      return 'مساحة العمل';
    }


    if (
      type.startsWith(
        'project.'
      )
    ) {

      return 'المشاريع';
    }


    if (
      type.startsWith(
        'member.'
      )
    ) {

      return 'المكافآت';
    }


    if (
      type ===
        'manual.notification'
    ) {

      return 'إشعار يدوي';
    }


    return 'النظام';
  }


  displayTitle(
    notification:
      NotificationItem
  ): string {

    return arabicNotificationTitle(
      notification
    );
  }


  displayMessage(
    notification:
      NotificationItem
  ): string {

    return arabicNotificationMessage(
      notification
    );
  }


  workspaceNameOf(
    workspaceId:
      number | null
  ): string | null {

    if (!workspaceId) {
      return null;
    }

    return this.workspaces.find(
      workspace =>
        workspace.id ===
          workspaceId
    )?.name
      ?? null;
  }


  /* =========================================================
     DATE FILTERS
     ========================================================= */

  private todayLocalDate():
    string {

    const now =
      new Date();

    const month =
      String(
        now.getMonth() +
          1
      )
        .padStart(
          2,
          '0'
        );

    const day =
      String(
        now.getDate()
      )
        .padStart(
          2,
          '0'
        );

    return `${now.getFullYear()}-${month}-${day}`;
  }


  private toUtcStart(
    value: string
  ): string | null {

    if (!value) {

      return null;
    }


    const date =
      new Date(
        `${value}T00:00:00`
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return null;
    }


    return date.toISOString();
  }


  private toUtcEnd(
    value: string
  ): string | null {

    if (!value) {

      return null;
    }


    const date =
      new Date(
        `${value}T23:59:59.999`
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return null;
    }


    return date.toISOString();
  }


  /* =========================================================
     ERROR
     ========================================================= */

  private extractApiError(
    error: any
  ): string {

    const detail =
      error?.error?.detail
      ??
      error?.error?.message
      ??
      'تعذر تنفيذ العملية. حاول مرة أخرى.';

    if (typeof detail !== 'string') {
      return 'تعذر تنفيذ العملية. حاول مرة أخرى.';
    }

    if (detail.includes('This invitation is no longer pending')) {
      return 'هذه الدعوة لم تعد معلّقة. حدّث الصفحة ثم أعد المحاولة.';
    }

    if (detail.includes('already an active member of this workspace')) {
      return 'أنت عضو في مساحة العمل بالفعل.';
    }

    if (detail.includes('The workspace is no longer available')) {
      return 'مساحة العمل لم تعد متاحة.';
    }

    if (detail.includes('The role assigned to this invitation is no longer available')) {
      return 'الدور المرتبط بهذه الدعوة لم يعد متاحًا.';
    }

    return detail;
  }
}