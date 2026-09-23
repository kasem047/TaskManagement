import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';

import { TokenStorage } from '../services/token-storage';

export const authInterceptor: HttpInterceptorFn = (
  req,
  next
) => {
  const tokenStorage = inject(TokenStorage);
  const token = tokenStorage.getToken();

  const isPublicAuthRequest =
    req.url.includes('/api/Auth/login') ||
    req.url.includes('/api/Auth/password-recovery/');

  if (!token || isPublicAuthRequest) {
    return next(req);
  }

  const authenticatedRequest = req.clone({
    setHeaders: {
      Authorization: `Bearer ${token}`
    }
  });

  return next(authenticatedRequest);
};