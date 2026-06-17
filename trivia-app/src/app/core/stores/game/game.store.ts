import { computed, inject } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { EMPTY, exhaustMap, switchMap, tap } from 'rxjs';

import { initialGameSlice } from './game.slice';
import {
  setSessionStarted,
  applyAnswerResult,
  applySponsorResult,
  setQuestionBuffer,
  setSponsorBonus,
  setGameCompleted,
  resetGame,
} from './game.updaters';
import { withRequestStatus, setPending, setFulfilled, setError } from '../features/with-request-status.feature';
import { withLoading } from '../features/with-loading.feature';
import { ApiService } from '../../services/api.service';
import type { SubmitAnswerRequest, SubmitSponsorAnswerRequest } from '../../models/api.models';

// Root-scoped: a single session spans the game and sponsor pages, so both must share state.
export const GameStore = signalStore(
  { providedIn: 'root' },
  withState(initialGameSlice),
  withLoading(),
  withRequestStatus(),
  withComputed((store) => ({
    isGameOver: computed(() => {
      if (store.status() === 'completed') return true;
      const endsAt = store.endsAt();
      return endsAt ? new Date(endsAt) <= new Date() : false;
    }),
    hasMoreQuestions: computed(() => store.currentQuestion() !== null),
    // A sponsored bonus round is pending when the session carries a sponsor question
    // that hasn't been answered yet (spec §4).
    hasSponsorRound: computed(() => !!store.sponsorQuestion() && !store.sponsorAnswered()),
    multiplierLabel: computed(() => {
      const s = store.streak();
      if (s >= 6) return '2.5×';
      if (s >= 4) return '2×';
      if (s >= 2) return '1.5×';
      return '1×';
    }),
  })),
  withMethods((store) => {
    const api = inject(ApiService);

    const fetchNextBatch = rxMethod<void>((trigger$) =>
      trigger$.pipe(
        switchMap(() => {
          const sessionId = store.sessionId();
          if (!sessionId) return EMPTY;
          return api.fetchNextBatch(sessionId).pipe(
            tapResponse({
              next: (res) => patchState(store, setQuestionBuffer(res.buffer)),
              error: () => {}, // silent — game continues with whatever is in the buffer
            }),
          );
        }),
      ),
    );

    const startSession = rxMethod<void>((trigger$) =>
      trigger$.pipe(
        tap(() => {
          patchState(store, setPending());
          patchState(store, { isLoading: true });
        }),
        exhaustMap(() =>
          api.startSession().pipe(
            tapResponse({
              next: (res) => {
                patchState(store, setSessionStarted(res));
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

    const submitAnswer = rxMethod<SubmitAnswerRequest>((req$) =>
      req$.pipe(
        tap(() => patchState(store, setPending())),
        exhaustMap((req) => {
          const sessionId = store.sessionId();
          if (!sessionId) throw new Error('No active session');
          return api.submitAnswer(sessionId, req).pipe(
            tapResponse({
              next: (res) => {
                patchState(store, applyAnswerResult(res));
                patchState(store, setFulfilled());
                fetchNextBatch(undefined);
              },
              error: (err: unknown) => {
                const msg = (err as { error?: { message?: string } })?.error?.message ?? null;
                patchState(store, setError(msg ?? undefined));
              },
            }),
          );
        }),
      ),
    );

    const submitSponsorAnswer = rxMethod<SubmitSponsorAnswerRequest>((req$) =>
      req$.pipe(
        tap(() => patchState(store, setPending())),
        exhaustMap((req) => {
          const sessionId = store.sessionId();
          if (!sessionId) throw new Error('No active session');
          return api.submitSponsorAnswer(sessionId, req).pipe(
            tapResponse({
              next: (res) => {
                patchState(store, applySponsorResult(res));
                patchState(store, setFulfilled());
              },
              error: (err: unknown) => {
                const msg = (err as { error?: { message?: string } })?.error?.message ?? null;
                patchState(store, setError(msg ?? undefined));
              },
            }),
          );
        }),
      ),
    );

    const completeSession = rxMethod<void>((trigger$) =>
      trigger$.pipe(
        exhaustMap(() => {
          const sessionId = store.sessionId();
          if (!sessionId) throw new Error('No active session');
          return api.completeSession(sessionId).pipe(
            tapResponse({
              next: () => patchState(store, setGameCompleted()),
              error: () => patchState(store, setGameCompleted()),
            }),
          );
        }),
      ),
    );

    return {
      startSession,
      submitAnswer,
      submitSponsorAnswer,
      completeSession,
      setSponsorBonus: (bonus: number) => patchState(store, setSponsorBonus(bonus)),
      reset: () => patchState(store, resetGame()),
      fetchNextBatch,
    };
  }),
);
