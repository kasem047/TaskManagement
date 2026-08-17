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


@Injectable({
  providedIn: 'root'
})
export class Projects {

  private readonly http =
    inject(HttpClient);

  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getByWorkspace(
    workspaceId: number
  ): Observable<Project[]> {

    return this.http.get<Project[]>(
      `${this.baseUrl}/workspaces/${workspaceId}/projects`
    );
  }
}