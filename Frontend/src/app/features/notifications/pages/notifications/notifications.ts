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
          invitation.status ===
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

    this.loading =
      true;

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

          this.applyPage(
            response
          );

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


  private applyPage(
    response:
      NotificationPagedResponse
  ): void {

    this.notifications =
      response.items;

    this.page =
      response.page;

    this.pageSize =
      response.pageSize;

    this.totalCount =
      response.totalCount;

    this.totalPages =
      response.totalPages;
  }


  applyFilters():
    void {

    this.page =
      1;

    this.loadPage();
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
        this.workspaces.length ===
          1
      ) {

        this.composeWorkspaceId =
          this.workspaces[0].id;

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
      type ===
        'manual.notification'
    ) {

      return 'إشعار يدوي';
    }


    return 'النظام';
  }


  /* =========================================================
     DATE FILTERS
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
     ERROR
     ========================================================= */

  private extractApiError(
    error: any
  ): string {

    return (
      error?.error?.detail
      ??
      error?.error?.message
      ??
      'تعذر تنفيذ العملية. حاول مرة أخرى.'
    );
  }
}