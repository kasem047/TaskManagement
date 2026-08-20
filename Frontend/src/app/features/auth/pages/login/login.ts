import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  ReactiveFormsModule,
  FormBuilder,
  Validators
} from '@angular/forms';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  Auth,
  PasswordRecoveryStatusResponse
} from '../../../../core/services/auth';

import {
  Theme
} from '../../../../core/services/theme';


type RecoveryMode =
  | 'login'
  | 'request'
  | 'status'
  | 'code'
  | 'reset'
  | 'completed';


@Component({
  selector: 'app-login',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login
  implements OnInit {

  private readonly fb =
    inject(FormBuilder);

  private readonly auth =
    inject(Auth);

  private readonly router =
    inject(Router);

  private readonly route =
    inject(ActivatedRoute);

  readonly theme =
    inject(Theme);


  private readonly recoveryTokenKey =
    'taskmanagement_password_recovery_public_token';

  private readonly resetTokenKey =
    'taskmanagement_password_recovery_reset_token';

  private readonly deviceIdKey =
    'taskmanagement_device_id';


  loading = false;

  recoveryLoading = false;

  errorMessage = '';

  recoveryError = '';

  recoveryMessage = '';

  showPassword = false;

  showNewPassword = false;

  showConfirmPassword = false;

  recoveryMode: RecoveryMode =
    'login';

  recoveryStatus:
    PasswordRecoveryStatusResponse | null =
      null;


  /* =========================
     LOGIN FORM
     ========================= */

  readonly form =
    this.fb.nonNullable.group({
      email: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      password: [
        '',
        [
          Validators.required
        ]
      ]
    });


  /* =========================
     PASSWORD RECOVERY REQUEST
     ========================= */

  readonly recoveryRequestForm =
    this.fb.nonNullable.group({
      accountEmail: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      recoveryEmail: [
        '',
        [
          Validators.required,
          Validators.email
        ]
      ],

      reason: [
        '',
        [
          Validators.required,
          Validators.minLength(5),
          Validators.maxLength(1000)
        ]
      ]
    });


  /* =========================
     SIX DIGIT CODE
     ========================= */

  readonly recoveryCodeForm =
    this.fb.nonNullable.group({
      code: [
        '',
        [
          Validators.required,
          Validators.pattern(/^\d{6}$/)
        ]
      ]
    });


  /* =========================
     RESET PASSWORD
     ========================= */

  readonly resetPasswordForm =
    this.fb.nonNullable.group({
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(8),
          Validators.maxLength(100),
          Validators.pattern(
            /^(?=.*[a-z])(?=.*\d).+$/
          )
        ]
      ],

      confirmNewPassword: [
        '',
        [
          Validators.required
        ]
      ]
    });


  /* =========================
     INIT
     ========================= */

  ngOnInit(): void {

    const recovery =
      this.route.snapshot
        .queryParamMap
        .get('recovery');


    if (
      recovery === '1' ||
      recovery === 'true'
    ) {

      this.startPasswordRecovery();
    }
  }


  /* =========================
     LOGIN GETTERS
     ========================= */

  get email() {
    return this.form.controls.email;
  }


  get password() {
    return this.form.controls.password;
  }


  /* =========================
     RECOVERY GETTERS
     ========================= */

  get accountEmail() {
    return this.recoveryRequestForm
      .controls
      .accountEmail;
  }


  get recoveryEmail() {
    return this.recoveryRequestForm
      .controls
      .recoveryEmail;
  }


  get recoveryReason() {
    return this.recoveryRequestForm
      .controls
      .reason;
  }


  get recoveryCode() {
    return this.recoveryCodeForm
      .controls
      .code;
  }


  get newPassword() {
    return this.resetPasswordForm
      .controls
      .newPassword;
  }


  get confirmNewPassword() {
    return this.resetPasswordForm
      .controls
      .confirmNewPassword;
  }


  /* =========================
     PASSWORD VISIBILITY
     ========================= */

  togglePassword(): void {

    this.showPassword =
      !this.showPassword;
  }


  toggleNewPassword(): void {

    this.showNewPassword =
      !this.showNewPassword;
  }


  toggleConfirmPassword(): void {

    this.showConfirmPassword =
      !this.showConfirmPassword;
  }


  /* =========================
     LOGIN
     ========================= */

  submit(): void {

    if (
      this.form.invalid ||
      this.loading
    ) {

      this.form.markAllAsTouched();

      return;
    }


    this.loading =
      true;

    this.errorMessage =
      '';


    const value =
      this.form.getRawValue();


    const deviceId =
      this.getOrCreateDeviceId();


    const deviceName =
      this.getDeviceName();


    this.auth
      .login({
        email:
          value.email.trim(),

        password:
          value.password,

        deviceId,

        deviceName
      })
      .subscribe({

        next: () => {

          this.loading =
            false;


          void this.router.navigateByUrl(
            '/dashboard'
          );
        },


        error: error => {

          this.loading =
            false;


          this.errorMessage =
            this.readError(
              error,
              'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.'
            );
        }

      });
  }


  /* =========================
     DEVICE IDENTITY
     ========================= */

  private getOrCreateDeviceId():
    string {

    const existingDeviceId =
      localStorage.getItem(
        this.deviceIdKey
      );


    if (
      existingDeviceId &&
      existingDeviceId.trim()
    ) {

      return existingDeviceId;
    }


    const generatedDeviceId =
      this.generateDeviceId();


    localStorage.setItem(
      this.deviceIdKey,
      generatedDeviceId
    );


    return generatedDeviceId;
  }


  private generateDeviceId():
    string {

    if (
      typeof crypto !==
        'undefined'
      &&
      typeof crypto.randomUUID ===
        'function'
    ) {

      return crypto.randomUUID();
    }


    return [
      Date.now()
        .toString(36),

      Math.random()
        .toString(36)
        .slice(2),

      Math.random()
        .toString(36)
        .slice(2)
    ]
      .join('-');
  }


  private getDeviceName():
    string {

    if (
      typeof navigator ===
        'undefined'
    ) {

      return 'TaskManagement Web';
    }


    const userAgent =
      navigator.userAgent
        .toLowerCase();


    const deviceType =
      /android|iphone|ipad|ipod|mobile/
        .test(userAgent)
        ? 'Mobile'
        : 'Desktop';


    let browserName =
      'Browser';


    if (
      userAgent.includes(
        'edg/'
      )
    ) {

      browserName =
        'Edge';

    } else if (
      userAgent.includes(
        'firefox/'
      )
    ) {

      browserName =
        'Firefox';

    } else if (
      userAgent.includes(
        'chrome/'
      )
    ) {

      browserName =
        'Chrome';

    } else if (
      userAgent.includes(
        'safari/'
      )
    ) {

      browserName =
        'Safari';
    }


    return `${deviceType} - ${browserName}`;
  }


  /* =========================
     OPEN PASSWORD RECOVERY
     ========================= */

  startPasswordRecovery(): void {

    if (
      this.recoveryLoading
    ) {

      return;
    }


    this.clearRecoveryMessages();


    const publicToken =
      localStorage.getItem(
        this.recoveryTokenKey
      );


    if (!publicToken) {

      this.recoveryMode =
        'request';


      const currentEmail =
        this.email.value.trim();


      if (
        currentEmail &&
        !this.accountEmail.value
      ) {

        this.accountEmail.setValue(
          currentEmail
        );
      }


      return;
    }


    this.recoveryMode =
      'status';


    this.loadRecoveryStatus(
      publicToken
    );
  }


  /* =========================
     CREATE RECOVERY REQUEST
     ========================= */

  submitRecoveryRequest(): void {

    if (
      this.recoveryRequestForm.invalid ||
      this.recoveryLoading
    ) {

      this.recoveryRequestForm
        .markAllAsTouched();

      return;
    }


    this.recoveryLoading =
      true;

    this.clearRecoveryMessages();


    const value =
      this.recoveryRequestForm
        .getRawValue();


    this.auth
      .createPasswordRecoveryRequest({
        accountEmail:
          value.accountEmail.trim(),

        recoveryEmail:
          value.recoveryEmail.trim(),

        reason:
          value.reason.trim()
      })
      .subscribe({

        next: response => {

          this.recoveryLoading =
            false;


          localStorage.setItem(
            this.recoveryTokenKey,
            response.publicToken
          );


          this.applyRecoveryStatus(
            response
          );
        },


        error: error => {

          this.recoveryLoading =
            false;


          this.recoveryError =
            this.readError(
              error,
              'تعذر إرسال طلب إعادة تعيين كلمة المرور.'
            );
        }

      });
  }


  /* =========================
     REFRESH STATUS
     ========================= */

  refreshRecoveryStatus(): void {

    const publicToken =
      localStorage.getItem(
        this.recoveryTokenKey
      );


    if (!publicToken) {

      this.recoveryMode =
        'request';

      return;
    }


    this.loadRecoveryStatus(
      publicToken
    );
  }


  private loadRecoveryStatus(
    publicToken: string
  ): void {

    this.recoveryLoading =
      true;

    this.clearRecoveryMessages();


    this.auth
      .getPasswordRecoveryStatus(
        publicToken
      )
      .subscribe({

        next: response => {

          this.recoveryLoading =
            false;


          this.applyRecoveryStatus(
            response
          );
        },


        error: error => {

          this.recoveryLoading =
            false;


          if (
            error?.status === 404
          ) {

            this.clearStoredRecovery();


            this.recoveryMode =
              'request';


            this.recoveryError =
              'لم يعد طلب الاستعادة السابق متاحًا. يمكنك إنشاء طلب جديد.';


            return;
          }


          this.recoveryError =
            this.readError(
              error,
              'تعذر التحقق من حالة طلب الاستعادة.'
            );
        }

      });
  }


  /* =========================
     APPLY STATUS
     ========================= */

  private applyRecoveryStatus(
    response:
      PasswordRecoveryStatusResponse
  ): void {

    this.recoveryStatus =
      response;


    if (
      response.isResetCompleted
    ) {

      this.recoveryMode =
        'completed';

      return;
    }


    if (
      response.status ===
        'Pending'
    ) {

      this.recoveryMode =
        'status';

      return;
    }


    if (
      response.status ===
        'Rejected'
      ||
      response.status ===
        'Expired'
    ) {

      this.recoveryMode =
        'status';

      return;
    }


    const resetToken =
      sessionStorage.getItem(
        this.resetTokenKey
      );


    if (
      response.status ===
        'Approved'
      &&
      response.codeVerified
      &&
      resetToken
    ) {

      this.recoveryMode =
        'reset';

      return;
    }


    if (
      response.status ===
        'Approved'
      &&
      response.codeSent
    ) {

      this.recoveryMode =
        'code';

      return;
    }


    this.recoveryMode =
      'status';
  }


  /* =========================
     VERIFY CODE
     ========================= */

  submitRecoveryCode(): void {

    if (
      this.recoveryCodeForm.invalid ||
      this.recoveryLoading
    ) {

      this.recoveryCodeForm
        .markAllAsTouched();

      return;
    }


    const publicToken =
      localStorage.getItem(
        this.recoveryTokenKey
      );


    if (!publicToken) {

      this.recoveryMode =
        'request';

      return;
    }


    this.recoveryLoading =
      true;

    this.clearRecoveryMessages();


    const code =
      this.recoveryCodeForm
        .controls
        .code
        .value
        .trim();


    this.auth
      .verifyPasswordRecoveryCode({
        publicToken,
        code
      })
      .subscribe({

        next: response => {

          this.recoveryLoading =
            false;


          sessionStorage.setItem(
            this.resetTokenKey,
            response.resetToken
          );


          if (
            this.recoveryStatus
          ) {

            this.recoveryStatus = {
              ...this.recoveryStatus,

              codeVerified:
                true
            };
          }


          this.recoveryMode =
            'reset';


          this.recoveryMessage =
            'تم التحقق من الرمز بنجاح. يمكنك الآن تعيين كلمة مرور جديدة.';
        },


        error: error => {

          this.recoveryLoading =
            false;


          this.recoveryError =
            this.readError(
              error,
              'تعذر التحقق من رمز الاستعادة.'
            );


          if (
            error?.status === 409
          ) {

            this.refreshRecoveryStatus();
          }
        }

      });
  }


  /* =========================
     RESET PASSWORD
     ========================= */

  submitNewPassword(): void {

    if (
      this.resetPasswordForm.invalid ||
      this.recoveryLoading
    ) {

      this.resetPasswordForm
        .markAllAsTouched();

      return;
    }


    const value =
      this.resetPasswordForm
        .getRawValue();


    if (
      value.newPassword !==
      value.confirmNewPassword
    ) {

      this.confirmNewPassword
        .setErrors({
          passwordMismatch:
            true
        });


      this.confirmNewPassword
        .markAsTouched();


      return;
    }


    const publicToken =
      localStorage.getItem(
        this.recoveryTokenKey
      );


    const resetToken =
      sessionStorage.getItem(
        this.resetTokenKey
      );


    if (
      !publicToken ||
      !resetToken
    ) {

      this.recoveryError =
        'انتهت جلسة إعادة التعيين. تحقق من رمز الاستعادة مرة أخرى.';


      this.recoveryMode =
        'code';


      return;
    }


    this.recoveryLoading =
      true;

    this.clearRecoveryMessages();


    this.auth
      .resetForgottenPassword({
        publicToken,

        resetToken,

        newPassword:
          value.newPassword,

        confirmNewPassword:
          value.confirmNewPassword
      })
      .subscribe({

        next: () => {

          this.recoveryLoading =
            false;


          this.clearStoredRecovery();


          this.recoveryCodeForm
            .reset();


          this.resetPasswordForm
            .reset();


          this.recoveryStatus =
            null;


          this.recoveryMode =
            'completed';
        },


        error: error => {

          this.recoveryLoading =
            false;


          this.recoveryError =
            this.readError(
              error,
              'تعذر إعادة تعيين كلمة المرور.'
            );
        }

      });
  }


  /* =========================
     NEW REQUEST
     ========================= */

  startNewRecoveryRequest(): void {

    this.clearStoredRecovery();


    this.recoveryStatus =
      null;

    this.recoveryError =
      '';

    this.recoveryMessage =
      '';


    this.recoveryCodeForm
      .reset();


    this.resetPasswordForm
      .reset();


    this.recoveryRequestForm
      .reset({
        accountEmail:
          this.email.value.trim(),

        recoveryEmail:
          '',

        reason:
          ''
      });


    this.recoveryMode =
      'request';
  }


  /* =========================
     BACK TO LOGIN
     ========================= */

  backToLogin(): void {

    this.clearRecoveryMessages();


    this.recoveryMode =
      'login';


    void this.router.navigate(
      ['/login'],
      {
        replaceUrl:
          true
      }
    );
  }


  completedBackToLogin(): void {

    this.clearStoredRecovery();


    this.recoveryStatus =
      null;

    this.recoveryError =
      '';

    this.recoveryMessage =
      '';


    this.form.controls
      .password
      .setValue(
        ''
      );


    this.recoveryMode =
      'login';


    void this.router.navigate(
      ['/login'],
      {
        replaceUrl:
          true
      }
    );
  }


  /* =========================
     HELPERS
     ========================= */

  statusLabel(): string {

    switch (
      this.recoveryStatus?.status
    ) {

      case 'Pending':
        return 'قيد المراجعة';


      case 'Approved':
        return 'تمت الموافقة وإرسال رمز الاستعادة';


      case 'Rejected':
        return 'تم رفض الطلب';


      case 'Expired':
        return 'انتهت صلاحية الطلب';


      default:
        return 'حالة الطلب';
    }
  }


  formatDate(
    value:
      string | null
  ): string {

    if (!value) {

      return '';
    }


    try {

      return new Intl
        .DateTimeFormat(
          'ar-SY',
          {
            dateStyle:
              'medium',

            timeStyle:
              'short'
          }
        )
        .format(
          new Date(
            value
          )
        );

    } catch {

      return value;
    }
  }


  private clearStoredRecovery():
    void {

    localStorage.removeItem(
      this.recoveryTokenKey
    );


    sessionStorage.removeItem(
      this.resetTokenKey
    );
  }


  private clearRecoveryMessages():
    void {

    this.recoveryError =
      '';

    this.recoveryMessage =
      '';
  }


  private readError(
    error: any,
    fallback: string
  ): string {

    const validationErrors =
      error?.error?.errors as
        Record<string, string[]> |
        undefined;


    if (
      validationErrors
    ) {

      for (
        const messages
        of Object.values(
          validationErrors
        )
      ) {

        if (
          messages &&
          messages.length >
            0
        ) {

          return messages[0];
        }
      }
    }


    return (
      error?.error?.detail
      ??
      error?.error?.message
      ??
      fallback
    );
  }
}