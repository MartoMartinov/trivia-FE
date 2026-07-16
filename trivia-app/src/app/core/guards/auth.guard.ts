import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthStore } from '../stores/auth/auth.store';
import { BoothTokenStore } from '../stores/booth-token/booth-token.store';

export const authGuard: CanActivateFn = () => {
  const authStore = inject(AuthStore);
  const boothTokenStore = inject(BoothTokenStore);
  const router = inject(Router);

  if (authStore.isAuthenticated()) {
    return true;
  }

  const boothToken = boothTokenStore.boothToken();
  return router.createUrlTree(['/register'], {
    queryParams: boothToken ? { boothToken } : {},
  });
};
