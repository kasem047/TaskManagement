import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  map
} from 'rxjs';

import {
  environment
} from '../../../environments/environment';


/*
 * الاسم الداخلي الحالي للواجهة يبقى InReview
 * مؤقتًا حتى لا نضطر لتعديل HTML / SCSS بالكامل الآن.
 *
 * Backend:
 * PartiallyCompleted = 3
 *
 * Frontend مؤقتًا:
 * InReview = 3
 */
export type TaskStatus =
  | 'Todo'
  | 'InProgress'
  | 'InReview'
  | 'Done'
  | 'Cancelled';


type TaskApiStatus =
  | 'Todo'
  | 'InProgress'
  | 'InReview'
  | 'PartiallyCompleted'
  | 'Done'
  | 'Cancelled';


export type TaskStatusValue =
  | 1
  | 2
  | 3
  | 4
  | 5;


export type TaskPriority =
  | 'Low'
  | 'Medium'
  | 'High'
  | 'Critical';


export type TaskPriorityValue =
  | 1
  | 2
  | 3
  | 4;


export interface TaskItem {

  id: number;

  projectId: number;

  title: string;

  description: string | null;

  status: TaskStatus;

  priority: TaskPriority;

  dueDate: string | null;

  position: number;

  createdByUserId: number;


  /*
   * REAL BACKEND PROGRESS
   */
  progressPercentage:
    number | null;

  progressNote:
    string | null;

  progressUpdatedAt:
    string | null;


  /*
   * بقي موجودًا للتوافق مع الواجهة الحالية.
   * الاعتماديات الحقيقية أصبحت تُقرأ من
   * endpoint مستقل.
   */
  hasDependencies?:
    boolean;


  createdAt: string;

  updatedAt: string | null;
}


interface TaskApiItem {

  id: number;

  projectId: number;

  title: string;

  description: string | null;

  status: TaskApiStatus;

  priority: TaskPriority;

  dueDate: string | null;

  position: number;

  createdByUserId: number;

  progressPercentage:
    number | null;

  progressNote:
    string | null;

  progressUpdatedAt:
    string | null;

  createdAt: string;

  updatedAt: string | null;
}


export interface CreateTaskRequest {

  title: string;

  description: string | null;

  priority: TaskPriorityValue;

  dueDate: string | null;
}


export interface UpdateTaskRequest {

  title: string;

  description: string | null;

  priority: TaskPriorityValue;

  dueDate: string | null;
}


export interface UpdateTaskStatusRequest {

  status:
    | TaskStatusValue
    | TaskStatus
    | 'PartiallyCompleted';

  position: number;

  progressPercentage?:
    number | null;

  progressNote?:
    string | null;

  changeReason?:
    string | null;
}


/* =========================================================
   DEPENDENCIES
   ========================================================= */

export interface TaskDependency {

  taskId: number;

  dependsOnTaskId: number;

  dependsOnTaskTitle: string;

  dependsOnTaskStatus: string;

  isSatisfied: boolean;
}


export interface SetTaskDependenciesRequest {

  dependsOnTaskIds:
    number[];
}


@Injectable({
  providedIn: 'root'
})
export class Tasks {

  private readonly http =
    inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getByProject(
    workspaceId: number,
    projectId: number
  ): Observable<TaskItem[]> {

    return this.http
      .get<TaskApiItem[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks`
      )
      .pipe(

        map(
          tasks =>
            tasks.map(
              task =>
                this.normalizeTask(
                  task
                )
            )
        )

      );
  }


  create(
    workspaceId: number,
    projectId: number,
    request: CreateTaskRequest
  ): Observable<TaskItem> {

    return this.http
      .post<TaskApiItem>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks`,
        request
      )
      .pipe(

        map(
          task =>
            this.normalizeTask(
              task
            )
        )

      );
  }


  update(
    workspaceId: number,
    projectId: number,
    taskId: number,
    request: UpdateTaskRequest
  ): Observable<TaskItem> {

    return this.http
      .put<TaskApiItem>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}`,
        request
      )
      .pipe(

        map(
          task =>
            this.normalizeTask(
              task
            )
        )

      );
  }


  updateStatus(
    workspaceId: number,
    projectId: number,
    taskId: number,
    request: UpdateTaskStatusRequest
  ): Observable<TaskItem> {

    return this.http
      .put<TaskApiItem>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/status`,
        request
      )
      .pipe(

        map(
          task =>
            this.normalizeTask(
              task
            )
        )

      );
  }


  /* =========================================================
     DEPENDENCIES
     ========================================================= */

  getDependencies(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskDependency[]> {

    return this.http
      .get<TaskDependency[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/dependencies`
      );
  }


  setDependencies(
    workspaceId: number,
    projectId: number,
    taskId: number,
    dependsOnTaskIds: number[]
  ): Observable<TaskDependency[]> {

    const request:
      SetTaskDependenciesRequest = {

      dependsOnTaskIds
    };


    return this.http
      .put<TaskDependency[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/dependencies`,
        request
      );
  }


  private normalizeTask(
    task: TaskApiItem
  ): TaskItem {

    return {

      ...task,

      status:
        task.status ===
          'PartiallyCompleted'

          ? 'InReview'

          : task.status as
              TaskStatus,

      progressPercentage:
        task.progressPercentage
        ?? null,

      progressNote:
        task.progressNote
        ?? null,

      progressUpdatedAt:
        task.progressUpdatedAt
        ?? null

    };
  }
}