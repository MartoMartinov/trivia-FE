import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';

import { initialPlayerSlice } from './player.slice';
import { setPlayer, clearPlayer } from './player.updaters';
import type { PlayerDto } from '../../models/api.models';

export const PlayerStore = signalStore(
  { providedIn: 'root' },
  withState(initialPlayerSlice),
  withComputed((store) => ({
    displayName: computed(() => {
      const p = store.profile();
      return p ? `${p.firstName} ${p.lastName}` : '';
    }),
    initials: computed(() => {
      const p = store.profile();
      if (!p) return '';
      return ((p.firstName[0] ?? '') + (p.lastName[0] ?? '')).toUpperCase();
    }),
  })),
  withMethods((store) => ({
    setPlayer: (profile: PlayerDto) => patchState(store, setPlayer(profile)),
    clearPlayer: () => patchState(store, clearPlayer()),
  })),
);
