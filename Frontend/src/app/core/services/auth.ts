import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { TokenStorage } from './token-storage';

export interface LoginRequest {
  email: string;
  password: string;
  deviceId: string;
  deviceName: string;
}

export interface LoginResponse {
  userId: number;
  fullName: string;
  email: string;
  token: string;
  expiresAt: string;
  sessionId: number;
}

@Injectable({
  providedIn: 'root'
})
export class Auth {
  private readonly http = inject(HttpClient);
  private readonly tokenStorage = inject(TokenStorage);

  private readonly apiUrl =
    `${environment.apiBaseUrl}/api/Auth`;

  login(request: LoginRequest): Observable<LoginResponse> {
    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/login`,
        request
      )
      .pipe(
        tap(response => {
          this.tokenStorage.setToken(response.token);

          this.tokenStorage.setUser({
            userId: response.userId,
            fullName: response.fullName,
            email: response.email,
            expiresAt: response.expiresAt,
            sessionId: response.sessionId
          });
        })
      );
  }

  logoutLocal(): void {
    this.tokenStorage.clear();
  }
}