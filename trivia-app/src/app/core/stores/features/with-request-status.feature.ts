import { computed } from '@angular/core';
import { signalStoreFeature, withComputed, withMethods, withState, patchState } from '@ngrx/signals';
import type { RequestStatus } from '../../models/api.models';

export interface RequestStatusSlice {
  requestStatus: RequestStatus;
  errorMessage: string | null;
}

const initialRequestStatusSlice: RequestStatusSlice = {
  requestStatus: 'idle',
  errorMessage: null,
};

export const setPending = (): RequestStatusSlice => ({
  requestStatus: 'pending',
  errorMessage: null,
});

export const setFulfilled = (): RequestStatusSlice => ({
  requestStatus: 'fulfilled',
  errorMessage: null,
});

export const setError = (message: string | null = null): RequestStatusSlice => ({
  requestStatus: 'error',
  errorMessage: message,
});

export const resetRequestStatus = (): RequestStatusSlice => initialRequestStatusSlice;

export function withRequestStatus() {
  return signalStoreFeature(
    withState(initialRequestStatusSlice),
    withComputed(({ requestStatus }) => ({
      isPending: computed(() => requestStatus() === 'pending'),
      isFulfilled: computed(() => requestStatus() === 'fulfilled'),
      hasError: computed(() => requestStatus() === 'error'),
      isIdle: computed(() => requestStatus() === 'idle'),
    })),
    withMethods((store) => ({
      setPending: () => patchState(store, setPending()),
      setFulfilled: () => patchState(store, setFulfilled()),
      setError: (message?: string) => patchState(store, setError(message ?? null)),
      resetRequestStatus: () => patchState(store, resetRequestStatus()),
    })),
  );
}
