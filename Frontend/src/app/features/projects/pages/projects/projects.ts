import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  ActivatedRoute,
  Router
} from '@angular/router';

import {
  Project,
  Projects
} from '../../../../core/services/projects';


@Component({
  selector: 'app-projects',

  imports: [],

  templateUrl: './projects.html',

  styleUrl: './projects.scss'
})
export class ProjectsPage
  implements OnInit {

  private readonly route =
    inject(ActivatedRoute);

  private readonly router =
    inject(Router);

  private readonly projectsService =
    inject(Projects);


  workspaceId = 0;

  workspaceName =
    'مساحة العمل';

  projects: Project[] = [];

  loading = true;

  errorMessage = '';


  ngOnInit(): void {

    this.workspaceId =
      Number(
        this.route.snapshot
          .paramMap
          .get('workspaceId')
      );


    this.workspaceName =
      localStorage.getItem(
        'taskmanagement_workspace_name'
      ) ?? 'مساحة العمل';


    if (!this.workspaceId) {

      this.router.navigateByUrl(
        '/dashboard'
      );

      return;
    }


    this.loadProjects();
  }


  loadProjects(): void {

    this.loading = true;

    this.errorMessage = '';


    this.projectsService
      .getByWorkspace(
        this.workspaceId
      )
      .subscribe({

        next: projects => {

          this.projects =
            projects;

          this.loading =
            false;
        },


        error: error => {

          console.error(
            'Projects request failed:',
            error
          );


          if (error.status === 403) {

            this.errorMessage =
              'لا تملك صلاحية عرض مشاريع هذه المساحة.';

          } else {

            this.errorMessage =
              'تعذر تحميل المشاريع.';
          }


          this.loading =
            false;
        }

      });
  }


  back(): void {

    this.router.navigateByUrl(
      '/dashboard'
    );
  }


  get activeProjects(): Project[] {

    return this.projects.filter(
      project =>
        !project.isArchived
    );
  }


  get archivedProjects(): Project[] {

    return this.projects.filter(
      project =>
        project.isArchived
    );
  }


  managerName(
    project: Project
  ): string {

    return (
      project.managerUserFullName
      ?? 'غير معيّن'
    );
  }

openProject(
  project: Project
): void {

  localStorage.setItem(
    'taskmanagement_project_id',
    project.id.toString()
  );

  localStorage.setItem(
    'taskmanagement_project_name',
    project.name
  );

  this.router.navigate([
    '/workspaces',
    this.workspaceId,
    'projects',
    project.id,
    'tasks'
  ]);
}
  firstLetter(
    name: string
  ): string {

    return (
      name
        ?.trim()
        ?.charAt(0)
        ?.toUpperCase()
      || 'P'
    );
  }
}