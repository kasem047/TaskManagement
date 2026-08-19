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
  AdminUser,
  AdminUsers
} from '../../../../core/services/admin-users';


@Component({
  selector:
    'app-admin-users',

  imports: [
    ReactiveFormsModule
  ],

  templateUrl:
    './admin-users.html',

  styleUrl:
    './admin-users.scss'
})
export class AdminUsersPage
  implements OnInit {

  private readonly fb =
    inject(FormBuilder);


  private readonly adminUsers =
    inject(AdminUsers);


  users:
    AdminUser[] = [];


  selectedUser:
    AdminUser | null =
      null;


  loading =
    false;


  createOpen =
    false;


  creating =
    false;


  updatingUserId:
    number | null =
      null;


  errorMessage =
    '';


  successMessage =
    '';


  readonly filterForm =
    this.fb.nonNullable.group({

      search: [
        ''
      ],

      status: [
        'all'
      ]

    });


  readonly createForm =
    this.fb.nonNullable.group({

      fullName: [
        '',
        [
          Validators.required,
          Validators.minLength(2),
          Validators.maxLength(150)
        ]
      ],

      email: [
        '',
        [
          Validators.required,
          Validators.email,
          Validators.maxLength(256)
        ]
      ],

      password: [
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

      confirmPassword: [
        '',
        [
          Validators.required
        ]
      ],

      isActive: [
        true
      ]

    });


  ngOnInit(): void {

    this.loadUsers();
  }


  loadUsers(): void {

    this.loading =
      true;

    this.errorMessage =
      '';


    const filters =
      this.filterForm
        .getRawValue();


    let isActive:
      boolean | null =
        null;


    if (
      filters.status ===
      'active'
    ) {

      isActive =
        true;

    } else if (
      filters.status ===
      'inactive'
    ) {

      isActive =
        false;
    }


    this.adminUsers
      .getUsers(
        filters.search,
        isActive
      )
      .subscribe({

        next: users => {

          this.users =
            users;

          this.loading =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );

          this.loading =
            false;
        }

      });
  }


  clearFilters(): void {

    this.filterForm
      .setValue({
        search: '',
        status: 'all'
      });


    this.loadUsers();
  }


  openUser(
    user: AdminUser
  ): void {

    this.errorMessage =
      '';


    this.adminUsers
      .getUser(
        user.id
      )
      .subscribe({

        next: response => {

          this.selectedUser =
            response;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );
        }

      });
  }


  closeUserDetails(): void {

    this.selectedUser =
      null;
  }


  openCreate(): void {

    this.createOpen =
      true;

    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.createForm
      .reset({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: '',
        isActive: true
      });
  }


  closeCreate(): void {

    if (
      this.creating
    ) {

      return;
    }


    this.createOpen =
      false;
  }


  createUser(): void {

    if (
      this.creating
    ) {

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';


    if (
      this.createForm.invalid
    ) {

      this.createForm
        .markAllAsTouched();


      this.errorMessage =
        'راجع البيانات المدخلة وصحح الحقول المشار إليها.';

      return;
    }


    const value =
      this.createForm
        .getRawValue();


    if (
      value.password !==
      value.confirmPassword
    ) {

      const confirmControl =
        this.createForm.controls
          .confirmPassword;


      confirmControl.setErrors({
        ...(confirmControl.errors ?? {}),
        passwordMismatch:
          true
      });


      confirmControl
        .markAsTouched();


      this.errorMessage =
        'كلمة المرور وتأكيد كلمة المرور غير متطابقين.';

      return;
    }


    this.creating =
      true;


    this.adminUsers
      .createUser({

        fullName:
          value.fullName.trim(),

        email:
          value.email.trim(),

        password:
          value.password,

        confirmPassword:
          value.confirmPassword,

        isActive:
          value.isActive

      })
      .subscribe({

        next: user => {

          this.users = [
            user,
            ...this.users
          ];


          this.successMessage =
            'تم إنشاء حساب المستخدم بنجاح.';


          this.creating =
            false;

          this.createOpen =
            false;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.creating =
            false;
        }

      });
  }


  toggleUserStatus(
    user: AdminUser
  ): void {

    if (
      this.updatingUserId !==
        null ||
      user.isSystemAdmin
    ) {

      return;
    }


    this.errorMessage =
      '';

    this.successMessage =
      '';


    this.updatingUserId =
      user.id;


    const newStatus =
      !user.isActive;


    this.adminUsers
      .setActiveStatus(
        user.id,
        newStatus
      )
      .subscribe({

        next: updated => {

          this.users =
            this.users.map(
              current =>
                current.id ===
                  updated.id
                  ? updated
                  : current
            );


          if (
            this.selectedUser?.id ===
            updated.id
          ) {

            this.selectedUser =
              updated;
          }


          this.successMessage =
            updated.isActive
              ? 'تم تفعيل الحساب بنجاح.'
              : 'تم تعطيل الحساب بنجاح.';


          this.updatingUserId =
            null;
        },


        error: error => {

          this.errorMessage =
            this.extractApiError(
              error
            );


          this.updatingUserId =
            null;
        }

      });
  }


  get totalUsers(): number {

    return this.users.length;
  }


  get activeUsers(): number {

    return this.users
      .filter(
        user =>
          user.isActive
      )
      .length;
  }


  get inactiveUsers(): number {

    return this.users
      .filter(
        user =>
          !user.isActive
      )
      .length;
  }


  userTypeLabel(
    user: AdminUser
  ): string {

    return user.isSystemAdmin
      ? 'مدير النظام'
      : 'مستخدم';
  }


  formatDate(
    value:
      string | null
  ): string {

    if (!value) {

      return 'لم يسجل الدخول بعد';
    }


    return new Date(
      value
    )
      .toLocaleString(
        'ar-SY',
        {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        }
      );
  }


  initial(
    user: AdminUser
  ): string {

    return (
      user.fullName
        ?.trim()
        .charAt(0)
        .toUpperCase()
      ||
      'U'
    );
  }


  private extractApiError(
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
              Array.isArray(value)
                ? value
                : [value]
          )
          .filter(Boolean)
          .map(String);


      if (
        messages.length > 0
      ) {

        return messages.join(
          ' '
        );
      }
    }


    return (
      error?.error?.detail
      ??
      error?.error?.message
      ??
      error?.error?.title
      ??
      'حدث خطأ غير متوقع.'
    );
  }
}