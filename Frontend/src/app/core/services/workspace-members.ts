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


export interface WorkspaceMember {

  id: number;

  workspaceId: number;

  userId: number;

  fullName: string;

  email: string;

  roleId: number;

  roleName: string;

  status: string;

  joinedAt: string;
}


export interface AddWorkspaceMemberRequest {

  userId: number;

  roleId: number;
}


export interface UpdateWorkspaceMemberRoleRequest {

  roleId: number;
}


@Injectable({
  providedIn: 'root'
})
export class WorkspaceMembers {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getByWorkspace(
    workspaceId: number
  ): Observable<WorkspaceMember[]> {

    return this.http
      .get<WorkspaceMember[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/members`
      );
  }


  getMembers(
    workspaceId: number
  ): Observable<WorkspaceMember[]> {

    return this.getByWorkspace(
      workspaceId
    );
  }


  getAll(
    workspaceId: number
  ): Observable<WorkspaceMember[]> {

    return this.getByWorkspace(
      workspaceId
    );
  }


  add(
    workspaceId: number,
    userId: number,
    roleId: number
  ): Observable<WorkspaceMember> {

    const request:
      AddWorkspaceMemberRequest = {

      userId,

      roleId
    };


    return this.http
      .post<WorkspaceMember>(
        `${this.baseUrl}/workspaces/${workspaceId}/members`,
        request
      );
  }


  addMember(
    workspaceId: number,
    userId: number,
    roleId: number
  ): Observable<WorkspaceMember> {

    return this.add(
      workspaceId,
      userId,
      roleId
    );
  }


  updateRole(
    workspaceId: number,
    memberId: number,
    roleId: number
  ): Observable<WorkspaceMember> {

    const request:
      UpdateWorkspaceMemberRoleRequest = {

      roleId
    };


    return this.http
      .put<WorkspaceMember>(
        `${this.baseUrl}/workspaces/${workspaceId}/members/${memberId}/role`,
        request
      );
  }


  updateMemberRole(
    workspaceId: number,
    memberId: number,
    roleId: number
  ): Observable<WorkspaceMember> {

    return this.updateRole(
      workspaceId,
      memberId,
      roleId
    );
  }


  remove(
    workspaceId: number,
    memberId: number
  ): Observable<unknown> {

    return this.http
      .delete(
        `${this.baseUrl}/workspaces/${workspaceId}/members/${memberId}`
      );
  }


  removeMember(
    workspaceId: number,
    memberId: number
  ): Observable<unknown> {

    return this.remove(
      workspaceId,
      memberId
    );
  }
}