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


/* =========================================================
   TASK HISTORY
   ========================================================= */

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


/* =========================================================
   GLOBAL AUDIT
   ========================================================= */

export interface GlobalActivityLog {

  id: number;

  workspaceId: number;

  workspaceName: string;

  userId: number;

  userFullName: string;

  action: string;

  entityName: string;

  entityId: number;

  description:
    string | null;

  createdAt: string;
}


export interface GlobalActivityLogPage {

  items:
    GlobalActivityLog[];

  page: number;

  pageSize: number;

  totalCount: number;

  totalPages: number;

  hasPreviousPage: boolean;

  hasNextPage: boolean;
}


export interface GlobalActivityLogQuery {

  search?:
    string | null;

  workspaceId?:
    number | null;

  userId?:
    number | null;

  action?:
    string | null;

  entityName?:
    string | null;

  from?:
    string | null;

  to?:
    string | null;

  page: number;

  pageSize: number;
}


@Injectable({
  providedIn: 'root'
})
export class ActivityLogs {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  /* =========================================================
     TASK HISTORY
     ========================================================= */

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


  /* =========================================================
     GLOBAL SYSTEM AUDIT
     ========================================================= */

  getGlobalAudit(
    query:
      GlobalActivityLogQuery
  ): Observable<
    GlobalActivityLogPage
  > {

    let params =
      new HttpParams()
        .set(
          'page',
          query.page
        )
        .set(
          'pageSize',
          query.pageSize
        );


    if (
      query.search?.trim()
    ) {

      params =
        params.set(
          'search',
          query.search.trim()
        );
    }


    if (
      query.workspaceId &&
      query.workspaceId > 0
    ) {

      params =
        params.set(
          'workspaceId',
          query.workspaceId
        );
    }


    if (
      query.userId &&
      query.userId > 0
    ) {

      params =
        params.set(
          'userId',
          query.userId
        );
    }


    if (
      query.action?.trim()
    ) {

      params =
        params.set(
          'action',
          query.action.trim()
        );
    }


    if (
      query.entityName?.trim()
    ) {

      params =
        params.set(
          'entityName',
          query.entityName.trim()
        );
    }


    if (
      query.from
    ) {

      params =
        params.set(
          'from',
          query.from
        );
    }


    if (
      query.to
    ) {

      params =
        params.set(
          'to',
          query.to
        );
    }


    return this.http
      .get<GlobalActivityLogPage>(
        `${this.baseUrl}/admin/activity-logs`,
        {
          params
        }
      );
  }
}