import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient,
  HttpParams
} from '@angular/common/http';

import {
  Observable
} from 'rxjs';

import {
  environment
} from '../../../environments/environment';


export interface NotificationItem {
  id: number;
  userId: number;

  actorUserId:
    number | null;

  actorUserFullName:
    string;

  workspaceId:
    number | null;

  title: string;
  message: string;
  type: string;

  entityName:
    string | null;

  entityId:
    number | null;

  isRead: boolean;

  readAt:
    string | null;

  createdAt: string;
}


export interface NotificationWorkspace {
  id: number;
  name: string;

  currentUserRole:
    string;
}


export interface NotificationRecipient {
  userId: number;
  fullName: string;
  email: string;

  workspaceId:
    number | null;

  workspaceName:
    string | null;

  roleName:
    string | null;

  relationship: string;
}


export interface NotificationPageRequest {
  isRead?:
    boolean | null;

  actorUserId?:
    number | null;

  workspaceId?:
    number | null;

  source?:
    string | null;

  from?:
    string | null;

  to?:
    string | null;

  page: number;
  pageSize: number;
}


export interface NotificationPagedResponse {
  items:
    NotificationItem[];

  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasPreviousPage: boolean;
  hasNextPage: boolean;
}


export interface SendNotificationRequest {
  workspaceId:
    number | null;

  recipientUserIds:
    number[];

  title: string;
  message: string;
}


@Injectable({
  providedIn: 'root'
})
export class Notifications {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api/notifications`;


  /* =========================================================
     LEGACY / ALL
     ========================================================= */

  getMine():
    Observable<NotificationItem[]> {

    return this.http.get<
      NotificationItem[]
    >(
      this.baseUrl
    );
  }


  /* =========================================================
     FULL PAGE
     ========================================================= */

  getPage(
    request:
      NotificationPageRequest
  ): Observable<
    NotificationPagedResponse
  > {

    let params =
      new HttpParams()
        .set(
          'page',
          request.page
        )
        .set(
          'pageSize',
          request.pageSize
        );


    if (
      request.isRead !==
        null &&
      request.isRead !==
        undefined
    ) {

      params =
        params.set(
          'isRead',
          request.isRead
        );
    }


    if (
      request.actorUserId
    ) {

      params =
        params.set(
          'actorUserId',
          request.actorUserId
        );
    }


    if (
      request.workspaceId
    ) {

      params =
        params.set(
          'workspaceId',
          request.workspaceId
        );
    }


    if (
      request.source?.trim()
    ) {

      params =
        params.set(
          'source',
          request.source.trim()
        );
    }


    if (
      request.from
    ) {

      params =
        params.set(
          'from',
          request.from
        );
    }


    if (
      request.to
    ) {

      params =
        params.set(
          'to',
          request.to
        );
    }


    return this.http.get<
      NotificationPagedResponse
    >(
      `${this.baseUrl}/page`,
      {
        params
      }
    );
  }


  /* =========================================================
     QUICK BELL
     ========================================================= */

  getUnread(
    take = 8
  ): Observable<
    NotificationItem[]
  > {

    return this.http.get<
      NotificationItem[]
    >(
      `${this.baseUrl}/unread`,
      {
        params: {
          take
        }
      }
    );
  }


  getUnreadCount():
    Observable<number> {

    return this.http.get<number>(
      `${this.baseUrl}/unread-count`
    );
  }


  /* =========================================================
     RECIPIENTS
     ========================================================= */

  getAllowedRecipients(
    workspaceId?:
      number | null
  ): Observable<
    NotificationRecipient[]
  > {

    let params =
      new HttpParams();


    if (
      workspaceId &&
      workspaceId > 0
    ) {

      params =
        params.set(
          'workspaceId',
          workspaceId
        );
    }


    return this.http.get<
      NotificationRecipient[]
    >(
      `${this.baseUrl}/recipients`,
      {
        params
      }
    );
  }


  /* =========================================================
     READ STATE
     ========================================================= */

  markAsRead(
    notificationId: number
  ): Observable<void> {

    return this.http.patch<void>(
      `${this.baseUrl}/${notificationId}/read`,
      {}
    );
  }


  markAllAsRead():
    Observable<void> {

    return this.http.patch<void>(
      `${this.baseUrl}/read-all`,
      {}
    );
  }


  /* =========================================================
     MANUAL SEND
     ========================================================= */

  send(
    request:
      SendNotificationRequest
  ): Observable<void> {

    return this.http.post<void>(
      `${this.baseUrl}/send`,
      request
    );
  }


  /* =========================================================
     WORKSPACES
     ========================================================= */

  getWorkspaces():
    Observable<
      NotificationWorkspace[]
    > {

    return this.http.get<
      NotificationWorkspace[]
    >(
      `${
        environment.apiBaseUrl
      }/api/workspaces`
    );
  }
}