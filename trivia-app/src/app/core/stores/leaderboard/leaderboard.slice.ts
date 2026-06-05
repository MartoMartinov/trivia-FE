import type { LeaderboardRowDto, LeaderboardScope } from '../../models/api.models';

export interface LeaderboardSlice {
  rows: LeaderboardRowDto[];
  totalPlayers: number;
  activeScope: LeaderboardScope;
  resetsAt: string | null;
}

export const initialLeaderboardSlice: LeaderboardSlice = {
  rows: [],
  totalPlayers: 0,
  activeScope: 'today',
  resetsAt: null,
};
