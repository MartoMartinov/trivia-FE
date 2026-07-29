import { computed, inject } from '@angular/core';
import {
  signalStore,
  withState,
  withComputed,
  withMethods,
  withHooks,
  patchState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { exhaustMap, tap } from 'rxjs';
import { TranslateService } from '@ngx-translate/core';

import { initialAuthSlice } from './auth.slice';
import { setAuthFromLogin, setAccessToken, clearAuth } from './auth.updaters';
import {
  withRequestStatus,
  setPending,
  setFulfilled,
  setError,
} from '../features/with-request-status.feature';
import { withLoading } from '../features/with-loading.feature';
import { ApiService } from '../../services/api.service';
import { AuthStrategyService } from '../../auth/auth-strategy.service';
import { apiErrorMessage, isAuthFailure } from '../../http/api-error';
import type { RegisterRequest, LoginRequest, LoginResponse } from '../../models/api.models';

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialAuthSlice),
  withLoading(),
  withRequestStatus(),
  withComputed((store) => ({
    isAuthenticated: computed(() => !!store.accessToken()),
    isAccessExpired: computed(() => {
      const exp = store.accessExpiresAt();
      return exp ? new Date(exp) < new Date() : true;
    }),
  })),
  withMethods((store) => {
    const api = inject(ApiService);
    const strategy = inject(AuthStrategyService);
    const translate = inject(TranslateService);

    const register = rxMethod<RegisterRequest>((req$) =>
      req$.pipe(
        tap(() => {
          patchState(store, setPending());
          patchState(store, { isLoading: true });
        }),
        exhaustMap((req) =>
          api.register(req).pipe(
            tapResponse({
              next: async (res: LoginResponse) => {
                await strategy.persistAfterLogin(res);
                patchState(store, setAuthFromLogin(res));
                patchState(store, setFulfilled());
              },
              error: (err: unknown) => {
                patchState(store, setError(apiErrorMessage(err, translate) ?? undefined));
              },
              finalize: () => patchState(store, { isLoading: false }),
            }),
          ),
        ),
      ),
    );

    const login = rxMethod<LoginRequest>((req$) =>
      req$.pipe(
        tap(() => {
          patchState(store, setPending());
          patchState(store, { isLoading: true });
        }),
        exhaustMap((req) =>
          api.login(req).pipe(
            tapResponse({
              next: async (res: LoginResponse) => {
                await strategy.persistAfterLogin(res);
                patchState(store, setAuthFromLogin(res));
                patchState(store, setFulfilled());
              },
              error: (err: unknown) => {
                patchState(store, setError(apiErrorMessage(err, translate) ?? undefined));
              },
              finalize: () => patchState(store, { isLoading: false }),
            }),
          ),
        ),
      ),
    );

    const refresh = rxMethod<void>((trigger$) =>
      trigger$.pipe(
        exhaustMap(() =>
          strategy.refresh().pipe(
            tapResponse({
              next: (res) =>
                patchState(
                  store,
                  setAccessToken(res.accessToken, res.accessExpiresAt),
                ),
              // Only a rejected refresh token means the session is gone. A 429 from the per-IP
              // throttle (or an offline browser) must leave the session alone — clearing it would
              // force a re-login through the same throttled bucket. Stays silent either way:
              // this runs unprompted on cold start, and the throttle gets explained properly the
              // moment the player actually submits something.
              error: (err: unknown) => {
                if (isAuthFailure(err)) patchState(store, clearAuth());
              },
            }),
          ),
        ),
      ),
    );

    const logout = async (): Promise<void> => {
      await strategy.clear();
      patchState(store, clearAuth());
    };

    return { register, login, refresh, logout };
  }),
  withHooks((store) => ({
    onInit: () => {
      // silent re-auth on cold start
      store.refresh(undefined);
    },
  })),
);
