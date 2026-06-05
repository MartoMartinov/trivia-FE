import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { exhaustMap, tap } from 'rxjs';

import { initialAuthSlice } from './auth.slice';
import { setAuthFromLogin, setAccessToken, clearAuth } from './auth.updaters';
import { withRequestStatus, setPending, setFulfilled, setError } from '../features/with-request-status.feature';
import { withLoading } from '../features/with-loading.feature';
import { ApiService } from '../../services/api.service';
import { AuthStrategyService } from '../../auth/auth-strategy.service';
import type { RegisterRequest, LoginResponse } from '../../models/api.models';

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
                const msg = (err as { error?: { message?: string } })?.error?.message ?? null;
                patchState(store, setError(msg ?? undefined));
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
              next: (res) => patchState(store, setAccessToken(res.accessToken, res.accessExpiresAt)),
              error: () => patchState(store, clearAuth()),
            }),
          ),
        ),
      ),
    );

    const logout = async (): Promise<void> => {
      await strategy.clear();
      patchState(store, clearAuth());
    };

    return { register, refresh, logout };
  }),
  withHooks((store) => ({
    onInit: () => {
      // silent re-auth on cold start
      store.refresh(undefined);
    },
  })),
);
