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


export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  createdByUserId: number;
  createdByUserName: string;
  currentUserRole: string;
  createdAt: string;
}


export interface CreateWorkspaceRequest {
  name: string;
  description: string | null;
}


export interface UpdateWorkspaceRequest {
  name: string;
  description: string | null;
}


export interface TransferWorkspaceOwnershipRequest {
  newOwnerUserId: number;
}


@Injectable({
  providedIn: 'root'
})
export class Workspaces {

  private readonly http =
    inject(HttpClient);


  private readonly apiUrl =
    `${environment.apiBaseUrl}/api/Workspaces`;


  getAll():
    Observable<Workspace[]> {

    return this.http
      .get<Workspace[]>(
        this.apiUrl
      );
  }


  getById(
    workspaceId: number
  ): Observable<Workspace> {

    return this.http
      .get<Workspace>(
        `${this.apiUrl}/${workspaceId}`
      );
  }


  create(
    request: CreateWorkspaceRequest
  ): Observable<Workspace> {

    return this.http
      .post<Workspace>(
        this.apiUrl,
        request
      );
  }


  update(
    workspaceId: number,
    request: UpdateWorkspaceRequest
  ): Observable<Workspace> {

    return this.http
      .put<Workspace>(
        `${this.apiUrl}/${workspaceId}`,
        request
      );
  }


  delete(
    workspaceId: number
  ): Observable<unknown> {

    return this.http
      .delete(
        `${this.apiUrl}/${workspaceId}`
      );
  }


  transferOwnership(
    workspaceId: number,
    newOwnerUserId: number
  ): Observable<unknown> {

    const request:
      TransferWorkspaceOwnershipRequest = {

      newOwnerUserId
    };


    return this.http.post(
      `${this.apiUrl}/${workspaceId}/transfer-ownership`,
      request
    );
  }


  leave(
    workspaceId: number
  ): Observable<unknown> {

    return this.http.post(
      `${this.apiUrl}/${workspaceId}/leave`,
      {}
    );
  }
}