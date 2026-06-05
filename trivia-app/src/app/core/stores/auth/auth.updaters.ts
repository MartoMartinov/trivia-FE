import type { AuthSlice } from './auth.slice';
import type { LoginResponse } from '../../models/api.models';

export const setAuthFromLogin = (res: LoginResponse): AuthSlice => ({
  accessToken: res.accessToken,
  accessExpiresAt: res.accessExpiresAt,
  player: res.player,
});

export const setAccessToken = (accessToken: string, accessExpiresAt: string): Partial<AuthSlice> => ({
  accessToken,
  accessExpiresAt,
});

export const clearAuth = (): AuthSlice => ({
  accessToken: null,
  accessExpiresAt: null,
  player: null,
});
