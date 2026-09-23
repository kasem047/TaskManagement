import {
  CanActivateFn,
  Router
} from '@angular/router';

import {
  inject
} from '@angular/core';

import {
  map
} from 'rxjs';

import {
  WorkspaceAccess
} from '../services/workspace-access';


export const adminGuard:
  CanActivateFn = () => {

  const access =
    inject(WorkspaceAccess);

  const router =
    inject(Router);

  return access.refresh()
    .pipe(

      map(snapshot => {

        if (
          snapshot.profile?.isSystemAdmin === true
        ) {

          return true;
        }

        return router.createUrlTree(
          [
            '/dashboard'
          ]
        );
      })

    );
};
