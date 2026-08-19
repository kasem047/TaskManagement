import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  Router
} from '@angular/router';

import {
  Admin,
  AdminDashboard
} from '../../../../core/services/admin';


@Component({
  selector:
    'app-admin-dashboard',

  imports: [],

  templateUrl:
    './admin-dashboard.html',

  styleUrl:
    './admin-dashboard.scss'
})
export class AdminDashboardPage
  implements OnInit {

  private readonly admin =
    inject(Admin);


  private readonly router =
    inject(Router);


  dashboard:
    AdminDashboard | null =
      null;


  loading =
    true;


  errorMessage =
    '';


  ngOnInit(): void {

    this.loadDashboard();
  }


  loadDashboard(): void {

    this.loading =
      true;

    this.errorMessage =
      '';


    this.admin
      .getDashboard()
      .subscribe({

        next: dashboard => {

          this.dashboard =
            dashboard;

          this.loading =
            false;
        },


        error: error => {

          console.error(
            'Admin dashboard failed:',
            error
          );


          this.errorMessage =
            this.extractApiError(
              error
            );


          this.loading =
            false;
        }

      });
  }


  get completionRate():
    number {

    if (
      !this.dashboard ||
      this.dashboard.totalTasks ===
        0
    ) {

      return 0;
    }


    return Math.round(
      (
        this.dashboard.doneTasks /
        this.dashboard.totalTasks
      ) *
      100
    );
  }


  get activeUsersRate():
    number {

    if (
      !this.dashboard ||
      this.dashboard.totalUsers ===
        0
    ) {

      return 0;
    }


    return Math.round(
      (
        this.dashboard.activeUsers /
        this.dashboard.totalUsers
      ) *
      100
    );
  }


  get activeProjectsRate():
    number {

    if (
      !this.dashboard ||
      this.dashboard.totalProjects ===
        0
    ) {

      return 0;
    }


    return Math.round(
      (
        this.dashboard.activeProjects /
        this.dashboard.totalProjects
      ) *
      100
    );
  }


  openUsers(): void {

    this.router.navigateByUrl(
      '/admin/users'
    );
  }


  openPasswordRecovery():
    void {

    this.router.navigateByUrl(
      '/admin/password-recovery'
    );
  }


  openRolesPermissions():
    void {

    this.router.navigateByUrl(
      '/admin/roles-permissions'
    );
  }


  openUserPermissions():
    void {

    this.router.navigateByUrl(
      '/admin/user-permissions'
    );
  }


  openWorkspaces(): void {

    this.router.navigateByUrl(
      '/workspaces'
    );
  }


  openDashboard(): void {

    this.router.navigateByUrl(
      '/dashboard'
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
          '\n'
        );
      }
    }


    return (
      error?.error?.message
      ??
      error?.error?.detail
      ??
      error?.error?.title
      ??
      error?.message
      ??
      'تعذر تحميل لوحة إدارة النظام.'
    );
  }
}