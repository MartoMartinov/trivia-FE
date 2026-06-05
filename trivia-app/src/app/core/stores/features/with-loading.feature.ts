import { computed, signal } from '@angular/core';
import { signalStoreFeature, withComputed, withMethods, withState, patchState } from '@ngrx/signals';

export interface LoadingSlice {
  isLoading: boolean;
}

export function withLoading() {
  return signalStoreFeature(
    withState<LoadingSlice>({ isLoading: false }),
    withMethods((store) => ({
      presentLoading: () => patchState(store, { isLoading: true }),
      dismissLoading: () => patchState(store, { isLoading: false }),
    })),
  );
}
