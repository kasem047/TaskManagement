import {
  Component,
  OnInit,
  inject
} from '@angular/core';

import {
  Router
} from '@angular/router';

import {
  TaskBoardScope
} from '../../../../core/services/task-board-scope';


@Component({
  selector: 'app-tasks-entry',

  standalone: true,

  template: ''
})
export class TasksEntryPage
  implements OnInit {

  private readonly router =
    inject(Router);


  private readonly boardScope =
    inject(TaskBoardScope);


  ngOnInit(): void {

    this.boardScope
      .loadAccessibleBoard()
      .subscribe({

        next: snapshot => {

          const activeProjects =
            snapshot.projects
              .filter(
                project =>
                  !project.isArchived
              );


          if (
            activeProjects.length === 0
          ) {

            this.router.navigateByUrl(
              '/projects'
            );

            return;
          }


          const storedWorkspaceId =
            this.readStoredWorkspaceId();


          const storedProjectId =
            this.readStoredProjectId();


          const project =
            activeProjects.find(
              item =>
                item.id ===
                storedProjectId
            )
            ??
            activeProjects.find(
              item =>
                item.workspaceId ===
                storedWorkspaceId
            )
            ??
            activeProjects[0];


          const workspace =
            snapshot.workspaces
              .find(
                item =>
                  item.id ===
                  project.workspaceId
              );


          if (!workspace) {

            this.router.navigateByUrl(
              '/dashboard'
            );

            return;
          }


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


          localStorage.setItem(
            'taskmanagement_selected_project_id',
            String(
              project.id
            )
          );


          localStorage.setItem(
            'taskmanagement_project_name',
            project.name
          );


          this.router.navigateByUrl(
            `/workspaces/${workspace.id}/projects/${project.id}/tasks`
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


  private readStoredProjectId():
    number {

    const keys =
      [
        'taskmanagement_selected_project_id',
        'taskmanagement_project_id',
        'selectedProjectId',
        'projectId'
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