import {
  HttpBackend,
  HttpClient,
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
  map,
  of,
  switchMap,
  throwError
} from 'rxjs';

import {
  environment
} from '../../../environments/environment';

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


    /*
     * HttpClient خام يتجاوز جميع Interceptors.
     *
     * نستخدمه فقط للتحقق من صلاحية الجلسة
     * عند استقبال 401، حتى لا ندخل في Loop
     * داخل apiErrorInterceptor نفسه.
     */
    const httpBackend =
      inject(HttpBackend);


    const rawHttpClient =
      new HttpClient(
        httpBackend
      );


    const clearSessionAndRedirect =
      (): void => {

        tokenStorage.clear();


        if (
          router.url !==
          '/login'
        ) {

          void router.navigateByUrl(
            '/login'
          );
        }
      };


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
               * تسجيل الدخول واستعادة كلمة المرور
               * Endpoints عامة، لذلك لا نطبق عليها
               * منطق التحقق من الجلسة.
               */
              const isPublicAuthRequest =
                req.url.includes(
                  '/api/Auth/login'
                )
                ||
                req.url.includes(
                  '/api/Auth/password-recovery/'
                );


              if (
                isPublicAuthRequest
              ) {

                return throwError(
                  () =>
                    error
                );
              }


              const token =
                tokenStorage.getToken();


              /*
               * إذا لم يكن هناك Token أصلًا،
               * لا يوجد Session محلية نمسحها.
               */
              if (!token) {

                return throwError(
                  () =>
                    error
                );
              }


              /*
               * إذا كان /profile نفسه هو الذي
               * أعاد 401، فهذا دليل مباشر أن
               * الجلسة الحالية لم تعد صالحة.
               */
              const isProfileRequest =
                req.url.includes(
                  '/api/Auth/profile'
                );


              if (
                isProfileRequest
              ) {

                clearSessionAndRedirect();


                return throwError(
                  () =>
                    error
                );
              }


              /*
               * لا نسجل خروج المستخدم بسبب 401
               * من Endpoint عادي مباشرة.
               *
               * أولًا نتحقق من الجلسة عبر Profile
               * باستخدام HttpClient يتجاوز
               * الـInterceptors.
               */
              const apiBaseUrl =
                environment.apiBaseUrl
                  .replace(
                    /\/+$/,
                    ''
                  );


              return rawHttpClient
                .get(
                  `${apiBaseUrl}/api/Auth/profile`,
                  {
                    headers: {
                      Authorization:
                        `Bearer ${token}`
                    }
                  }
                )
                .pipe(

                  /*
                   * Profile نجح:
                   * الـToken والجلسة صالحان.
                   */
                  map(
                    () => true
                  ),


                  /*
                   * لا نسجل خروج المستخدم إلا
                   * إذا Profile نفسه أكد ذلك بـ401.
                   *
                   * مشاكل الشبكة و500 وغيرها
                   * لا تعتبر دليلًا على انتهاء
                   * الجلسة.
                   */
                  catchError(
                    profileError => {

                      if (
                        profileError
                          instanceof
                            HttpErrorResponse
                        &&
                        profileError.status ===
                          401
                      ) {

                        return of(
                          false
                        );
                      }


                      return of(
                        true
                      );
                    }
                  ),


                  switchMap(
                    sessionIsValid => {

                      if (
                        !sessionIsValid
                      ) {

                        clearSessionAndRedirect();
                      }


                      /*
                       * نحافظ على الخطأ الأصلي
                       * حتى تستطيع الصفحة نفسها
                       * التعامل معه وعرض سببه.
                       */
                      return throwError(
                        () =>
                          error
                      );
                    }
                  )

                );
            }


            /* =============================================
               EXPECTED API ERRORS
               ============================================= */

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


              if (
                typeof existingDetail ===
                  'string'
                &&
                existingDetail
                  .trim()
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