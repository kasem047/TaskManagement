import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  Router
} from '@angular/router';

import {
  Workspace,
  Workspaces
} from '../../../../core/services/workspaces';

import {
  StoredUser,
  TokenStorage
} from '../../../../core/services/token-storage';


@Component({
  selector: 'app-dashboard',

  templateUrl: './dashboard.html',

  styleUrl: './dashboard.scss'
})
export class Dashboard
  implements OnInit {

  private readonly router =
    inject(Router);


  private readonly workspacesService =
    inject(Workspaces);


  private readonly tokenStorage =
    inject(TokenStorage);


  /* =========================
     USER
     ========================= */

  user:
    StoredUser | null = null;


  /* =========================
     WORKSPACES
     ========================= */

  workspaces:
    Workspace[] = [];


  loading =
    true;


  errorMessage =
    '';


  /* =========================
     INIT
     ========================= */

  ngOnInit(): void {

    this.user =
      this.tokenStorage.getUser();


    this.loadWorkspaces();
  }


  /* =========================
     LOAD
     ========================= */

  loadWorkspaces(): void {

    this.loading =
      true;


    this.errorMessage =
      '';


    this.workspacesService
      .getAll()
      .subscribe({

        next: (
          workspaces: Workspace[]
        ) => {

          this.workspaces =
            workspaces;


          this.loading =
            false;
        },


        error: (
          error: unknown
        ) => {

          console.error(
            'Workspaces request failed:',
            error
          );


          this.errorMessage =
            'تعذر تحميل مساحات العمل.';


          this.loading =
            false;
        }

      });
  }


  refresh(): void {

    this.loadWorkspaces();
  }


  /* =========================
     WORKSPACE MANAGEMENT
     ========================= */

  openWorkspaceManagement(): void {

    this.router.navigateByUrl(
      '/workspaces'
    );
  }


  get canCreateWorkspace():
    boolean {

    /*
     * لا نسمح بالانتقال قبل اكتمال
     * تحميل Workspaces حتى لا يحدث
     * قرار خاطئ أثناء التحميل.
     */
    return (
      !this.loading &&
      this.ownerCount === 0
    );
  }


  openCreateWorkspace(): void {

    /*
     * المستخدم الذي يملك Workspace
     * لا يجب أن ينتقل أصلًا إلى
     * create=1.
     */
    if (
      !this.canCreateWorkspace
    ) {

      return;
    }


    this.router.navigate(
      [
        '/workspaces'
      ],
      {
        queryParams: {
          create: 1
        }
      }
    );
  }


  /* =========================
     OPEN WORKSPACE
     ========================= */

  openWorkspace(
    workspace: Workspace
  ): void {

    localStorage.setItem(
      'taskmanagement_workspace_id',
      String(
        workspace.id
      )
    );


    localStorage.setItem(
      'taskmanagement_workspace_name',
      workspace.name
    );


    localStorage.setItem(
      'taskmanagement_selected_workspace_id',
      String(
        workspace.id
      )
    );


    localStorage.setItem(
      'taskmanagement_selected_workspace_name',
      workspace.name
    );


    /*
     * عند تغيير مساحة العمل
     * نمسح سياق المشروع القديم.
     */
    localStorage.removeItem(
      'taskmanagement_selected_project_id'
    );


    localStorage.removeItem(
      'taskmanagement_project_name'
    );


    this.router.navigate([
      '/workspaces',
      workspace.id,
      'projects'
    ]);
  }


  /* =========================
     QUICK NAVIGATION
     ========================= */

  openProjects(): void {

    this.router.navigateByUrl(
      '/projects'
    );
  }


  openTasks(): void {

    this.router.navigateByUrl(
      '/tasks'
    );
  }


  openTeam(): void {

    this.router.navigateByUrl(
      '/team'
    );
  }


  /* =========================
     COUNTS
     ========================= */

  get ownerCount():
    number {

    return this.workspaces
      .filter(
        workspace =>
          this.isOwnerRole(
            workspace.currentUserRole
          )
      )
      .length;
  }


  get managerCount():
    number {

    return this.workspaces
      .filter(
        workspace =>
          workspace.currentUserRole ===
          'ProjectManager'
      )
      .length;
  }


  /* =========================
     ROLE LABEL
     ========================= */

  roleLabel(
    role: string
  ): string {

    switch (role) {

      case 'Owner':

      case 'WorkspaceOwner':

        return 'مالك مساحة العمل';


      case 'ProjectManager':

        return 'مدير مشروع';


      case 'Member':

        return 'عضو';


      default:

        return role;
    }
  }


  /* =========================
     FIRST LETTER
     ========================= */

  firstLetter(
    value:
      string |
      null |
      undefined
  ): string {

    const normalized =
      value?.trim();


    if (!normalized) {

      return '؟';
    }


    return normalized
      .charAt(0)
      .toUpperCase();
  }


  private isOwnerRole(
    role: string
  ): boolean {

    return (
      role === 'Owner' ||
      role === 'WorkspaceOwner'
    );
  }
}