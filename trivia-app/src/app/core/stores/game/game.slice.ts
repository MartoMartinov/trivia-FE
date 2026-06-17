import type { QuestionDto, SponsorQuestionDto, SubmitAnswerResponse } from '../../models/api.models';

export type GameStatus = 'idle' | 'active' | 'completed';

export interface LastResult {
  correct: boolean;
  correctIndex: number;
  pointsEarned: number;
  multiplier: number;
}

export interface LastSponsorResult {
  correct: boolean;
  correctIndex: number;
  bonusPoints: number;
}

export interface GameSlice {
  sessionId: number | null;
  endsAt: string | null;
  /** Total session length in seconds — drives the timer denominator (spec §9.3). */
  durationSeconds: number;
  /** Pre-game countdown in seconds (spec §3.4). */
  countdownSeconds: number;
  questions: QuestionDto[];
  sponsorQuestion: SponsorQuestionDto | null;
  /** Whether the sponsored bonus question has already been answered this session. */
  sponsorAnswered: boolean;
  currentIndex: number;
  score: number;
  streak: number;
  bestStreak: number;
  correctAnswers: number;
  totalAnswers: number;
  status: GameStatus;
  lastResult: LastResult | null;
  lastSponsorResult: LastSponsorResult | null;
  sponsorBonus: number;
}

export const initialGameSlice: GameSlice = {
  sessionId: null,
  endsAt: null,
  durationSeconds: 0,
  countdownSeconds: 0,
  questions: [],
  sponsorQuestion: null,
  sponsorAnswered: false,
  currentIndex: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  status: 'idle',
  lastResult: null,
  lastSponsorResult: null,
  sponsorBonus: 0,
};
