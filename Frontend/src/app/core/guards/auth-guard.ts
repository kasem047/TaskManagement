import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

import { TokenStorage } from '../services/token-storage';

export const authGuard: CanActivateFn = () => {
  const tokenStorage = inject(TokenStorage);
  const router = inject(Router);

  if (tokenStorage.isAuthenticated()) {
    return true;
  }

  return router.createUrlTree(['/login']);
};