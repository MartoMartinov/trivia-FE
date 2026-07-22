import { Routes } from '@angular/router';
import { translationGuard } from './core/guards/translation.guard';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'register',
    pathMatch: 'full',
  },
  {
    path: 'register',
    canActivate: [translationGuard],
    loadComponent: () =>
      import('./pages/register/register.page').then((m) => m.RegisterPage),
  },
  {
    path: 'game',
    canActivate: [translationGuard, authGuard],
    loadComponent: () =>
      import('./pages/game/game.page').then((m) => m.GamePage),
  },
  {
    path: 'sponsor',
    canActivate: [translationGuard, authGuard],
    loadComponent: () =>
      import('./pages/sponsor/sponsor.page').then((m) => m.SponsorPage),
  },
  {
    path: 'results/:id',
    canActivate: [translationGuard, authGuard],
    loadComponent: () =>
      import('./pages/results/results.page').then((m) => m.ResultsPage),
  },
  {
    path: 'leaderboard',
    canActivate: [translationGuard, authGuard],
    loadComponent: () =>
      import('./pages/leaderboard/leaderboard.page').then((m) => m.LeaderboardPage),
  },
  {
    path: 'booth-display/:id',
    canActivate: [translationGuard],
    loadComponent: () =>
      import('./pages/booth-display/booth-display.page').then((m) => m.BoothDisplayPage),
  },
  {
    path: 'page/:id',
    canActivate: [translationGuard],
    loadComponent: () =>
      import('./pages/static-page/static-page.page').then((m) => m.StaticPagePage),
  },
  {
    path: 'unsubscribe',
    canActivate: [translationGuard],
    loadComponent: () =>
      import('./pages/unsubscribe/unsubscribe.page').then((m) => m.UnsubscribePage),
  },
  {
    path: 'resubscribe',
    canActivate: [translationGuard],
    loadComponent: () =>
      import('./pages/resubscribe/resubscribe.page').then((m) => m.ResubscribePage),
  },
  // { path: '**', redirectTo: 'register' },
];
