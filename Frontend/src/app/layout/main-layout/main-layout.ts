import {
  Component,
  OnDestroy,
  OnInit,
  inject
} from '@angular/core';

import {
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';

import {
  Subscription,
  forkJoin
} from 'rxjs';

import {
  Theme
} from '../../core/services/theme';

import {
  TokenStorage
} from '../../core/services/token-storage';

import {
  NotificationItem,
  Notifications,
  NotificationWorkspace,
  NotificationWorkspaceMember
} from '../../core/services/notifications';

import {
  NotificationRealtime
} from '../../core/services/notification-realtime';


type NotificationTab =
  | 'inbox'
  | 'compose';


type NotificationCategory =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'manual';


@Component({
  selector: 'app-main-layout',

  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive
  ],

  templateUrl:
    './main-layout.html',

  styleUrl:
    './main-layout.scss'
})
export class MainLayout
  implements OnInit, OnDestroy {

  readonly theme =
    inject(Theme);


  private readonly tokenStorage =
    inject(TokenStorage);


  private readonly notificationsService =
    inject(Notifications);


  private readonly notificationRealtime =
    inject(NotificationRealtime);


  private readonly router =
    inject(Router);


  readonly user =
    this.tokenStorage
      .getUser();


  /* =========================
     NOTIFICATION CENTER
     ========================= */

  notificationCenterOpen =
    false;


  notificationTab:
    NotificationTab =
      'inbox';


  notifications:
    NotificationItem[] = [];


  unreadCount =
    0;


  notificationsLoading =
    false;


  notificationError =
    '';


  markingAllRead =
    false;


  markingNotificationId:
    number | null =
      null;


  /* =========================
     REALTIME
     ========================= */

  toastNotifications:
    NotificationItem[] = [];


  private readonly toastTimers =
    new Map<
      number,
      ReturnType<
        typeof setTimeout
      >
    >();


  private realtimeSubscription:
    Subscription | null =
      null;


  /* =========================
     COMPOSE
     ========================= */

  workspaces:
    NotificationWorkspace[] = [];


  members:
    NotificationWorkspaceMember[] =
      [];


  workspacesLoading =
    false;


  membersLoading =
    false;


  selectedWorkspaceId =
    0;


  selectedRecipientIds =
    new Set<number>();


  composeTitle =
    '';


  composeMessage =
    '';


  recipientSearch =
    '';


  sendingNotification =
    false;


  composeError =
    '';


  composeSuccess =
    '';


  /* =========================
     INIT
     ========================= */

  ngOnInit(): void {

    this.loadNotificationSummary();

    this.loadWorkspaces();


    this.realtimeSubscription =
      this.notificationRealtime
        .received$
        .subscribe(
          notification => {

            this.handleRealtimeNotification(
              notification
            );
          }
        );


    this.notificationRealtime
      .start();
  }


  ngOnDestroy(): void {

    this.realtimeSubscription
      ?.unsubscribe();


    for (
      const timer
      of this.toastTimers.values()
    ) {

      clearTimeout(
        timer
      );
    }


    this.toastTimers
      .clear();
  }


  /* =========================
     PERMISSIONS
     ========================= */

  get canComposeNotifications():
    boolean {

    return this.workspaces
      .some(
        workspace =>
          this.canRoleSendNotifications(
            workspace.currentUserRole
          )
      );
  }


  get notificationComposeWorkspaces():
    NotificationWorkspace[] {

    return this.workspaces
      .filter(
        workspace =>
          this.canRoleSendNotifications(
            workspace.currentUserRole
          )
      );
  }


  private canRoleSendNotifications(
    role: string
  ): boolean {

    return (
      role ===
        'WorkspaceOwner' ||
      role ===
        'Owner' ||
      role ===
        'ProjectManager' ||
      role ===
        'SystemAdmin' ||
      role ===
        'Admin'
    );
  }


  private selectedWorkspace():
    NotificationWorkspace | null {

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


  private currentComposeRole():
    string {

    return (
      this.selectedWorkspace()
        ?.currentUserRole
      ?? ''
    );
  }


  get composeRecipientRuleText():
    string {

    const role =
      this.currentComposeRole();


    if (
      role ===
        'WorkspaceOwner' ||
      role ===
        'Owner'
    ) {

      return 'يمكن لمالك مساحة العمل إرسال الإشعارات إلى مديري المشاريع والأعضاء ضمن المساحة.';
    }


    if (
      role ===
        'ProjectManager'
    ) {

      return 'يمكن لمدير المشروع إرسال الإشعارات إلى الأعضاء التابعين لمهامه ومشاريعه فقط.';
    }


    if (
      role ===
        'SystemAdmin' ||
      role ===
        'Admin'
    ) {

      return 'يمكن لمسؤول النظام إرسال الإشعارات الإدارية.';
    }


    return 'لا تملك صلاحية إرسال إشعارات إدارية ضمن مساحة العمل هذه.';
  }


  private isEligibleRecipient(
    member:
      NotificationWorkspaceMember
  ): boolean {

    /*
     * لا نرسل إشعارًا لأنفسنا.
     */
    if (
      member.userId ===
      this.user?.userId
    ) {

      return false;
    }


    const role =
      this.currentComposeRole();


    /*
     * WorkspaceOwner:
     *
     * Backend يسمح له:
     * ProjectManager
     * Member
     */
    if (
      role ===
        'WorkspaceOwner' ||
      role ===
        'Owner'
    ) {

      return (
        member.roleName ===
          'ProjectManager' ||
        member.roleName ===
          'Member'
      );
    }


    /*
     * ProjectManager:
     *
     * لا يمكنه إرسال الإشعار
     * إلى Owner أو ProjectManager آخر.
     *
     * Backend سيجري أيضًا التحقق النهائي
     * بأن العضو مرتبط بمهام ضمن مشاريعه.
     */
    if (
      role ===
        'ProjectManager'
    ) {

      return (
        member.roleName ===
        'Member'
      );
    }


    /*
     * System Admin
     */
    if (
      role ===
        'SystemAdmin' ||
      role ===
        'Admin'
    ) {

      return true;
    }


    /*
     * Member:
     * ممنوع.
     */
    return false;
  }


  /* =========================
     OPEN / CLOSE
     ========================= */

  toggleNotificationCenter():
    void {

    this.notificationCenterOpen =
      !this.notificationCenterOpen;


    if (
      this.notificationCenterOpen
    ) {

      this.notificationTab =
        'inbox';

      this.loadNotifications();
    }
  }


  closeNotificationCenter():
    void {

    this.notificationCenterOpen =
      false;
  }


  setNotificationTab(
    tab:
      NotificationTab
  ): void {

    if (
      tab ===
        'compose' &&
      !this.canComposeNotifications
    ) {

      this.notificationTab =
        'inbox';

      this.notificationError =
        'لا تملك صلاحية إنشاء إشعارات إدارية.';

      return;
    }


    this.notificationTab =
      tab;


    this.notificationError =
      '';

    this.composeError =
      '';

    this.composeSuccess =
      '';


    if (
      tab ===
      'inbox'
    ) {

      this.loadNotifications();

    } else if (
      this.workspaces.length ===
      0
    ) {

      this.loadWorkspaces();
    }
  }


  /* =========================
     LOAD
     ========================= */

  loadNotificationSummary():
    void {

    forkJoin({

      notifications:
        this.notificationsService
          .getMine(),

      unreadCount:
        this.notificationsService
          .getUnreadCount()

    })
      .subscribe({

        next: result => {

          this.notifications =
            result.notifications;

          this.unreadCount =
            result.unreadCount;
        },


        error: error => {

          console.error(
            'Notification summary failed:',
            error
          );
        }

      });
  }


  loadNotifications():
    void {

    this.notificationsLoading =
      true;

    this.notificationError =
      '';


    forkJoin({

      notifications:
        this.notificationsService
          .getMine(),

      unreadCount:
        this.notificationsService
          .getUnreadCount()

    })
      .subscribe({

        next: result => {

          this.notifications =
            result.notifications;

          this.unreadCount =
            result.unreadCount;

          this.notificationsLoading =
            false;
        },


        error: error => {

          console.error(
            'Notifications request failed:',
            error
          );


          this.notificationError =
            this.extractApiError(
              error
            );


          this.notificationsLoading =
            false;
        }

      });
  }


  /* =========================
     READ STATE
     ========================= */

  markNotificationRead(
    notification:
      NotificationItem
  ): void {

    if (
      notification.isRead ||
      this.markingNotificationId !==
        null
    ) {

      return;
    }


    this.markingNotificationId =
      notification.id;


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


          this.markingNotificationId =
            null;
        },


        error: error => {

          console.error(
            'Mark notification read failed:',
            error
          );


          this.notificationError =
            this.extractApiError(
              error
            );


          this.markingNotificationId =
            null;
        }

      });
  }


  markAllNotificationsRead():
    void {

    if (
      this.markingAllRead ||
      this.unreadCount === 0
    ) {

      return;
    }


    this.markingAllRead =
      true;

    this.notificationError =
      '';


    this.notificationsService
      .markAllAsRead()
      .subscribe({

        next: () => {

          const now =
            new Date()
              .toISOString();


          this.notifications =
            this.notifications
              .map(
                notification => ({

                  ...notification,

                  isRead:
                    true,

                  readAt:
                    notification.readAt
                    ?? now

                })
              );


          this.unreadCount =
            0;


          this.markingAllRead =
            false;
        },


        error: error => {

          console.error(
            'Mark all notifications read failed:',
            error
          );


          this.notificationError =
            this.extractApiError(
              error
            );


          this.markingAllRead =
            false;
        }

      });
  }


  /* =========================
     REALTIME
     ========================= */

  private handleRealtimeNotification(
    notification:
      NotificationItem
  ): void {

    const exists =
      this.notifications
        .some(
          current =>
            current.id ===
            notification.id
        );


    if (!exists) {

      this.notifications = [
        notification,
        ...this.notifications
      ];


      if (
        !notification.isRead
      ) {

        this.unreadCount++;
      }
    }


    this.showToast(
      notification
    );
  }


  private showToast(
    notification:
      NotificationItem
  ): void {

    this.toastNotifications = [
      notification,
      ...this.toastNotifications
        .filter(
          current =>
            current.id !==
            notification.id
        )
    ]
      .slice(
        0,
        3
      );


    const existingTimer =
      this.toastTimers
        .get(
          notification.id
        );


    if (
      existingTimer
    ) {

      clearTimeout(
        existingTimer
      );
    }


    const timer =
      setTimeout(
        () => {

          this.dismissToast(
            notification.id
          );

        },
        8000
      );


    this.toastTimers
      .set(
        notification.id,
        timer
      );
  }


  dismissToast(
    notificationId: number
  ): void {

    this.toastNotifications =
      this.toastNotifications
        .filter(
          notification =>
            notification.id !==
            notificationId
        );


    const timer =
      this.toastTimers
        .get(
          notificationId
        );


    if (
      timer
    ) {

      clearTimeout(
        timer
      );

      this.toastTimers
        .delete(
          notificationId
        );
    }
  }


  openToast(
    notification:
      NotificationItem
  ): void {

    this.dismissToast(
      notification.id
    );


    this.notificationCenterOpen =
      true;

    this.notificationTab =
      'inbox';


    this.markNotificationRead(
      notification
    );
  }


  /* =========================
     WORKSPACES
     ========================= */

  private loadWorkspaces():
    void {

    this.workspacesLoading =
      true;


    this.notificationsService
      .getWorkspaces()
      .subscribe({

        next: workspaces => {

          this.workspaces =
            workspaces;


          this.workspacesLoading =
            false;
        },


        error: error => {

          console.error(
            'Notification workspaces failed:',
            error
          );


          this.workspacesLoading =
            false;
        }

      });
  }


  selectNotificationWorkspace(
    value: string
  ): void {

    const workspaceId =
      Number(
        value
      );


    const allowedWorkspace =
      this.notificationComposeWorkspaces
        .find(
          workspace =>
            workspace.id ===
            workspaceId
        );


    this.selectedWorkspaceId =
      allowedWorkspace
        ?.id
      ?? 0;


    this.members =
      [];

    this.selectedRecipientIds
      .clear();

    this.recipientSearch =
      '';

    this.composeError =
      '';

    this.composeSuccess =
      '';


    if (
      this.selectedWorkspaceId <=
      0
    ) {

      return;
    }


    this.loadWorkspaceMembers(
      this.selectedWorkspaceId
    );
  }


  private loadWorkspaceMembers(
    workspaceId: number
  ): void {

    this.membersLoading =
      true;


    this.notificationsService
      .getWorkspaceMembers(
        workspaceId
      )
      .subscribe({

        next: members => {

          this.members =
            [...members]
              .sort(
                (a, b) =>
                  a.fullName
                    .localeCompare(
                      b.fullName,
                      'ar'
                    )
              );


          this.membersLoading =
            false;
        },


        error: error => {

          console.error(
            'Notification members failed:',
            error
          );


          this.composeError =
            this.extractApiError(
              error
            );


          this.membersLoading =
            false;
        }

      });
  }


  /* =========================
     RECIPIENTS
     ========================= */

  setRecipientSearch(
    value: string
  ): void {

    this.recipientSearch =
      value;
  }


  get filteredNotificationMembers():
    NotificationWorkspaceMember[] {

    const query =
      this.normalizeSearch(
        this.recipientSearch
      );


    return this.members
      .filter(
        member =>
          this.isEligibleRecipient(
            member
          )
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


  toggleNotificationRecipient(
    userId: number
  ): void {

    const member =
      this.filteredNotificationMembers
        .find(
          item =>
            item.userId ===
            userId
        );


    if (!member) {
      return;
    }


    if (
      this.selectedRecipientIds
        .has(
          userId
        )
    ) {

      this.selectedRecipientIds
        .delete(
          userId
        );

    } else {

      this.selectedRecipientIds
        .add(
          userId
        );
    }
  }


  isRecipientSelected(
    userId: number
  ): boolean {

    return this.selectedRecipientIds
      .has(
        userId
      );
  }


  selectAllVisibleRecipients():
    void {

    for (
      const member
      of this.filteredNotificationMembers
    ) {

      this.selectedRecipientIds
        .add(
          member.userId
        );
    }
  }


  clearRecipients():
    void {

    this.selectedRecipientIds
      .clear();
  }


  /* =========================
     COMPOSE
     ========================= */

  setComposeTitle(
    value: string
  ): void {

    this.composeTitle =
      value;

    this.composeError =
      '';

    this.composeSuccess =
      '';
  }


  setComposeMessage(
    value: string
  ): void {

    this.composeMessage =
      value;

    this.composeError =
      '';

    this.composeSuccess =
      '';
  }


  sendNotification():
    void {

    if (
      this.sendingNotification
    ) {

      return;
    }


    if (
      !this.canComposeNotifications
    ) {

      this.composeError =
        'لا تملك صلاحية إنشاء إشعارات إدارية.';

      return;
    }


    const selectedWorkspace =
      this.selectedWorkspace();


    if (
      !selectedWorkspace ||
      !this.canRoleSendNotifications(
        selectedWorkspace.currentUserRole
      )
    ) {

      this.composeError =
        'لا تملك صلاحية إرسال إشعار ضمن مساحة العمل المحددة.';

      return;
    }


    const title =
      this.composeTitle
        .trim();


    const message =
      this.composeMessage
        .trim();


    if (
      this.selectedRecipientIds
        .size === 0
    ) {

      this.composeError =
        'اختر مستلمًا واحدًا على الأقل.';

      return;
    }


    const allowedIds =
      new Set(
        this.filteredNotificationMembers
          .map(
            member =>
              member.userId
          )
      );


    const recipientIds =
      Array.from(
        this.selectedRecipientIds
      )
        .filter(
          userId =>
            allowedIds.has(
              userId
            )
        );


    if (
      recipientIds.length ===
      0
    ) {

      this.composeError =
        'لا يوجد مستلم مسموح ضمن التحديد الحالي.';

      return;
    }


    if (
      title.length < 2
    ) {

      this.composeError =
        'اكتب عنوانًا واضحًا للإشعار.';

      return;
    }


    if (
      message.length < 2
    ) {

      this.composeError =
        'اكتب محتوى الإشعار.';

      return;
    }


    this.sendingNotification =
      true;

    this.composeError =
      '';

    this.composeSuccess =
      '';


    this.notificationsService
      .send({

        workspaceId:
          this.selectedWorkspaceId,

        recipientUserIds:
          recipientIds,

        title,

        message

      })
      .subscribe({

        next: () => {

          this.composeSuccess =
            'تم إرسال الإشعار بنجاح.';


          this.composeTitle =
            '';

          this.composeMessage =
            '';

          this.selectedRecipientIds
            .clear();


          this.sendingNotification =
            false;
        },


        error: error => {

          console.error(
            'Send notification failed:',
            error
          );


          this.composeError =
            this.extractApiError(
              error
            );


          this.sendingNotification =
            false;
        }

      });
  }


  /* =========================
     DISPLAY
     ========================= */

  notificationTitle(
    notification:
      NotificationItem
  ): string {

    switch (
      notification.type
    ) {

      case 'task.assigned':
      case 'task.assignee_added':
        return 'تم إسناد مهمة';

      case 'task.unassigned':
      case 'task.assignee_removed':
        return 'تم إزالة إسناد';

      case 'task.status_changed':
        return 'تغيرت حالة مهمة';

      case 'task.partially_completed':
        return 'إنجاز جزئي للمهمة';

      case 'task.progress_updated':
        return 'تحديث نسبة الإنجاز';

      case 'task.completed':
        return 'اكتملت المهمة';

      case 'task.reopened':
        return 'إعادة فتح مهمة';

      case 'task.cancelled':
        return 'إلغاء مهمة';

      case 'task.deleted':
        return 'حذف مهمة';

      case 'task.priority_changed':
        return 'تغيرت أولوية مهمة';

      case 'task.due_date_changed':
        return 'تغير موعد مهمة';

      case 'task.details_changed':
        return 'تعديل بيانات مهمة';

      case 'task.reminder.halfway':
        return 'تذكير بمنتصف مدة المهمة';

      case 'task.reminder.one_day':
        return 'المهمة تستحق غدًا';

      case 'task.reminder.one_hour':
        return 'موعد المهمة قريب';

      case 'task.reminder.overdue':
        return 'المهمة متأخرة';

      case 'manual.notification':
        return notification.title;

      default:
        return notification.title
          || 'إشعار جديد';
    }
  }


  notificationCategory(
    notification:
      NotificationItem
  ): NotificationCategory {

    switch (
      notification.type
    ) {

      case 'task.completed':
        return 'success';

      case 'task.reminder.overdue':
      case 'task.cancelled':
      case 'task.deleted':
        return 'danger';

      case 'task.reminder.one_day':
      case 'task.reminder.one_hour':
      case 'task.reminder.halfway':
      case 'task.partially_completed':
        return 'warning';

      case 'manual.notification':
        return 'manual';

      default:
        return 'default';
    }
  }


  actorLabel(
    notification:
      NotificationItem
  ): string {

    if (
      !notification.actorUserId ||
      notification.actorUserFullName ===
        'System'
    ) {

      return 'النظام';
    }


    return notification
      .actorUserFullName
      || 'مستخدم';
  }


  notificationInitial(
    notification:
      NotificationItem
  ): string {

    const actor =
      this.actorLabel(
        notification
      );


    return actor
      .charAt(0)
      .toUpperCase();
  }


  formatNotificationTime(
    value: string
  ): string {

    const date =
      new Date(
        value
      );


    const diff =
      Date.now() -
      date.getTime();


    const minute =
      60_000;

    const hour =
      60 * minute;

    const day =
      24 * hour;


    if (
      diff >= 0 &&
      diff < minute
    ) {

      return 'الآن';
    }


    if (
      diff >= minute &&
      diff < hour
    ) {

      const minutes =
        Math.floor(
          diff /
          minute
        );


      return `منذ ${minutes} دقيقة`;
    }


    if (
      diff >= hour &&
      diff < day
    ) {

      const hours =
        Math.floor(
          diff /
          hour
        );


      return `منذ ${hours} ساعة`;
    }


    return date
      .toLocaleString(
        'ar-SY',
        {
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }


  memberRoleLabel(
    role: string
  ): string {

    switch (
      role
    ) {

      case 'WorkspaceOwner':
      case 'Owner':
        return 'مالك المساحة';

      case 'ProjectManager':
        return 'مدير مشروع';

      case 'Member':
        return 'عضو';

      case 'SystemAdmin':
      case 'Admin':
        return 'مسؤول النظام';

      default:
        return role;
    }
  }


  /* =========================
     LOGOUT
     ========================= */

  logout(): void {

    void this.notificationRealtime
      .stop();


    this.tokenStorage.clear();


    this.router.navigateByUrl(
      '/login'
    );
  }


  /* =========================
     HELPERS
     ========================= */

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
}