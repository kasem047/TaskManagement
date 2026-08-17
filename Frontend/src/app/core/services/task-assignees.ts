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


export interface TaskAssignee {
  id: number;
  taskItemId: number;
  userId: number;
  userFullName: string;
  assignedAt: string;
}


export type TaskAssigneeResponse =
  TaskAssignee;


export interface AssignTaskRequest {
  userId: number;
}


@Injectable({
  providedIn: 'root'
})
export class TaskAssignees {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getAll(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskAssignee[]> {

    return this.http.get<TaskAssignee[]>(
      `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/assignees`
    );
  }


  getByTask(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskAssignee[]> {

    return this.getAll(
      workspaceId,
      projectId,
      taskId
    );
  }


  getTaskAssignees(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskAssignee[]> {

    return this.getAll(
      workspaceId,
      projectId,
      taskId
    );
  }


  assignUser(
    workspaceId: number,
    projectId: number,
    taskId: number,
    request: AssignTaskRequest
  ): Observable<TaskAssignee> {

    return this.http.post<TaskAssignee>(
      `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/assignees`,
      request
    );
  }


  assign(
    workspaceId: number,
    projectId: number,
    taskId: number,
    userId: number
  ): Observable<TaskAssignee> {

    return this.assignUser(
      workspaceId,
      projectId,
      taskId,
      {
        userId
      }
    );
  }


  removeAssignee(
    workspaceId: number,
    projectId: number,
    taskId: number,
    userId: number
  ): Observable<unknown> {

    return this.http.delete(
      `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/assignees/${userId}`
    );
  }


  remove(
    workspaceId: number,
    projectId: number,
    taskId: number,
    userId: number
  ): Observable<unknown> {

    return this.removeAssignee(
      workspaceId,
      projectId,
      taskId,
      userId
    );
  }
}