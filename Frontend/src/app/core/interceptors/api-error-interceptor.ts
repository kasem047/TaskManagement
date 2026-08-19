import {
  HttpErrorResponse,
  HttpInterceptorFn
} from '@angular/common/http';

import {
  inject
} from '@angular/core';

import {
  Router
} from '@angular/router';

import {
  catchError,
  throwError
} from 'rxjs';

import {
  TokenStorage
} from '../services/token-storage';


export const apiErrorInterceptor:
  HttpInterceptorFn = (
    req,
    next
  ) => {

    const tokenStorage =
      inject(TokenStorage);


    const router =
      inject(Router);


    return next(req)
      .pipe(

        catchError(
          (
            error:
              HttpErrorResponse
          ) => {

            /* =============================================
               NETWORK / SERVER UNREACHABLE
               ============================================= */

            if (
              error.status === 0
            ) {

              const networkError =
                new HttpErrorResponse({

                  error: {
                    detail:
                      'تعذر الاتصال بالخادم. تحقق من اتصال الإنترنت أو حاول مرة أخرى بعد قليل.'
                  },

                  status:
                    0,

                  statusText:
                    error.statusText,

                  url:
                    error.url
                      ?? undefined

                });


              return throwError(
                () =>
                  networkError
              );
            }


            /* =============================================
               UNAUTHORIZED
               ============================================= */

            if (
              error.status === 401
            ) {

              /*
               * لا نتدخل في محاولات تسجيل الدخول
               * أو استعادة كلمة المرور؛
               * هذه الصفحات يجب أن تعرض خطأ الـAPI
               * للمستخدم بشكل طبيعي.
               */
              const isPublicAuthRequest =
                req.url.includes(
                  '/api/Auth/login'
                )
                ||
                req.url.includes(
                  '/api/Auth/password-recovery/'
                );


              const hasToken =
                tokenStorage.hasToken();


              if (
                hasToken &&
                !isPublicAuthRequest
              ) {

                tokenStorage.clear();


                void router.navigateByUrl(
                  '/login'
                );
              }


              return throwError(
                () =>
                  error
              );
            }


            /* =============================================
               EXPECTED API ERRORS
               ============================================= */

            /*
             * 400 Validation / Bad Request
             * 403 Forbidden
             * 404 Not Found
             * 409 Conflict
             *
             * الـBackend عندنا يعيد ProblemDetails
             * ورسائل Business واضحة، لذلك نحافظ
             * عليها كما هي كي تعرضها الصفحة.
             */
            if (
              error.status === 400
              ||
              error.status === 403
              ||
              error.status === 404
              ||
              error.status === 409
            ) {

              return throwError(
                () =>
                  error
              );
            }


            /* =============================================
               SERVER ERRORS
               ============================================= */

            if (
              error.status >= 500
            ) {

              const existingDetail =
                error?.error?.detail
                ??
                error?.error?.message;


              /*
               * إذا رجع الـBackend رسالة حقيقية
               * فلا نستبدلها.
               */
              if (
                typeof existingDetail ===
                  'string'
                &&
                existingDetail.trim()
                  .length > 0
              ) {

                return throwError(
                  () =>
                    error
                );
              }


              const serverError =
                new HttpErrorResponse({

                  error: {
                    detail:
                      'حدث خطأ غير متوقع في الخادم. حاول مرة أخرى بعد قليل.'
                  },

                  status:
                    error.status,

                  statusText:
                    error.statusText,

                  url:
                    error.url
                      ?? undefined

                });


              return throwError(
                () =>
                  serverError
              );
            }


            /* =============================================
               FALLBACK
               ============================================= */

            return throwError(
              () =>
                error
            );
          }
        )

      );
  };