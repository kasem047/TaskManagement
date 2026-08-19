import {
  Injectable,
  inject
} from '@angular/core';

import {
  HttpClient
} from '@angular/common/http';

import {
  Observable,
  tap
} from 'rxjs';

import {
  environment
} from '../../../environments/environment';

import {
  TokenStorage
} from './token-storage';


/* =========================================================
   LOGIN
   ========================================================= */

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


/* =========================================================
   PASSWORD RECOVERY
   ========================================================= */

export interface CreatePasswordRecoveryRequest {
  accountEmail: string;
  recoveryEmail: string;
  reason: string;
}


export interface PasswordRecoveryStatusResponse {
  publicToken: string;

  status:
    | 'Pending'
    | 'Approved'
    | 'Rejected'
    | 'Expired'
    | string;

  message: string;

  recoveryEmailMasked: string;

  codeSent: boolean;

  codeVerified: boolean;

  canEnterCode: boolean;

  canCreateNewRequest: boolean;

  isResetCompleted: boolean;

  createdAt: string;

  reviewedAt:
    string | null;

  codeExpiresAt:
    string | null;

  passwordResetAt:
    string | null;

  rejectionReason:
    string | null;
}


export interface VerifyPasswordRecoveryCodeRequest {
  publicToken: string;
  code: string;
}


export interface VerifyPasswordRecoveryCodeResponse {
  resetToken: string;
  expiresAt: string;
}


export interface ResetForgottenPasswordRequest {
  publicToken: string;
  resetToken: string;
  newPassword: string;
  confirmNewPassword: string;
}


/* =========================================================
   PROFILE
   ========================================================= */

export interface AccountProfileResponse {
  userId?: number;

  id?: number;

  fullName: string;

  email: string;

  isSystemAdmin?: boolean;

  createdAt?: string;

  updatedAt?:
    string | null;

  lastLoginAt?:
    string | null;
}


export interface UpdateProfileRequest {
  fullName: string;
}


export interface ChangeEmailRequest {
  currentPassword: string;
  newEmail: string;
}


export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}


/* =========================================================
   SESSIONS
   ========================================================= */

export interface UserSessionResponse {
  id: number;

  deviceId: string;

  deviceName:
    string | null;

  ipAddress:
    string | null;

  userAgent:
    string | null;

  expiresAt: string;

  lastUsedAt:
    string | null;

  createdAt: string;

  isCurrentSession: boolean;
}


/* =========================================================
   COMMON RESPONSE
   ========================================================= */

export interface ApiMessageResponse {
  message: string;

  revokedSessionId?: number;
}


/* =========================================================
   SERVICE
   ========================================================= */

@Injectable({
  providedIn: 'root'
})
export class Auth {

  private readonly http =
    inject(HttpClient);


  private readonly tokenStorage =
    inject(TokenStorage);


  private readonly apiUrl =
    `${environment.apiBaseUrl}/api/Auth`;


  /* =========================================================
     LOGIN
     ========================================================= */

  login(
    request:
      LoginRequest
  ): Observable<LoginResponse> {

    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/login`,
        request
      )
      .pipe(
        tap(response => {

          this.tokenStorage
            .setToken(
              response.token
            );


          this.tokenStorage
            .setUser({
              userId:
                response.userId,

              fullName:
                response.fullName,

              email:
                response.email,

              expiresAt:
                response.expiresAt,

              sessionId:
                response.sessionId
            });

        })
      );
  }


  /* =========================================================
     PASSWORD RECOVERY
     ========================================================= */

  createPasswordRecoveryRequest(
    request:
      CreatePasswordRecoveryRequest
  ): Observable<
    PasswordRecoveryStatusResponse
  > {

    return this.http.post<
      PasswordRecoveryStatusResponse
    >(
      `${this.apiUrl}/password-recovery/request`,
      request
    );
  }


  getPasswordRecoveryStatus(
    publicToken: string
  ): Observable<
    PasswordRecoveryStatusResponse
  > {

    return this.http.get<
      PasswordRecoveryStatusResponse
    >(
      `${this.apiUrl}/password-recovery/${encodeURIComponent(publicToken)}/status`
    );
  }


  verifyPasswordRecoveryCode(
    request:
      VerifyPasswordRecoveryCodeRequest
  ): Observable<
    VerifyPasswordRecoveryCodeResponse
  > {

    return this.http.post<
      VerifyPasswordRecoveryCodeResponse
    >(
      `${this.apiUrl}/password-recovery/verify-code`,
      request
    );
  }


  resetForgottenPassword(
    request:
      ResetForgottenPasswordRequest
  ): Observable<
    ApiMessageResponse
  > {

    return this.http.post<
      ApiMessageResponse
    >(
      `${this.apiUrl}/password-recovery/reset`,
      request
    );
  }


  /* =========================================================
     PROFILE
     ========================================================= */

  getProfile():
    Observable<
      AccountProfileResponse
    > {

    return this.http.get<
      AccountProfileResponse
    >(
      `${this.apiUrl}/profile`
    );
  }


  updateProfile(
    request:
      UpdateProfileRequest
  ): Observable<
    AccountProfileResponse
  > {

    return this.http
      .put<
        AccountProfileResponse
      >(
        `${this.apiUrl}/profile`,
        request
      )
      .pipe(
        tap(response => {

          this.updateStoredUser(
            response
          );

        })
      );
  }


  changeEmail(
    request:
      ChangeEmailRequest
  ): Observable<
    AccountProfileResponse
  > {

    return this.http
      .put<
        AccountProfileResponse
      >(
        `${this.apiUrl}/email`,
        request
      )
      .pipe(
        tap(response => {

          this.updateStoredUser(
            response
          );

        })
      );
  }


  changePassword(
    request:
      ChangePasswordRequest
  ): Observable<
    ApiMessageResponse
  > {

    return this.http.post<
      ApiMessageResponse
    >(
      `${this.apiUrl}/change-password`,
      request
    );
  }


  /* =========================================================
     SESSIONS
     ========================================================= */

  getSessions():
    Observable<
      UserSessionResponse[]
    > {

    return this.http.get<
      UserSessionResponse[]
    >(
      `${this.apiUrl}/sessions`
    );
  }


  revokeSession(
    sessionId: number
  ): Observable<
    ApiMessageResponse
  > {

    return this.http.delete<
      ApiMessageResponse
    >(
      `${this.apiUrl}/sessions/${sessionId}`
    );
  }


  /* =========================================================
     LOGOUT
     ========================================================= */

  logout():
    Observable<
      ApiMessageResponse
    > {

    return this.http.post<
      ApiMessageResponse
    >(
      `${this.apiUrl}/logout`,
      null
    );
  }


  logoutAll():
    Observable<
      ApiMessageResponse
    > {

    return this.http.post<
      ApiMessageResponse
    >(
      `${this.apiUrl}/logout-all`,
      null
    );
  }


  logoutLocal(): void {

    this.tokenStorage
      .clear();
  }


  /* =========================================================
     LOCAL USER DATA
     ========================================================= */

  private updateStoredUser(
    profile:
      AccountProfileResponse
  ): void {

    const currentUser =
      this.tokenStorage
        .getUser();


    if (!currentUser) {

      return;
    }


    this.tokenStorage
      .setUser({
        ...currentUser,

        fullName:
          profile.fullName,

        email:
          profile.email
      });
  }
}