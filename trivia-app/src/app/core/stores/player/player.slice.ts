import type { PlayerDto } from '../../models/api.models';

export interface PlayerSlice {
  profile: PlayerDto | null;
}

export const initialPlayerSlice: PlayerSlice = {
  profile: null,
};
