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


export interface TaskAttachment {

  id: number;

  taskItemId: number;

  userId: number;

  userFullName: string;

  fileName: string;

  contentType: string;

  fileSize: number;

  createdAt: string;
}


@Injectable({
  providedIn: 'root'
})
export class TaskAttachments {

  private readonly http =
    inject(HttpClient);


  private readonly baseUrl =
    `${environment.apiBaseUrl}/api`;


  getAll(
    workspaceId: number,
    projectId: number,
    taskId: number
  ): Observable<TaskAttachment[]> {

    return this.http
      .get<TaskAttachment[]>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments`
      );
  }


  upload(
    workspaceId: number,
    projectId: number,
    taskId: number,
    file: File
  ): Observable<TaskAttachment> {

    const formData =
      new FormData();


    formData.append(
      'file',
      file,
      file.name
    );


    return this.http
      .post<TaskAttachment>(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments`,
        formData
      );
  }


  download(
    workspaceId: number,
    projectId: number,
    taskId: number,
    attachmentId: number
  ): Observable<Blob> {

    return this.http
      .get(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}/download`,
        {
          responseType: 'blob'
        }
      );
  }


  delete(
    workspaceId: number,
    projectId: number,
    taskId: number,
    attachmentId: number
  ): Observable<unknown> {

    return this.http
      .delete(
        `${this.baseUrl}/workspaces/${workspaceId}/projects/${projectId}/tasks/${taskId}/attachments/${attachmentId}`
      );
  }

}