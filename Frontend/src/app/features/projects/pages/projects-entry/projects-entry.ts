import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  Router
} from '@angular/router';

import {
  Workspaces
} from '../../../../core/services/workspaces';


@Component({
  selector: 'app-projects-entry',

  template: ''
})
export class ProjectsEntryPage
  implements OnInit {

  private readonly router =
    inject(Router);


  private readonly workspacesService =
    inject(Workspaces);


  ngOnInit(): void {

    this.workspacesService
      .getAll()
      .subscribe({

        next: workspaces => {

          if (
            workspaces.length === 0
          ) {

            this.router.navigateByUrl(
              '/dashboard'
            );

            return;
          }


          const storedWorkspaceId =
            this.readStoredWorkspaceId();


          const workspace =
            workspaces.find(
              item =>
                item.id ===
                storedWorkspaceId
            )
            ??
            workspaces[0];


          localStorage.setItem(
            'taskmanagement_selected_workspace_id',
            String(
              workspace.id
            )
          );


          localStorage.setItem(
            'taskmanagement_workspace_name',
            workspace.name
          );


          localStorage.setItem(
            'taskmanagement_selected_workspace_name',
            workspace.name
          );


          this.router.navigateByUrl(
            `/workspaces/${workspace.id}/projects`
          );
        },


        error: () => {

          this.router.navigateByUrl(
            '/dashboard'
          );
        }

      });
  }


  private readStoredWorkspaceId():
    number {

    const keys =
      [
        'taskmanagement_selected_workspace_id',
        'taskmanagement_workspace_id',
        'selectedWorkspaceId',
        'workspaceId'
      ];


    for (
      const key
      of keys
    ) {

      const value =
        Number(
          localStorage.getItem(
            key
          )
        );


      if (
        Number.isFinite(value) &&
        value > 0
      ) {

        return value;
      }
    }


    return 0;
  }
}