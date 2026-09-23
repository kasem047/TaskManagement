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


export interface AdminDashboard {

  totalUsers: number;

  activeUsers: number;

  inactiveUsers: number;

  totalWorkspaces: number;

  totalProjects: number;

  activeProjects: number;

  archivedProjects: number;

  totalTasks: number;

  todoTasks: number;

  inProgressTasks: number;

  inReviewTasks: number;

  doneTasks: number;

  cancelledTasks: number;
}


@Injectable({
  providedIn: 'root'
})
export class Admin {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api/admin`;


  exportDashboard(
    format:
      'excel' | 'pdf'
  ): Observable<Blob> {

    return this.http
      .get(
        `${this.baseUrl}/dashboard/export/${format}`,
        {
          responseType:
            'blob'
        }
      );
  }


  getDashboard():
    Observable<AdminDashboard> {

    return this.http
      .get<AdminDashboard>(
        `${this.baseUrl}/dashboard`
      );
  }
}