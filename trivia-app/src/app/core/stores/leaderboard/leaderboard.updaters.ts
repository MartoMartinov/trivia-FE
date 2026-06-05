import type { LeaderboardSlice } from './leaderboard.slice';
import type { LeaderboardResponse, LeaderboardScope } from '../../models/api.models';

export const setLeaderboard = (res: LeaderboardResponse): Partial<LeaderboardSlice> => ({
  rows: res.rows,
  totalPlayers: res.totalPlayers,
  resetsAt: res.resetsAt,
});

export const setActiveScope = (scope: LeaderboardScope): Partial<LeaderboardSlice> => ({
  activeScope: scope,
});
