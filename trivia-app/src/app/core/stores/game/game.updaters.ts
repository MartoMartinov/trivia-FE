import type { GameSlice, LastResult } from './game.slice';
import type {
  QuestionDto,
  StartSessionResponse,
  SubmitAnswerResponse,
  SubmitSponsorAnswerResponse,
} from '../../models/api.models';
import type { PartialStateUpdater } from '@ngrx/signals';

// ── Difficulty selection ───────────────────────────────────────────────────────

type RegularDifficulty = 'easy' | 'medium' | 'hard' | 'hard_plus';

// The score multiplier always corresponds to the difficulty actually being played,
// never to streak directly — so a ladder fallback (see pickFromBuffer) that serves a
// lower tier automatically carries a matching lower multiplier.
export const MULTIPLIER_BY_DIFFICULTY: Record<RegularDifficulty, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  hard_plus: 2.5,
};

function selectNextDifficulty(correct: boolean, streak: number): RegularDifficulty {
  if (!correct) return 'easy';
  if (streak >= 6) return 'hard_plus';
  if (streak >= 4) return 'hard';
  if (streak >= 2) return 'medium';
  return 'easy';
}

// Highest to lowest — used to step down to the next best difficulty when the
// requested tier isn't in the buffer (e.g. hard_plus is admin-configurable and
// may not always be provided), instead of falling back to an arbitrary buffer[0].
const DIFFICULTY_LADDER: RegularDifficulty[] = ['hard_plus', 'hard', 'medium', 'easy'];

function pickFromBuffer(buffer: QuestionDto[], difficulty: RegularDifficulty): QuestionDto | null {
  const startIndex = DIFFICULTY_LADDER.indexOf(difficulty);
  for (let i = startIndex; i < DIFFICULTY_LADDER.length; i++) {
    const match = buffer.find((q) => q.difficulty === DIFFICULTY_LADDER[i]);
    if (match) return match;
  }
  return buffer[0] ?? null;
}

// ── Updaters ──────────────────────────────────────────────────────────────────

export const setSessionStarted = (res: StartSessionResponse): Partial<GameSlice> => ({
  sessionId: res.sessionId,
  endsAt: res.endsAt,
  durationSeconds: res.durationSeconds,
  countdownSeconds: res.countdownSeconds,
  totalQuestions: res.totalQuestions,
  sponsorPointsPerCorrect: res.sponsorPointsPerCorrect,
  currentQuestion: res.currentQuestion,
  questionBuffer: res.buffer,
  sponsorQuestions: res.sponsorQuestions,
  sponsorIndex: 0,
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
    const newIndex = state.currentIndex + 1;
    const difficulty = selectNextDifficulty(res.correct, res.streak);
    const nextQuestion = newIndex < state.totalQuestions
      ? pickFromBuffer(state.questionBuffer, difficulty)
      : null;

    return {
      score: res.score,
      streak: res.streak,
      bestStreak: Math.max(state.bestStreak, res.streak),
      correctAnswers: state.correctAnswers + (res.correct ? 1 : 0),
      totalAnswers: state.totalAnswers + 1,
      currentIndex: newIndex,
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

export const applySponsorResult = (res: SubmitSponsorAnswerResponse): PartialStateUpdater<GameSlice> =>
  (state) => ({
    score: res.score,
    sponsorBonus: state.sponsorBonus + res.bonusPoints,
    sponsorIndex: state.sponsorIndex + 1,
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
  totalQuestions: 0,
  sponsorPointsPerCorrect: 0,
  currentQuestion: null,
  questionBuffer: [],
  sponsorQuestions: [],
  sponsorIndex: 0,
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
