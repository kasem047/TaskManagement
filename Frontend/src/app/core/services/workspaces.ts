import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface Workspace {
  id: number;
  name: string;
  description: string | null;
  createdByUserId: number;
  createdByUserName: string;
  currentUserRole: string;
  createdAt: string;
}

@Injectable({
  providedIn: 'root'
})
export class Workspaces {
  private readonly http = inject(HttpClient);

  private readonly apiUrl =
    `${environment.apiBaseUrl}/api/Workspaces`;

  getAll(): Observable<Workspace[]> {
    return this.http.get<Workspace[]>(
      this.apiUrl
    );
  }
}