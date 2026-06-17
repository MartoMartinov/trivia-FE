import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, withHooks, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { switchMap, timer } from 'rxjs';

import { initialLeaderboardSlice } from './leaderboard.slice';
import { setLeaderboard, setActiveScope } from './leaderboard.updaters';
import { withRequestStatus, setPending, setFulfilled, setError } from '../features/with-request-status.feature';
import { withLoading } from '../features/with-loading.feature';
import { ApiService } from '../../services/api.service';
import { AuthStore } from '../auth/auth.store';
import type { LeaderboardScope } from '../../models/api.models';

const POLL_INTERVAL_MS = 10_000;

export const LeaderboardStore = signalStore(
  withState(initialLeaderboardSlice),
  withLoading(),
  withRequestStatus(),
  withComputed((store) => ({
    currentPlayerRow: computed(() =>
      store.rows().find((r) => r.isCurrentPlayer) ?? null,
    ),
  })),
  withMethods((store) => {
    const api = inject(ApiService);

    const load = rxMethod<LeaderboardScope>((scope$) =>
      scope$.pipe(
        switchMap((scope: LeaderboardScope) => {
          patchState(store, setPending());
          return api.getLeaderboard(scope).pipe(
            tapResponse({
              next: (res: import('../../models/api.models').LeaderboardResponse) => {
                patchState(store, setLeaderboard(res));
                patchState(store, setFulfilled());
              },
              error: () => patchState(store, setError()),
            }),
          );
        }),
      ),
    );

    // Polling is keyed by scope: emitting a new scope makes the outer switchMap tear down the
    // previous timer and start a fresh one that fetches immediately — no stale window on tab switch.
    const startPolling = rxMethod<LeaderboardScope>((scope$) =>
      scope$.pipe(
        switchMap((scope) =>
          timer(0, POLL_INTERVAL_MS).pipe(
            switchMap(() =>
              api.getLeaderboard(scope).pipe(
                tapResponse({
                  next: (res: import('../../models/api.models').LeaderboardResponse) =>
                    patchState(store, setLeaderboard(res)),
                  error: () => {},
                }),
              ),
            ),
          ),
        ),
      ),
    );

    return {
      load,
      startPolling,
      setScope: (scope: LeaderboardScope) => {
        patchState(store, setActiveScope(scope));
        startPolling(scope);
      },
    };
  }),
);
