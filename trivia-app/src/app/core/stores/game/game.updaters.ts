import type { GameSlice, LastResult } from './game.slice';
import type { StartSessionResponse, SubmitAnswerResponse } from '../../models/api.models';
import type { PartialStateUpdater } from '@ngrx/signals';

export const setSessionStarted = (res: StartSessionResponse): Partial<GameSlice> => ({
  sessionId: res.sessionId,
  endsAt: res.endsAt,
  questions: res.questions,
  sponsorQuestion: res.sponsorQuestion,
  currentIndex: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  status: 'active',
  lastResult: null,
  sponsorBonus: 0,
});

export const applyAnswerResult = (res: SubmitAnswerResponse): PartialStateUpdater<GameSlice> =>
  (state) => ({
    score: res.score,
    streak: res.streak,
    bestStreak: Math.max(state.bestStreak, res.streak),
    correctAnswers: state.correctAnswers + (res.correct ? 1 : 0),
    totalAnswers: state.totalAnswers + 1,
    currentIndex: state.currentIndex + 1,
    lastResult: {
      correct: res.correct,
      correctIndex: res.correctIndex,
      pointsEarned: res.pointsEarned,
      multiplier: res.multiplier,
    },
  });

export const setSponsorBonus = (bonus: number): Partial<GameSlice> => ({
  sponsorBonus: bonus,
});

export const setGameCompleted = (): Partial<GameSlice> => ({
  status: 'completed',
});

export const resetGame = (): GameSlice => ({
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
});
