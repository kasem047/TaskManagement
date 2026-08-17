import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient
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


export interface NotificationWorkspaceMember {

  id: number;

  workspaceId: number;

  userId: number;

  fullName: string;

  email: string;

  roleId: number;

  roleName: string;

  status: string;

  joinedAt: string;
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
    `${environment.apiBaseUrl}/api`;


  getMine():
    Observable<NotificationItem[]> {

    return this.http
      .get<NotificationItem[]>(
        `${this.baseUrl}/notifications`
      );
  }


  getUnreadCount():
    Observable<number> {

    return this.http
      .get<number>(
        `${this.baseUrl}/notifications/unread-count`
      );
  }


  markAsRead(
    notificationId: number
  ): Observable<void> {

    return this.http
      .patch<void>(
        `${this.baseUrl}/notifications/${notificationId}/read`,
        {}
      );
  }


  markAllAsRead():
    Observable<void> {

    return this.http
      .patch<void>(
        `${this.baseUrl}/notifications/read-all`,
        {}
      );
  }


  send(
    request:
      SendNotificationRequest
  ): Observable<void> {

    return this.http
      .post<void>(
        `${this.baseUrl}/notifications/send`,
        request
      );
  }


  getWorkspaces():
    Observable<NotificationWorkspace[]> {

    return this.http
      .get<NotificationWorkspace[]>(
        `${this.baseUrl}/workspaces`
      );
  }


  getWorkspaceMembers(
    workspaceId: number
  ): Observable<
    NotificationWorkspaceMember[]
  > {

    return this.http
      .get<
        NotificationWorkspaceMember[]
      >(
        `${this.baseUrl}/workspaces/${workspaceId}/members`
      );
  }
}