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


export interface ActivityWorkspace {

  id: number;

  name: string;

  description:
    string | null;

  createdByUserId:
    number;

  createdByUserName:
    string;

  currentUserRole:
    string;

  createdAt:
    string;
}


export interface WorkspaceActivityLog {

  id: number;

  workspaceId: number;

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


@Injectable({
  providedIn: 'root'
})
export class WorkspaceActivityLogs {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getMyWorkspaces():
    Observable<ActivityWorkspace[]> {

    return this.http
      .get<ActivityWorkspace[]>(
        `${this.baseUrl}/workspaces`
      );
  }


  getByWorkspace(
    workspaceId: number
  ): Observable<WorkspaceActivityLog[]> {

    return this.http
      .get<WorkspaceActivityLog[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/activity-logs`
      );
  }
}