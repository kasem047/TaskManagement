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


export interface TaskActivityLog {

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
export class ActivityLogs {

  private readonly http =
    inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getTaskHistory(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskActivityLog[]> {

    return this.http
      .get<TaskActivityLog[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/activity-logs`
      );
  }
}