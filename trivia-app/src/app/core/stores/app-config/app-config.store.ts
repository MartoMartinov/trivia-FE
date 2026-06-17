import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { tapResponse } from '@ngrx/operators';
import { switchMap } from 'rxjs';

import { initialAppConfigSlice } from './app-config.slice';
import { ApiService } from '../../services/api.service';

export const AppConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialAppConfigSlice),
  withMethods((store) => {
    const api = inject(ApiService);

    const load = rxMethod<void>((trigger$) =>
      trigger$.pipe(
        switchMap(() =>
          api.getEventConfig().pipe(
            tapResponse({
              next: (res) => patchState(store, { eventLogoUrl: res.eventLogoUrl }),
              error: () => {}, // non-critical — header just won't show the logo
            }),
          ),
        ),
      ),
    );

    return { load };
  }),
  withHooks({
    onInit(store) {
      store.load(undefined);
    },
  }),
);
