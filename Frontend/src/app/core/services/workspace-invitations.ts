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


export interface WorkspaceInvitation {
  id: number;

  workspaceId: number;
  workspaceName: string;

  invitedUserId: number;
  invitedUserFullName: string;

  invitedByUserId: number;
  invitedByUserFullName: string;

  roleId: number;
  roleName: string;

  status: string;

  createdAt: string;
  respondedAt: string | null;
}


export interface WorkspaceInvitationCreateResult {
  addedDirectly: boolean;

  message: string;

  member: {
    id: number;

    workspaceId: number;

    userId: number;

    fullName: string;

    email: string;

    roleId: number;

    roleName: string;

    status: string;

    joinedAt: string;
  } | null;

  invitation:
    WorkspaceInvitation | null;
}


export interface CreateWorkspaceInvitationRequest {
  userId: number;
  roleId: number;
}


@Injectable({
  providedIn: 'root'
})
export class WorkspaceInvitations {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  /*
   * الاسم القديم مستخدم حاليًا
   * داخل Notifications page.
   *
   * نحتفظ به حتى لا نكسر
   * أي جزء موجود من الواجهة.
   */
  getMine():
    Observable<WorkspaceInvitation[]> {

    return this.getMyInvitations();
  }


  getMyInvitations():
    Observable<WorkspaceInvitation[]> {

    return this.http.get<
      WorkspaceInvitation[]
    >(
      `${this.baseUrl}/workspace-invitations`
    );
  }


  accept(
    invitationId: number
  ): Observable<unknown> {

    return this.http.post(
      `${this.baseUrl}/workspace-invitations/${invitationId}/accept`,
      {}
    );
  }


  reject(
    invitationId: number
  ): Observable<unknown> {

    return this.http.post(
      `${this.baseUrl}/workspace-invitations/${invitationId}/reject`,
      {}
    );
  }


  getWorkspaceInvitations(
    workspaceId: number
  ): Observable<WorkspaceInvitation[]> {

    return this.http.get<
      WorkspaceInvitation[]
    >(
      `${this.baseUrl}/workspaces/${workspaceId}/invitations`
    );
  }


  create(
    workspaceId: number,
    userId: number,
    roleId: number
  ): Observable<WorkspaceInvitationCreateResult> {

    const request:
      CreateWorkspaceInvitationRequest = {

      userId,
      roleId
    };


    return this.http.post<
      WorkspaceInvitationCreateResult
    >(
      `${this.baseUrl}/workspaces/${workspaceId}/invitations`,
      request
    );
  }


  cancel(
    workspaceId: number,
    invitationId: number
  ): Observable<unknown> {

    return this.http.delete(
      `${this.baseUrl}/workspaces/${workspaceId}/invitations/${invitationId}`
    );
  }
}