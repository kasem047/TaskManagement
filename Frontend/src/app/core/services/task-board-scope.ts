import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  catchError,
  forkJoin,
  map,
  of,
  switchMap
} from 'rxjs';

import {
  TaskItem,
  Tasks
} from './tasks';

import {
  TaskAssignee,
  TaskAssignees
} from './task-assignees';

import {
  environment
} from '../../../environments/environment';


/* =========================
   WORKSPACE
   ========================= */

export interface BoardWorkspace {

  id: number;

  name: string;

  description?:
    string | null;

  currentUserRole: string;
}


/* =========================
   PROJECT
   ========================= */

export interface BoardProject {

  id: number;

  workspaceId: number;

  name: string;

  isArchived: boolean;

  workspaceName: string;

  workspaceRole: string;
}


/* =========================
   TASK
   ========================= */

export interface BoardTask
  extends TaskItem {

  workspaceId: number;

  workspaceName: string;

  projectName: string;

  workspaceRole: string;

  projectArchived: boolean;


  /*
   * الأشخاص المسندة إليهم المهمة.
   * بيانات حقيقية من Backend.
   */
  assignees:
    TaskAssignee[];
}


/* =========================
   BOARD SNAPSHOT
   ========================= */

export interface TaskBoardSnapshot {

  workspaces:
    BoardWorkspace[];

  projects:
    BoardProject[];

  tasks:
    BoardTask[];
}


/* =========================
   INTERNAL PROJECT RESPONSE
   ========================= */

interface ProjectApiResponse {

  id: number;

  workspaceId: number;

  name: string;

  description?:
    string | null;

  managerUserId?:
    number | null;

  managerUserFullName?:
    string | null;

  isArchived: boolean;

  createdAt?: string;

  updatedAt?:
    string | null;
}


/* =========================
   WORKSPACE RESULT
   ========================= */

interface WorkspaceBoardResult {

  projects:
    BoardProject[];

  tasks:
    BoardTask[];
}


/* =========================
   SERVICE
   ========================= */

@Injectable({
  providedIn: 'root'
})
export class TaskBoardScope {

  private readonly http =
    inject(HttpClient);


  private readonly tasksService =
    inject(Tasks);


  private readonly taskAssigneesService =
    inject(TaskAssignees);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  /* =========================
     LOAD COMPLETE ACCESSIBLE BOARD
     ========================= */

  loadAccessibleBoard():
    Observable<TaskBoardSnapshot> {

    return this.http
      .get<BoardWorkspace[]>(
        `${this.baseUrl}/workspaces`
      )
      .pipe(

        switchMap(
          (
            workspaces:
              BoardWorkspace[]
          ) => {

            if (
              workspaces.length === 0
            ) {

              return of<TaskBoardSnapshot>({
                workspaces: [],
                projects: [],
                tasks: []
              });
            }


            const workspaceRequests:
              Observable<WorkspaceBoardResult>[] =
              workspaces.map(
                workspace =>
                  this.loadWorkspace(
                    workspace
                  )
              );


            return forkJoin(
              workspaceRequests
            )
              .pipe(

                map(
                  (
                    results:
                      WorkspaceBoardResult[]
                  ):
                    TaskBoardSnapshot => {

                    return {

                      workspaces,

                      projects:
                        results.flatMap(
                          result =>
                            result.projects
                        ),

                      tasks:
                        results.flatMap(
                          result =>
                            result.tasks
                        )

                    };
                  }
                )

              );
          }
        )

      );
  }


  /* =========================
     LOAD WORKSPACE
     ========================= */

  private loadWorkspace(
    workspace:
      BoardWorkspace
  ): Observable<WorkspaceBoardResult> {

    return this.http
      .get<ProjectApiResponse[]>(
        `${this.baseUrl}/workspaces/${workspace.id}/projects`
      )
      .pipe(

        catchError(
          () =>
            of<ProjectApiResponse[]>(
              []
            )
        ),


        switchMap(
          (
            projectResponses:
              ProjectApiResponse[]
          ) => {

            const projects:
              BoardProject[] =
              projectResponses.map(
                project => ({

                  id:
                    project.id,

                  workspaceId:
                    project.workspaceId,

                  name:
                    project.name,

                  isArchived:
                    project.isArchived,

                  workspaceName:
                    workspace.name,

                  workspaceRole:
                    workspace.currentUserRole

                })
              );


            if (
              projects.length === 0
            ) {

              return of<WorkspaceBoardResult>({
                projects,
                tasks: []
              });
            }


            const projectTaskRequests:
              Observable<BoardTask[]>[] =
              projects.map(
                project =>
                  this.loadProjectTasks(
                    workspace,
                    project
                  )
              );


            return forkJoin(
              projectTaskRequests
            )
              .pipe(

                map(
                  (
                    taskGroups:
                      BoardTask[][]
                  ):
                    WorkspaceBoardResult => {

                    return {

                      projects,

                      tasks:
                        taskGroups.flat()

                    };
                  }
                )

              );
          }
        )

      );
  }


  /* =========================
     LOAD PROJECT TASKS
     ========================= */

  private loadProjectTasks(
    workspace:
      BoardWorkspace,

    project:
      BoardProject
  ): Observable<BoardTask[]> {

    /*
     * مهم:
     *
     * نستخدم Tasks Service بدل HttpClient مباشرة
     * حتى تمر الحالة القادمة من Backend:
     *
     * PartiallyCompleted
     *
     * عبر normalizeTask()
     * وتصبح InReview داخليًا للواجهة الحالية.
     */
    return this.tasksService
      .getByProject(
        workspace.id,
        project.id
      )
      .pipe(

        catchError(
          error => {

            console.error(
              `Failed to load tasks for project ${project.id}:`,
              error
            );


            return of<TaskItem[]>(
              []
            );
          }
        ),


        switchMap(
          (
            tasks:
              TaskItem[]
          ) => {

            if (
              tasks.length === 0
            ) {

              return of<BoardTask[]>(
                []
              );
            }


            const taskRequests:
              Observable<BoardTask>[] =
              tasks.map(
                task =>
                  this.loadTaskWithAssignees(
                    workspace,
                    project,
                    task
                  )
              );


            return forkJoin(
              taskRequests
            );
          }
        )

      );
  }


  /* =========================
     LOAD TASK + ASSIGNEES
     ========================= */

  private loadTaskWithAssignees(
    workspace:
      BoardWorkspace,

    project:
      BoardProject,

    task:
      TaskItem
  ): Observable<BoardTask> {

    return this.taskAssigneesService
      .getByTask(
        workspace.id,
        project.id,
        task.id
      )
      .pipe(

        catchError(
          error => {

            console.error(
              `Failed to load assignees for task ${task.id}:`,
              error
            );


            return of<TaskAssignee[]>(
              []
            );
          }
        ),


        map(
          (
            assignees:
              TaskAssignee[]
          ):
            BoardTask => {

            return {

              ...task,

              workspaceId:
                workspace.id,

              workspaceName:
                workspace.name,

              projectName:
                project.name,

              workspaceRole:
                workspace.currentUserRole,

              projectArchived:
                project.isArchived,

              assignees

            };
          }
        )

      );
  }
}