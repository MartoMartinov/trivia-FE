import type { QuestionDto, SponsorQuestionDto, SubmitAnswerResponse } from '../../models/api.models';

export type GameStatus = 'idle' | 'active' | 'completed';

export interface LastResult {
  correct: boolean;
  correctIndex: number;
  pointsEarned: number;
  multiplier: number;
}

export interface GameSlice {
  sessionId: number | null;
  endsAt: string | null;
  questions: QuestionDto[];
  sponsorQuestion: SponsorQuestionDto | null;
  currentIndex: number;
  score: number;
  streak: number;
  bestStreak: number;
  correctAnswers: number;
  totalAnswers: number;
  status: GameStatus;
  lastResult: LastResult | null;
  sponsorBonus: number;
}

export const initialGameSlice: GameSlice = {
  sessionId: null,
  endsAt: null,
  questions: [],
  sponsorQuestion: null,
  currentIndex: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  status: 'idle',
  lastResult: null,
  sponsorBonus: 0,
};
