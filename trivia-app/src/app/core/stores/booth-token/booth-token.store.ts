import { signalStore, withState, withMethods, withHooks, patchState } from '@ngrx/signals';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import { initialBoothTokenSlice } from './booth-token.slice';
import { STORAGE_KEYS } from '../../constants/storage-keys';

export const BoothTokenStore = signalStore(
  { providedIn: 'root' },
  withState(initialBoothTokenSlice),
  withMethods((store) => ({
    /** Loads the persisted kiosk token into memory, if any. Safe to call more than once. */
    async restore(): Promise<void> {
      try {
        const stored = await SecureStorage.get(STORAGE_KEYS.BOOTH_TOKEN);
        if (typeof stored === 'string') patchState(store, { boothToken: stored });
      } catch {}
    },
    set(token: string): void {
      patchState(store, { boothToken: token });
      SecureStorage.set(STORAGE_KEYS.BOOTH_TOKEN, token).catch(() => {});
    },
    clear(): void {
      patchState(store, { boothToken: null });
      SecureStorage.remove(STORAGE_KEYS.BOOTH_TOKEN).catch(() => {});
    },
  })),
  withHooks({
    onInit(store) {
      store.restore();
    },
  }),
);
