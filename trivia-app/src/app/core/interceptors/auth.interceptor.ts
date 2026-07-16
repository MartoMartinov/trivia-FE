import { inject } from '@angular/core';
import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpErrorResponse,
} from '@angular/common/http';
import { Router } from '@angular/router';
import { throwError, catchError, switchMap } from 'rxjs';
import { AuthStore } from '../stores/auth/auth.store';
import { BoothTokenStore } from '../stores/booth-token/booth-token.store';
import { AuthStrategyService } from '../auth/auth-strategy.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authStore = inject(AuthStore);
  const boothTokenStore = inject(BoothTokenStore);
  const strategy = inject(AuthStrategyService);
  const router = inject(Router);

  // only attach auth headers to our own API
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const token = authStore.accessToken();
  const authed = req.clone({
    ...(token ? { setHeaders: { Authorization: `Bearer ${token}` } } : {}),
    withCredentials: strategy.httpOptions.withCredentials,
  });

  const isRefreshRequest = req.url.includes('/auth/refresh');

  return next(authed).pipe(
    catchError((err: unknown) => {
      // Never retry the refresh endpoint itself — that would cause an infinite loop.
      if (err instanceof HttpErrorResponse && err.status === 401 && token && !isRefreshRequest) {
        return strategy.refresh().pipe(
          switchMap((res) => {
            const retried = req.clone({
              setHeaders: { Authorization: `Bearer ${res.accessToken}` },
              withCredentials: strategy.httpOptions.withCredentials,
            });
            return next(retried);
          }),
          catchError(() => {
            authStore.logout();
            const boothToken = boothTokenStore.boothToken();
            router.navigate(['/register'], { queryParams: boothToken ? { boothToken } : {} });
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
