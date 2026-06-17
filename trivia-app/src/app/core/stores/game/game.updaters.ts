import type { GameSlice, LastResult } from './game.slice';
import type {
  QuestionDto,
  StartSessionResponse,
  SubmitAnswerResponse,
  SubmitSponsorAnswerResponse,
} from '../../models/api.models';
import type { PartialStateUpdater } from '@ngrx/signals';

// ── Difficulty selection ───────────────────────────────────────────────────────

type RegularDifficulty = 'easy' | 'medium' | 'hard';

function selectNextDifficulty(correct: boolean, streak: number): RegularDifficulty {
  if (!correct) return 'easy';
  if (streak >= 4) return 'hard';
  if (streak >= 2) return 'medium';
  return 'easy';
}

function pickFromBuffer(buffer: QuestionDto[], difficulty: RegularDifficulty): QuestionDto | null {
  return (
    buffer.find((q) => q.difficulty === difficulty) ??
    buffer[0] ??
    null
  );
}

// ── Updaters ──────────────────────────────────────────────────────────────────

export const setSessionStarted = (res: StartSessionResponse): Partial<GameSlice> => ({
  sessionId: res.sessionId,
  endsAt: res.endsAt,
  durationSeconds: res.durationSeconds,
  countdownSeconds: res.countdownSeconds,
  currentQuestion: res.currentQuestion,
  questionBuffer: res.buffer,
  sponsorQuestion: res.sponsorQuestion,
  sponsorAnswered: false,
  currentIndex: 0,
  score: 0,
  streak: 0,
  bestStreak: 0,
  correctAnswers: 0,
  totalAnswers: 0,
  status: 'active',
  lastResult: null,
  lastSponsorResult: null,
  sponsorBonus: 0,
});

export const applyAnswerResult = (res: SubmitAnswerResponse): PartialStateUpdater<GameSlice> =>
  (state) => {
    const difficulty = selectNextDifficulty(res.correct, res.streak);
    const nextQuestion = pickFromBuffer(state.questionBuffer, difficulty);

    return {
      score: res.score,
      streak: res.streak,
      bestStreak: Math.max(state.bestStreak, res.streak),
      correctAnswers: state.correctAnswers + (res.correct ? 1 : 0),
      totalAnswers: state.totalAnswers + 1,
      currentIndex: state.currentIndex + 1,
      currentQuestion: nextQuestion,
      questionBuffer: [], // cleared; refilled by background fetchNextBatch
      lastResult: {
        correct: res.correct,
        correctIndex: res.correctIndex,
        pointsEarned: res.pointsEarned,
        multiplier: res.multiplier,
      },
    };
  };

export const setQuestionBuffer = (buffer: QuestionDto[]): Partial<GameSlice> => ({
  questionBuffer: buffer,
});

export const setSponsorBonus = (bonus: number): Partial<GameSlice> => ({
  sponsorBonus: bonus,
});

export const applySponsorResult = (res: SubmitSponsorAnswerResponse): Partial<GameSlice> => ({
  score: res.score,
  sponsorBonus: res.bonusPoints,
  sponsorAnswered: true,
  lastSponsorResult: {
    correct: res.correct,
    correctIndex: res.correctIndex,
    bonusPoints: res.bonusPoints,
  },
});

export const setGameCompleted = (): Partial<GameSlice> => ({
  status: 'completed',
});

export const resetGame = (): GameSlice => ({
  sessionId: null,
  endsAt: null,
  durationSeconds: 0,
  countdownSeconds: 0,
  currentQuestion: null,
  questionBuffer: [],
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
});
