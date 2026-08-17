import {
  Component,
  inject
} from '@angular/core';

import {
  ReactiveFormsModule,
  FormBuilder,
  Validators
} from '@angular/forms';

import {
  Router
} from '@angular/router';

import {
  Auth
} from '../../../../core/services/auth';

import {
  Theme
} from '../../../../core/services/theme';

@Component({
  selector: 'app-login',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  private readonly fb =
    inject(FormBuilder);

  private readonly auth =
    inject(Auth);

  private readonly router =
    inject(Router);

  readonly theme =
    inject(Theme);

  loading = false;

  errorMessage = '';

  showPassword = false;

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

  get email() {
    return this.form.controls.email;
  }

  get password() {
    return this.form.controls.password;
  }

  togglePassword(): void {
    this.showPassword =
      !this.showPassword;
  }

  submit(): void {
    if (
      this.form.invalid ||
      this.loading
    ) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.errorMessage = '';

    const value =
      this.form.getRawValue();

    this.auth.login({
      email: value.email,
      password: value.password,
      deviceId: 'web-browser',
      deviceName: 'TaskManagement Web'
    })
    .subscribe({
      next: () => {
        this.loading = false;

        this.router.navigateByUrl(
          '/dashboard'
        );
      },

      error: error => {
        this.loading = false;

        this.errorMessage =
          error?.error?.detail ??
          error?.error?.message ??
          'تعذر تسجيل الدخول. تحقق من البريد الإلكتروني وكلمة المرور.';
      }
    });
  }
}