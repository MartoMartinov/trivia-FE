import type { QuestionDto, SponsorQuestionDto } from '../../models/api.models';

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
  /** The question currently being displayed. */
  currentQuestion: QuestionDto | null;
  /** One question per regular difficulty (easy, medium, hard) ready to serve next. */
  questionBuffer: QuestionDto[];
  /** Sponsor bonus questions shown at the end, in order. Empty array means no sponsor round. */
  sponsorQuestions: SponsorQuestionDto[];
  /** Index into sponsorQuestions — advances after each sponsor answer. */
  sponsorIndex: number;
  /** Total number of regular questions in this session (from server config). */
  totalQuestions: number;
  /** Flat points per correct sponsor question (admin-configurable). Drives the "+N PTS" badge. */
  sponsorPointsPerCorrect: number;
  /** Running count of questions answered this session. */
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
  currentQuestion: null,
  questionBuffer: [],
  sponsorQuestions: [],
  sponsorIndex: 0,
  totalQuestions: 0,
  sponsorPointsPerCorrect: 0,
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
