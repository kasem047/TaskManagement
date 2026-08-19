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


export type PasswordRecoveryAdminStatus =
  | 'Pending'
  | 'Approved'
  | 'Rejected'
  | 'Expired';


export interface PasswordRecoveryAdminRequest {
  id: number;

  userId: number;

  userFullName: string;

  accountEmail: string;

  recoveryEmail: string;

  reason: string;

  status:
    PasswordRecoveryAdminStatus;

  reviewedByAdminUserId:
    number | null;

  reviewedByAdminFullName:
    string | null;

  reviewedAt:
    string | null;

  adminDecisionReason:
    string | null;

  codeSent:
    boolean;

  codeSentByAdminUserId:
    number | null;

  codeSentAt:
    string | null;

  codeExpiresAt:
    string | null;

  codeVerified:
    boolean;

  passwordResetAt:
    string | null;

  createdAt:
    string;

  requestExpiresAt:
    string;
}


@Injectable({
  providedIn: 'root'
})
export class PasswordRecoveryAdminService {

  private readonly http =
    inject(HttpClient);


  private readonly apiUrl =
    `${environment.apiBaseUrl}/api/admin/password-recovery-requests`;


  getRequests(
    status?:
      PasswordRecoveryAdminStatus
  ): Observable<
    PasswordRecoveryAdminRequest[]
  > {

    const url =
      status
        ? `${this.apiUrl}?status=${encodeURIComponent(status)}`
        : this.apiUrl;


    return this.http.get<
      PasswordRecoveryAdminRequest[]
    >(
      url
    );
  }


  getRequest(
    requestId: number
  ): Observable<
    PasswordRecoveryAdminRequest
  > {

    return this.http.get<
      PasswordRecoveryAdminRequest
    >(
      `${this.apiUrl}/${requestId}`
    );
  }


  approve(
    requestId: number
  ): Observable<
    PasswordRecoveryAdminRequest
  > {

    return this.http.post<
      PasswordRecoveryAdminRequest
    >(
      `${this.apiUrl}/${requestId}/approve`,
      null
    );
  }


  reject(
    requestId: number,
    reason: string
  ): Observable<
    PasswordRecoveryAdminRequest
  > {

    return this.http.post<
      PasswordRecoveryAdminRequest
    >(
      `${this.apiUrl}/${requestId}/reject`,
      {
        reason
      }
    );
  }


  sendCode(
    requestId: number
  ): Observable<
    PasswordRecoveryAdminRequest
  > {

    return this.http.post<
      PasswordRecoveryAdminRequest
    >(
      `${this.apiUrl}/${requestId}/send-code`,
      null
    );
  }
}