import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners
} from '@angular/core';

import {
  provideRouter
} from '@angular/router';

import {
  provideHttpClient,
  withInterceptors
} from '@angular/common/http';

import {
  routes
} from './app.routes';

import {
  authInterceptor
} from './core/interceptors/auth-interceptor';

import {
  apiErrorInterceptor
} from './core/interceptors/api-error-interceptor';


export const appConfig:
  ApplicationConfig = {

  providers: [

    provideBrowserGlobalErrorListeners(),


    provideRouter(
      routes
    ),


    provideHttpClient(

      withInterceptors([

        authInterceptor,

        apiErrorInterceptor

      ])

    )

  ]

};