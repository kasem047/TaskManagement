import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators
} from '@angular/forms';

import {
  Router
} from '@angular/router';

import {
  Auth,
  AccountProfileResponse,
  UserSessionResponse
} from '../../../../core/services/auth';

import {
  TokenStorage
} from '../../../../core/services/token-storage';

import {
  NotificationRealtime
} from '../../../../core/services/notification-realtime';


type AccountTab =
  | 'profile'
  | 'security'
  | 'sessions';


@Component({
  selector: 'app-account',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './account.html',

  styleUrl:
    './account.scss'
})
export class AccountPage
  implements OnInit {

  private readonly fb =
    inject(FormBuilder);

  private readonly auth =
    inject(Auth);

  private readonly tokenStorage =
    inject(TokenStorage);

  private readonly realtime =
    inject(NotificationRealtime);

  private readonly router =
    inject(Router);


  activeTab:
    AccountTab =
      'profile';


  profile:
    AccountProfileResponse | null =
      null;


  sessions:
    UserSessionResponse[] =
      [];


  profileLoading =
    true;

  sessionsLoading =
    true;

  profileError =
    '';

  sessionsError =
    '';

  profileSuccess =
    '';

  emailSuccess =
    '';

  passwordSuccess =
    '';

  profileSaving =
    false;

  emailSaving =
    false;

  passwordSaving =
    false;

  revokingSessionId:
    number | null =
      null;

  loggingOut =
    false;

  loggingOutAll =
    false;

  showCurrentPasswordForEmail =
    false;

  showCurrentPassword =
    false;

  showNewPassword =
    false;

  showConfirmPassword =
    false;


  readonly profileForm =
    this.fb.nonNullable.group({

      fullName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(150)
        ]
      ]

    });


  readonly emailForm =
    this.fb.nonNullable.group({

      currentPassword: [
        '',
        [
          Validators.required
        ]
      ],

      newEmail: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(256)
        ]
      ]

    });


  readonly passwordForm =
    this.fb.nonNullable.group({

      currentPassword: [
        '',
        [
          Validators.required
        ]
      ],

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


  ngOnInit(): void {

    this.loadProfile();

    this.loadSessions();
  }


  setTab(
    tab:
      AccountTab
  ): void {

    this.activeTab =
      tab;

    this.clearMessages();


    if (
      tab === 'sessions'
    ) {

      this.loadSessions();
    }
  }


  /* =========================
     FORGOT PASSWORD
     ========================= */

  openForgotPassword():
    void {

    this.router.navigate(
      ['/login'],
      {
        queryParams: {
          recovery: 1
        }
      }
    );
  }


  loadProfile(): void {

    this.profileLoading =
      true;

    this.profileError =
      '';


    this.auth
      .getProfile()
      .subscribe({

        next: profile => {

          this.profile =
            profile;


          this.profileForm
            .patchValue({
              fullName:
                profile.fullName
            });


          this.emailForm
            .patchValue({
              newEmail:
                profile.email
            });


          this.profileLoading =
            false;
        },


        error: error => {

          this.profileError =
            this.extractError(
              error
            );

          this.profileLoading =
            false;
        }

      });
  }


  saveProfile(): void {

    if (
      this.profileSaving
    ) {
      return;
    }


    this.profileError =
      '';

    this.profileSuccess =
      '';


    if (
      this.profileForm.invalid
    ) {

      this.profileForm
        .markAllAsTouched();

      this.profileError =
        'راجع الاسم المدخل وصحح الخطأ قبل الحفظ.';

      return;
    }


    this.profileSaving =
      true;


    const value =
      this.profileForm
        .getRawValue();


    this.auth
      .updateProfile({
        fullName:
          value.fullName.trim()
      })
      .subscribe({

        next: profile => {

          this.profile =
            profile;

          this.profileForm
            .patchValue({
              fullName:
                profile.fullName
            });

          this.profileSuccess =
            'تم تحديث الاسم بنجاح.';

          this.profileSaving =
            false;
        },


        error: error => {

          this.profileError =
            this.extractError(
              error
            );

          this.profileSaving =
            false;
        }

      });
  }


  changeEmail(): void {

    if (
      this.emailSaving
    ) {
      return;
    }


    this.profileError =
      '';

    this.emailSuccess =
      '';


    if (
      this.emailForm.invalid
    ) {

      this.emailForm
        .markAllAsTouched();

      this.profileError =
        'راجع بيانات البريد الإلكتروني وكلمة المرور الحالية.';

      return;
    }


    const value =
      this.emailForm
        .getRawValue();


    if (
      value.newEmail
        .trim()
        .toLowerCase() ===
      this.profile
        ?.email
        ?.trim()
        .toLowerCase()
    ) {

      this.profileError =
        'البريد الجديد مطابق للبريد الحالي.';

      return;
    }


    this.emailSaving =
      true;


    this.auth
      .changeEmail({

        currentPassword:
          value.currentPassword,

        newEmail:
          value.newEmail.trim()

      })
      .subscribe({

        next: profile => {

          this.profile =
            profile;


          this.emailForm
            .reset({

              currentPassword:
                '',

              newEmail:
                profile.email

            });


          this.emailSuccess =
            'تم تغيير البريد الإلكتروني بنجاح.';

          this.emailSaving =
            false;
        },


        error: error => {

          this.profileError =
            this.extractError(
              error
            );

          this.emailSaving =
            false;
        }

      });
  }


  changePassword(): void {

    if (
      this.passwordSaving
    ) {
      return;
    }


    this.profileError =
      '';

    this.passwordSuccess =
      '';


    if (
      this.passwordForm.invalid
    ) {

      this.passwordForm
        .markAllAsTouched();

      this.profileError =
        'راجع حقول كلمة المرور وصحح الأخطاء المشار إليها.';

      return;
    }


    const value =
      this.passwordForm
        .getRawValue();


    if (
      value.newPassword !==
      value.confirmNewPassword
    ) {

      const confirmControl =
        this.passwordForm.controls
          .confirmNewPassword;


      confirmControl.setErrors({
        ...(confirmControl.errors ?? {}),
        passwordMismatch:
          true
      });


      confirmControl.markAsTouched();


      this.profileError =
        'كلمة المرور الجديدة وتأكيدها غير متطابقين.';

      return;
    }


    if (
      value.currentPassword ===
      value.newPassword
    ) {

      const newPasswordControl =
        this.passwordForm.controls
          .newPassword;


      newPasswordControl.setErrors({
        ...(newPasswordControl.errors ?? {}),
        sameAsCurrent:
          true
      });


      newPasswordControl.markAsTouched();


      this.profileError =
        'كلمة المرور الجديدة يجب أن تختلف عن كلمة المرور الحالية.';

      return;
    }


    this.passwordSaving =
      true;


    this.auth
      .changePassword({

        currentPassword:
          value.currentPassword,

        newPassword:
          value.newPassword,

        confirmNewPassword:
          value.confirmNewPassword

      })
      .subscribe({

        next: () => {

          this.passwordForm
            .reset({

              currentPassword:
                '',

              newPassword:
                '',

              confirmNewPassword:
                ''

            });


          this.passwordSuccess =
            'تم تغيير كلمة المرور بنجاح وإنهاء الجلسات الأخرى.';

          this.passwordSaving =
            false;

          this.loadSessions();
        },


        error: error => {

          this.profileError =
            this.extractError(
              error
            );

          this.passwordSaving =
            false;
        }

      });
  }


  loadSessions(): void {

    this.sessionsLoading =
      true;

    this.sessionsError =
      '';


    this.auth
      .getSessions()
      .subscribe({

        next: sessions => {

          this.sessions =
            [...sessions]
              .sort(
                (a, b) => {

                  if (
                    a.isCurrentSession
                  ) {
                    return -1;
                  }


                  if (
                    b.isCurrentSession
                  ) {
                    return 1;
                  }


                  return (
                    new Date(
                      b.lastUsedAt
                      ?? b.createdAt
                    ).getTime()
                    -
                    new Date(
                      a.lastUsedAt
                      ?? a.createdAt
                    ).getTime()
                  );
                }
              );


          this.sessionsLoading =
            false;
        },


        error: error => {

          this.sessionsError =
            this.extractError(
              error
            );

          this.sessionsLoading =
            false;
        }

      });
  }


  revokeSession(
    session:
      UserSessionResponse
  ): void {

    if (
      session.isCurrentSession ||
      this.revokingSessionId !==
        null
    ) {
      return;
    }


    this.revokingSessionId =
      session.id;

    this.sessionsError =
      '';


    this.auth
      .revokeSession(
        session.id
      )
      .subscribe({

        next: () => {

          this.sessions =
            this.sessions
              .filter(
                item =>
                  item.id !==
                  session.id
              );

          this.revokingSessionId =
            null;
        },


        error: error => {

          this.sessionsError =
            this.extractError(
              error
            );

          this.revokingSessionId =
            null;
        }

      });
  }


  logoutCurrent(): void {

    if (
      this.loggingOut
    ) {
      return;
    }


    this.loggingOut =
      true;

    this.sessionsError =
      '';


    this.auth
      .logout()
      .subscribe({

        next: async () => {

          await this.realtime.stop();

          this.auth.logoutLocal();

          await this.router
            .navigateByUrl(
              '/login'
            );
        },


        error: error => {

          this.sessionsError =
            this.extractError(
              error
            );

          this.loggingOut =
            false;
        }

      });
  }


  logoutAll(): void {

    if (
      this.loggingOutAll
    ) {
      return;
    }


    this.loggingOutAll =
      true;

    this.sessionsError =
      '';


    this.auth
      .logoutAll()
      .subscribe({

        next: async () => {

          await this.realtime.stop();

          this.auth.logoutLocal();

          await this.router
            .navigateByUrl(
              '/login'
            );
        },


        error: error => {

          this.sessionsError =
            this.extractError(
              error
            );

          this.loggingOutAll =
            false;
        }

      });
  }


  accountInitial():
    string {

    return (
      this.profile
        ?.fullName
        ?.trim()
        .charAt(0)
        .toUpperCase()
      ||
      'U'
    );
  }


  formatDate(
    value:
      string | null | undefined
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


  sessionDeviceName(
    session:
      UserSessionResponse
  ): string {

    return (
      session.deviceName
        ?.trim()
      ||
      'جهاز غير معروف'
    );
  }


  sessionActivity(
    session:
      UserSessionResponse
  ): string {

    return this.formatDate(
      session.lastUsedAt
      ?? session.createdAt
    );
  }


  toggleEmailPassword():
    void {

    this.showCurrentPasswordForEmail =
      !this.showCurrentPasswordForEmail;
  }


  toggleCurrentPassword():
    void {

    this.showCurrentPassword =
      !this.showCurrentPassword;
  }


  toggleNewPassword():
    void {

    this.showNewPassword =
      !this.showNewPassword;
  }


  toggleConfirmPassword():
    void {

    this.showConfirmPassword =
      !this.showConfirmPassword;
  }


  private clearMessages():
    void {

    this.profileError =
      '';

    this.sessionsError =
      '';

    this.profileSuccess =
      '';

    this.emailSuccess =
      '';

    this.passwordSuccess =
      '';
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


    switch (
      error?.status
    ) {

      case 401:
        return 'انتهت الجلسة أو كلمة المرور الحالية غير صحيحة.';

      case 403:
        return 'لا تملك صلاحية تنفيذ هذه العملية.';

      case 409:
        return error?.error?.detail
          ?? 'البيانات الجديدة مستخدمة مسبقًا.';

      default:
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
}