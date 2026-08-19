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


export interface UserPermissionItem {

  permissionId:
    number;

  permissionName:
    string;

  module:
    string;

  description:
    string | null;

  grantedByRole:
    boolean;

  overrideGranted:
    boolean | null;

  effectiveGranted:
    boolean;

  overrideReason:
    string | null;
}


export interface SetUserPermissionOverrideRequest {

  permissionId:
    number;

  isGranted:
    boolean;

  reason:
    string | null;
}


@Injectable({
  providedIn:
    'root'
})
export class UserPermissions {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api/workspaces`;


  getUserPermissions(
    workspaceId: number,
    userId: number
  ): Observable<
    UserPermissionItem[]
  > {

    return this.http.get<
      UserPermissionItem[]
    >(
      `${this.baseUrl}/${workspaceId}/members/${userId}/permissions`
    );
  }


  setOverride(
    workspaceId: number,
    userId: number,
    permissionId: number,
    isGranted: boolean,
    reason:
      string | null
  ): Observable<
    UserPermissionItem
  > {

    const request:
      SetUserPermissionOverrideRequest = {

      permissionId,

      isGranted,

      reason:
        reason?.trim()
          ? reason.trim()
          : null
    };


    return this.http.put<
      UserPermissionItem
    >(
      `${this.baseUrl}/${workspaceId}/members/${userId}/permissions`,
      request
    );
  }


  removeOverride(
    workspaceId: number,
    userId: number,
    permissionId: number
  ): Observable<void> {

    return this.http.delete<void>(
      `${this.baseUrl}/${workspaceId}/members/${userId}/permissions/${permissionId}`
    );
  }
}