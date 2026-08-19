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


export interface RoleItem {
  id: number;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  permissionCount: number;
}


export interface PermissionItem {
  id: number;
  name: string;
  description: string | null;
  module: string;
}


export interface RolePermissions {
  roleId: number;
  roleName: string;
  permissions: PermissionItem[];
}


export interface CreateRoleRequest {
  name: string;
  description: string | null;
  permissionIds: number[];
}


export interface UpdateRoleRequest {
  name: string;
  description: string | null;
}


export interface UpdateRolePermissionsRequest {
  permissionIds: number[];
}


@Injectable({
  providedIn: 'root'
})
export class RolesPermissions {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api/admin`;


  getRoles():
    Observable<RoleItem[]> {

    return this.http.get<RoleItem[]>(
      `${this.baseUrl}/roles`
    );
  }


  createRole(
    request: CreateRoleRequest
  ): Observable<RoleItem> {

    return this.http.post<RoleItem>(
      `${this.baseUrl}/roles`,
      request
    );
  }


  updateRole(
    roleId: number,
    request: UpdateRoleRequest
  ): Observable<RoleItem> {

    return this.http.put<RoleItem>(
      `${this.baseUrl}/roles/${roleId}`,
      request
    );
  }


  deleteRole(
    roleId: number
  ): Observable<void> {

    return this.http.delete<void>(
      `${this.baseUrl}/roles/${roleId}`
    );
  }


  getPermissions():
    Observable<PermissionItem[]> {

    return this.http.get<PermissionItem[]>(
      `${this.baseUrl}/permissions`
    );
  }


  getRolePermissions(
    roleId: number
  ): Observable<RolePermissions> {

    return this.http.get<RolePermissions>(
      `${this.baseUrl}/roles/${roleId}/permissions`
    );
  }


  updateRolePermissions(
    roleId: number,
    permissionIds: number[]
  ): Observable<RolePermissions> {

    const request:
      UpdateRolePermissionsRequest = {
        permissionIds
      };


    return this.http.put<RolePermissions>(
      `${this.baseUrl}/roles/${roleId}/permissions`,
      request
    );
  }
}