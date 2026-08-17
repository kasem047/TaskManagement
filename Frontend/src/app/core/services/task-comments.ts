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


export interface TaskComment {

  id: number;

  taskItemId: number;

  userId: number;

  userFullName: string;

  content: string;

  createdAt: string;

  updatedAt:
    string | null;
}


export interface CreateTaskCommentRequest {

  content: string;
}


export interface UpdateTaskCommentRequest {

  content: string;
}


@Injectable({
  providedIn: 'root'
})
export class TaskComments {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getAll(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskComment[]> {

    return this.http
      .get<TaskComment[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`
      );
  }


  create(
    workspaceId: number,
    projectId: number,
    taskId: number,
    request:
      CreateTaskCommentRequest
  ): Observable<TaskComment> {

    return this.http
      .post<TaskComment>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments`,
        request
      );
  }


  update(
    workspaceId: number,
    projectId: number,
    taskId: number,
    commentId: number,
    request:
      UpdateTaskCommentRequest
  ): Observable<TaskComment> {

    return this.http
      .put<TaskComment>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`,
        request
      );
  }


  delete(
    workspaceId: number,
    projectId: number,
    taskId: number,
    commentId: number
  ): Observable<unknown> {

    return this.http
      .delete(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/comments/${commentId}`
      );
  }

}