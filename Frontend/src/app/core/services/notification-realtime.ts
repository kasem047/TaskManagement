import {
  Injectable,
  inject
} from '@angular/core';

import {
  Subject
} from 'rxjs';

import {
  HubConnection,
  HubConnectionBuilder,
  HubConnectionState,
  LogLevel
} from '@microsoft/signalr';

import {
  environment
} from '../../../environments/environment';

import {
  TokenStorage
} from './token-storage';

import {
  NotificationItem
} from './notifications';


@Injectable({
  providedIn: 'root'
})
export class NotificationRealtime {

  private readonly tokenStorage =
    inject(TokenStorage);


  private connection:
    HubConnection | null = null;


  private startPromise:
    Promise<void> | null = null;


  private retryTimer:
    ReturnType<
      typeof setTimeout
    > | null = null;


  private manuallyStopped =
    false;


  private readonly receivedSubject =
    new Subject<NotificationItem>();


  readonly received$ =
    this.receivedSubject
      .asObservable();


  start(): void {

    this.manuallyStopped =
      false;


    if (
      this.connection?.state ===
        HubConnectionState.Connected ||
      this.connection?.state ===
        HubConnectionState.Connecting ||
      this.startPromise
    ) {

      return;
    }


    if (!this.connection) {

      this.connection =
        this.createConnection();
    }


    this.startPromise =
      this.connection
        .start()
        .then(
          () => {

            console.log(
              'Notification SignalR connected.'
            );
          }
        )
        .catch(
          error => {

            console.error(
              'Notification SignalR connection failed:',
              error
            );


            this.scheduleRetry();
          }
        )
        .finally(
          () => {

            this.startPromise =
              null;
          }
        );
  }


  async stop():
    Promise<void> {

    this.manuallyStopped =
      true;


    if (this.retryTimer) {

      clearTimeout(
        this.retryTimer
      );

      this.retryTimer =
        null;
    }


    if (!this.connection) {
      return;
    }


    try {

      await this.connection
        .stop();

    } catch (
      error
    ) {

      console.error(
        'Notification SignalR stop failed:',
        error
      );
    }
  }


  private createConnection():
    HubConnection {

    const apiBaseUrl =
      environment.apiBaseUrl
        .replace(
          /\/+$/,
          ''
        );


    const connection =
      new HubConnectionBuilder()
        .withUrl(
          `${apiBaseUrl}/hubs/notifications`,
          {
            accessTokenFactory:
              () =>
                this.tokenStorage
                  .getToken()
                ?? ''
          }
        )
        .withAutomaticReconnect([
          0,
          2000,
          5000,
          10000,
          30000
        ])
        .configureLogging(
          LogLevel.Warning
        )
        .build();


    connection.on(
      'notificationReceived',
      (
        notification:
          NotificationItem
      ) => {

        this.receivedSubject
          .next(
            notification
          );
      }
    );


    connection.onreconnected(
      () => {

        console.log(
          'Notification SignalR reconnected.'
        );
      }
    );


    connection.onclose(
      error => {

        if (error) {

          console.error(
            'Notification SignalR closed:',
            error
          );
        }


        if (
          !this.manuallyStopped
        ) {

          this.scheduleRetry();
        }
      }
    );


    return connection;
  }


  private scheduleRetry():
    void {

    if (
      this.manuallyStopped ||
      this.retryTimer
    ) {

      return;
    }


    this.retryTimer =
      setTimeout(
        () => {

          this.retryTimer =
            null;

          this.start();

        },
        5000
      );
  }
}