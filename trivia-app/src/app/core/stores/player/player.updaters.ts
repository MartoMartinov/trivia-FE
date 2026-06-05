import type { PlayerSlice } from './player.slice';
import type { PlayerDto } from '../../models/api.models';

export const setPlayer = (profile: PlayerDto): Partial<PlayerSlice> => ({ profile });
export const clearPlayer = (): PlayerSlice => ({ profile: null });
