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


export interface AdminUser {
  id: number;
  userName: string;
  fullName: string;
  email: string;
  isActive: boolean;
  isSystemAdmin: boolean;
  ownsWorkspace: boolean;
  workspaceRole: string;
  roleDescription: string;
  createdAt: string;
  lastLoginAt: string | null;
}


export interface CreateAdminUserRequest {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
  isActive: boolean;
}


@Injectable({
  providedIn: 'root'
})
export class AdminUsers {

  private readonly http =
    inject(HttpClient);


  private readonly apiUrl =
    `${environment.apiBaseUrl}/api/admin/users`;


  getUsers(
    search?: string,
    isActive?: boolean | null
  ): Observable<AdminUser[]> {

    let params =
      new HttpParams();


    if (
      search &&
      search.trim()
    ) {

      params =
        params.set(
          'search',
          search.trim()
        );
    }


    if (
      isActive !==
      undefined &&
      isActive !==
      null
    ) {

      params =
        params.set(
          'isActive',
          String(isActive)
        );
    }


    return this.http.get<AdminUser[]>(
      this.apiUrl,
      {
        params
      }
    );
  }


  getUser(
    userId: number
  ): Observable<AdminUser> {

    return this.http.get<AdminUser>(
      `${this.apiUrl}/${userId}`
    );
  }


  createUser(
    request: CreateAdminUserRequest
  ): Observable<AdminUser> {

    return this.http.post<AdminUser>(
      this.apiUrl,
      request
    );
  }


  setActiveStatus(
    userId: number,
    isActive: boolean
  ): Observable<AdminUser> {

    return this.http.patch<AdminUser>(
      `${this.apiUrl}/${userId}/active-status`,
      {
        isActive
      }
    );
  }
}