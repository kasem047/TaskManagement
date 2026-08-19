import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  RouterLink
} from '@angular/router';

import {
  of,
  switchMap
} from 'rxjs';

import {
  PasswordRecoveryAdminRequest,
  PasswordRecoveryAdminService,
  PasswordRecoveryAdminStatus
} from '../../../../core/services/password-recovery-admin';


type RecoveryFilter =
  | 'All'
  | 'Pending'
  | 'Approved'
  | 'Rejected';


@Component({
  selector:
    'app-password-recovery-admin',

  imports: [
    RouterLink
  ],

  templateUrl:
    './password-recovery-admin.html',

  styleUrl:
    './password-recovery-admin.scss'
})
export class PasswordRecoveryAdminPage
  implements OnInit {

  private readonly service =
    inject(
      PasswordRecoveryAdminService
    );


  requests:
    PasswordRecoveryAdminRequest[] =
      [];


  loading =
    true;


  errorMessage =
    '';


  actionRequestId:
    number | null =
      null;


  filter:
    RecoveryFilter =
      'All';


  rejectingRequest:
    PasswordRecoveryAdminRequest | null =
      null;


  rejectReason =
    '';


  rejectError =
    '';


  ngOnInit(): void {

    this.loadRequests();
  }


  loadRequests(): void {

    this.loading =
      true;

    this.errorMessage =
      '';


    this.service
      .getRequests()
      .subscribe({

        next: requests => {

          this.requests =
            [...requests]
              .sort(
                (a, b) =>
                  new Date(
                    b.createdAt
                  ).getTime()
                  -
                  new Date(
                    a.createdAt
                  ).getTime()
              );


          this.loading =
            false;
        },


        error: error => {

          this.loading =
            false;

          this.errorMessage =
            this.extractError(
              error
            );
        }

      });
  }


  setFilter(
    filter:
      RecoveryFilter
  ): void {

    this.filter =
      filter;
  }


  get filteredRequests():
    PasswordRecoveryAdminRequest[] {

    if (
      this.filter === 'All'
    ) {

      return this.requests;
    }


    if (
      this.filter === 'Rejected'
    ) {

      return this.requests
        .filter(
          request =>
            request.status === 'Rejected' ||
            request.status === 'Expired'
        );
    }


    return this.requests
      .filter(
        request =>
          request.status ===
            this.filter
      );
  }


  countPending():
    number {

    return this.requests
      .filter(
        request =>
          request.status ===
            'Pending'
      )
      .length;
  }


  countApproved():
    number {

    return this.requests
      .filter(
        request =>
          request.status ===
            'Approved'
      )
      .length;
  }


  countRejected():
    number {

    return this.requests
      .filter(
        request =>
          request.status ===
            'Rejected' ||
          request.status ===
            'Expired'
      )
      .length;
  }


  /* =========================
     APPROVE + SEND CODE
     ========================= */

  approveAndSendCode(
    request:
      PasswordRecoveryAdminRequest
  ): void {

    if (
      this.actionRequestId !==
        null
    ) {

      return;
    }


    this.actionRequestId =
      request.id;

    this.errorMessage =
      '';


    this.service
      .approve(
        request.id
      )
      .pipe(

        switchMap(
          approved => {

            if (
              approved.codeSent
            ) {

              return of(
                approved
              );
            }


            return this.service
              .sendCode(
                request.id
              );
          }
        )

      )
      .subscribe({

        next: updated => {

          this.replaceRequest(
            updated
          );

          this.actionRequestId =
            null;
        },


        error: error => {

          this.errorMessage =
            this.extractError(
              error
            );

          this.actionRequestId =
            null;

          /*
           * إذا نجحت الموافقة لكن تعذر إرسال البريد،
           * إعادة التحميل تحفظ الواجهة متزامنة مع حالة السيرفر.
           */
          this.loadRequests();
        }

      });
  }


  /* =========================
     REJECT
     ========================= */

  openReject(
    request:
      PasswordRecoveryAdminRequest
  ): void {

    this.rejectingRequest =
      request;

    this.rejectReason =
      '';

    this.rejectError =
      '';
  }


  closeReject(): void {

    if (
      this.actionRequestId !==
        null
    ) {

      return;
    }


    this.rejectingRequest =
      null;

    this.rejectReason =
      '';

    this.rejectError =
      '';
  }


  setRejectReason(
    value: string
  ): void {

    this.rejectReason =
      value;

    this.rejectError =
      '';
  }


  confirmReject(): void {

    const request =
      this.rejectingRequest;


    if (
      !request ||
      this.actionRequestId !==
        null
    ) {

      return;
    }


    const reason =
      this.rejectReason
        .trim();


    if (
      reason.length < 3
    ) {

      this.rejectError =
        'اكتب سببًا واضحًا لرفض الطلب.';

      return;
    }


    this.actionRequestId =
      request.id;


    this.service
      .reject(
        request.id,
        reason
      )
      .subscribe({

        next: updated => {

          this.replaceRequest(
            updated
          );


          this.actionRequestId =
            null;

          this.rejectingRequest =
            null;

          this.rejectReason =
            '';

          this.rejectError =
            '';
        },


        error: error => {

          this.rejectError =
            this.extractError(
              error
            );

          this.actionRequestId =
            null;
        }

      });
  }


  /* =========================
     DISPLAY
     ========================= */

  statusLabel(
    status:
      PasswordRecoveryAdminStatus
  ): string {

    switch (
      status
    ) {

      case 'Pending':
        return 'قيد المراجعة';

      case 'Approved':
        return 'تمت الموافقة وإرسال الرمز';

      case 'Rejected':
        return 'مرفوض';

      case 'Expired':
        return 'مرفوض / منتهي الصلاحية';
    }
  }


  isRejectedState(
    request:
      PasswordRecoveryAdminRequest
  ): boolean {

    return (
      request.status ===
        'Rejected'
      ||
      request.status ===
        'Expired'
    );
  }


  formatDate(
    value:
      string | null
  ): string {

    if (!value) {

      return '—';
    }


    return new Date(
      value
    )
      .toLocaleString(
        'ar-SY',
        {
          year:
            'numeric',

          month:
            'short',

          day:
            'numeric',

          hour:
            '2-digit',

          minute:
            '2-digit'
        }
      );
  }


  private replaceRequest(
    updated:
      PasswordRecoveryAdminRequest
  ): void {

    this.requests =
      this.requests
        .map(
          request =>
            request.id ===
              updated.id
              ? updated
              : request
        );
  }


  private extractError(
    error: any
  ): string {

    const errors =
      error?.error?.errors;


    if (
      errors &&
      typeof errors ===
        'object'
    ) {

      const messages =
        Object.values(
          errors
        )
          .flatMap(
            value =>
              Array.isArray(
                value
              )
                ? value
                : [value]
          )
          .filter(Boolean)
          .map(String);


      if (
        messages.length >
        0
      ) {

        return messages.join(
          '\n'
        );
      }
    }


    if (
      error?.status === 403
    ) {

      return 'هذه الصفحة متاحة لمسؤول النظام فقط.';
    }


    return (
      error?.error?.detail
      ??
      error?.error?.message
      ??
      error?.error?.title
      ??
      'تعذر تنفيذ العملية.'
    );
  }
}