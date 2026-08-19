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
  Notifications
} from '../../core/services/notifications';

import {
  NotificationRealtime
} from '../../core/services/notification-realtime';

import {
  Auth
} from '../../core/services/auth';


type NotificationCategory =
  | 'default'
  | 'success'
  | 'warning'
  | 'danger'
  | 'manual';


@Component({
  selector:
    'app-main-layout',

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


  private readonly realtime =
    inject(NotificationRealtime);


  private readonly auth =
    inject(Auth);


  private readonly router =
    inject(Router);


  readonly user =
    this.tokenStorage
      .getUser();


  isSystemAdmin =
    false;


  /* =========================================================
     QUICK NOTIFICATIONS
     ========================================================= */

  quickOpen =
    false;


  quickNotifications:
    NotificationItem[] = [];


  unreadCount =
    0;


  quickLoading =
    false;


  quickError =
    '';


  /* =========================================================
     REALTIME TOAST
     ========================================================= */

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


  ngOnInit(): void {

    this.detectSystemAdmin();

    this.loadQuickSummary();


    this.realtimeSubscription =
      this.realtime.received$
        .subscribe(
          notification => {

            this.handleRealtimeNotification(
              notification
            );
          }
        );


    this.realtime.start();
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


    this.toastTimers.clear();
  }


  /* =========================================================
     SYSTEM ADMIN
     ========================================================= */

  private detectSystemAdmin():
    void {

    /*
     * لا نستخدم /api/admin/dashboard
     * لاكتشاف صلاحية المستخدم لأن ذلك
     * يولد 403 طبيعي لكل مستخدم عادي.
     *
     * Profile endpoint متاح للمستخدم
     * الحالي ويحتوي isSystemAdmin.
     */
    this.auth
      .getProfile()
      .subscribe({

        next: profile => {

          this.isSystemAdmin =
            profile.isSystemAdmin === true;
        },

        error: () => {

          this.isSystemAdmin =
            false;
        }

      });
  }


  /* =========================================================
     QUICK BELL
     ========================================================= */

  toggleQuickNotifications():
    void {

    this.quickOpen =
      !this.quickOpen;


    if (
      this.quickOpen
    ) {

      this.loadQuickNotifications();
    }
  }


  closeQuickNotifications():
    void {

    this.quickOpen =
      false;
  }


  loadQuickSummary():
    void {

    forkJoin({

      notifications:
        this.notificationsService
          .getUnread(8),

      count:
        this.notificationsService
          .getUnreadCount()

    })
      .subscribe({

        next: result => {

          this.quickNotifications =
            result.notifications;

          this.unreadCount =
            result.count;
        },

        error: error => {

          console.error(
            'Notification summary failed:',
            error
          );
        }

      });
  }


  loadQuickNotifications():
    void {

    this.quickLoading =
      true;

    this.quickError =
      '';


    forkJoin({

      notifications:
        this.notificationsService
          .getUnread(8),

      count:
        this.notificationsService
          .getUnreadCount()

    })
      .subscribe({

        next: result => {

          this.quickNotifications =
            result.notifications;

          this.unreadCount =
            result.count;

          this.quickLoading =
            false;
        },

        error: error => {

          this.quickError =
            this.extractApiError(
              error
            );

          this.quickLoading =
            false;
        }

      });
  }


  openNotification(
    notification:
      NotificationItem
  ): void {

    if (
      !notification.isRead
    ) {

      this.notificationsService
        .markAsRead(
          notification.id
        )
        .subscribe({

          next: () => {

            this.quickNotifications =
              this.quickNotifications
                .filter(
                  current =>
                    current.id !==
                    notification.id
                );

            this.unreadCount =
              Math.max(
                0,
                this.unreadCount - 1
              );
          }

        });
    }


    this.quickOpen =
      false;


    void this.router.navigate(
      [
        '/notifications'
      ]
    );
  }


  openAllNotifications():
    void {

    this.quickOpen =
      false;


    void this.router.navigate(
      [
        '/notifications'
      ]
    );
  }


  /* =========================================================
     REALTIME
     ========================================================= */

  private handleRealtimeNotification(
    notification:
      NotificationItem
  ): void {

    if (
      !notification.isRead
    ) {

      const exists =
        this.quickNotifications
          .some(
            current =>
              current.id ===
                notification.id
          );


      if (!exists) {

        this.quickNotifications = [
          notification,
          ...this.quickNotifications
        ]
          .slice(
            0,
            8
          );


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


    const oldTimer =
      this.toastTimers
        .get(
          notification.id
        );


    if (oldTimer) {

      clearTimeout(
        oldTimer
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


    this.toastTimers.set(
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


    if (timer) {

      clearTimeout(
        timer
      );

      this.toastTimers.delete(
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


    this.openNotification(
      notification
    );
  }


  /* =========================================================
     SIDEBAR ACTIVE ROUTES
     ========================================================= */

  isProjectsRoute():
    boolean {

    const url =
      this.router.url
        .split('?')[0]
        .split('#')[0];


    return (
      url === '/projects'
      ||
      /^\/workspaces\/\d+\/projects\/?$/
        .test(url)
    );
  }


  isTasksRoute():
    boolean {

    const url =
      this.router.url
        .split('?')[0]
        .split('#')[0];


    return (
      url === '/tasks'
      ||
      /^\/workspaces\/\d+\/projects\/\d+\/tasks(?:\/.*)?$/
        .test(url)
    );
  }


  /* =========================================================
     DISPLAY
     ========================================================= */

  notificationCategory(
    notification:
      NotificationItem
  ): NotificationCategory {

    const type =
      notification.type
        .toLowerCase();


    if (
      type.includes(
        'deleted'
      ) ||
      type.includes(
        'rejected'
      ) ||
      type.includes(
        'overdue'
      )
    ) {

      return 'danger';
    }


    if (
      type.includes(
        'accepted'
      ) ||
      type.includes(
        'added'
      ) ||
      type.includes(
        'completed'
      )
    ) {

      return 'success';
    }


    if (
      type.includes(
        'due'
      ) ||
      type.includes(
        'reminder'
      ) ||
      type.includes(
        'manager_required'
      )
    ) {

      return 'warning';
    }


    if (
      type ===
        'manual.notification'
    ) {

      return 'manual';
    }


    return 'default';
  }


  notificationTitle(
    notification:
      NotificationItem
  ): string {

    return (
      notification.title
      ||
      'إشعار جديد'
    );
  }


  actorLabel(
    notification:
      NotificationItem
  ): string {

    return (
      notification.actorUserFullName
      ||
      'النظام'
    );
  }


  formatNotificationTime(
    value: string
  ): string {

    const date =
      new Date(
        value
      );


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return '';
    }


    return new Intl
      .DateTimeFormat(
        'ar-SY',
        {
          dateStyle:
            'short',

          timeStyle:
            'short'
        }
      )
      .format(
        date
      );
  }


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