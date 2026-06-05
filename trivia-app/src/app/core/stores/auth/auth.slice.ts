import type { PlayerDto } from '../../models/api.models';

export interface AuthSlice {
  accessToken: string | null;
  accessExpiresAt: string | null;
  player: PlayerDto | null;
}

export const initialAuthSlice: AuthSlice = {
  accessToken: null,
  accessExpiresAt: null,
  player: null,
};
