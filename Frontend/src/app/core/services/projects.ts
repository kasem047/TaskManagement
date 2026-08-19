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


export interface Project {
  id: number;

  workspaceId: number;

  managerUserId: number | null;

  managerUserFullName: string | null;

  name: string;

  description: string | null;

  isArchived: boolean;

  createdAt: string;

  updatedAt: string | null;
}


export interface CreateProjectRequest {
  name: string;

  description: string | null;

  managerUserId: number | null;
}


export interface UpdateProjectRequest {
  name: string;

  description: string | null;

  managerUserId: number | null;
}


@Injectable({
  providedIn: 'root'
})
export class Projects {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  private workspaceProjectsUrl(
    workspaceId: number
  ): string {

    return (
      `${this.baseUrl}/workspaces/${workspaceId}/projects`
    );
  }


  getByWorkspace(
    workspaceId: number
  ): Observable<Project[]> {

    return this.http
      .get<Project[]>(
        this.workspaceProjectsUrl(
          workspaceId
        )
      );
  }


  getById(
    workspaceId: number,
    projectId: number
  ): Observable<Project> {

    return this.http
      .get<Project>(
        `${this.workspaceProjectsUrl(workspaceId)}/${projectId}`
      );
  }


  create(
    workspaceId: number,
    request: CreateProjectRequest
  ): Observable<Project> {

    return this.http
      .post<Project>(
        this.workspaceProjectsUrl(
          workspaceId
        ),
        request
      );
  }


  update(
    workspaceId: number,
    projectId: number,
    request: UpdateProjectRequest
  ): Observable<Project> {

    return this.http
      .put<Project>(
        `${this.workspaceProjectsUrl(workspaceId)}/${projectId}`,
        request
      );
  }


  archive(
    workspaceId: number,
    projectId: number
  ): Observable<unknown> {

    return this.http
      .put(
        `${this.workspaceProjectsUrl(workspaceId)}/${projectId}/archive`,
        {}
      );
  }


  delete(
    workspaceId: number,
    projectId: number
  ): Observable<unknown> {

    return this.http
      .delete(
        `${this.workspaceProjectsUrl(workspaceId)}/${projectId}`
      );
  }
}