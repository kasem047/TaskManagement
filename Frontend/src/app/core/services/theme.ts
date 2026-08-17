import {
  DOCUMENT
} from '@angular/common';

import {
  Injectable,
  inject,
  signal
} from '@angular/core';

export type ThemeMode =
  'light' |
  'dark';

@Injectable({
  providedIn: 'root'
})
export class Theme {
  private readonly document =
    inject(DOCUMENT);

private readonly storageKey =
  'taskmanagement_theme';

  readonly current =
    signal<ThemeMode>('light');

  constructor() {
    this.initialize();
  }

  toggle(): void {
    this.set(
      this.current() === 'light'
        ? 'dark'
        : 'light'
    );
  }

  set(mode: ThemeMode): void {
    this.current.set(mode);

    this.document
      .documentElement
      .classList
      .toggle(
        'dark',
        mode === 'dark'
      );

    localStorage.setItem(
      this.storageKey,
      mode
    );
  }

  private initialize(): void {
    const saved =
      localStorage.getItem(
        this.storageKey
      ) as ThemeMode | null;

    if (
      saved === 'light' ||
      saved === 'dark'
    ) {
      this.set(saved);
      return;
    }

    const prefersDark =
      window.matchMedia(
        '(prefers-color-scheme: dark)'
      ).matches;

    this.set(
      prefersDark
        ? 'dark'
        : 'light'
    );
  }
}