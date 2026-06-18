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
import { AuthStrategyService } from '../auth/auth-strategy.service';
import { environment } from '../../../environments/environment';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const authStore = inject(AuthStore);
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

  return next(authed).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && token) {
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
            router.navigate(['/register']);
            return throwError(() => err);
          }),
        );
      }
      return throwError(() => err);
    }),
  );
};
