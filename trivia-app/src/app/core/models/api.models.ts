// ── Shared ────────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'medium' | 'hard' | 'hard_plus';
export type RequestStatus = 'idle' | 'pending' | 'fulfilled' | 'error';

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface PlayerDto {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
}

export interface LoginResponse {
  accessToken: string;
  accessExpiresAt: string;
  player: PlayerDto;
  refreshToken?: string; // native only
}

export interface AccessTokenResponse {
  accessToken: string;
  accessExpiresAt: string;
}

export interface RegisterRequest {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
  consent: boolean;
}

// ── Game ──────────────────────────────────────────────────────────────────────

export interface ChoiceDto {
  index: number;
  text: string;
}

export interface QuestionDto {
  id: number;
  prompt: string;
  difficulty: Difficulty;
  choices: ChoiceDto[];
  // correctIndex is intentionally absent — returned only in SubmitAnswerResponse
}

export interface SponsorDto {
  id: number;
  name: string;
  logoUrl: string;
  primaryColor: string;
  mediaUrl: string | null;
  mediaType: 'image' | 'video' | null;
  websiteUrl: string | null;
}

export interface SponsorQuestionDto {
  id: number;
  prompt: string;
  choices: ChoiceDto[];
  bonusPoints: number;
  sponsor: SponsorDto;
}

export interface StartSessionResponse {
  sessionId: number;
  endsAt: string; // ISO
  questions: QuestionDto[];
  sponsorQuestion: SponsorQuestionDto | null;
}

export interface SubmitAnswerRequest {
  questionId: number;
  choiceIndex: number;
}

export interface SubmitAnswerResponse {
  correct: boolean;
  correctIndex: number;
  pointsEarned: number;
  score: number;
  streak: number;
  multiplier: number;
}

export interface CompleteSessionResponse {
  sessionId: number;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  bestStreak: number;
  rank: number;
  totalPlayers: number;
  sponsorBonus: number;
}

export interface SessionResultDto {
  sessionId: number;
  score: number;
  correctAnswers: number;
  totalAnswers: number;
  bestStreak: number;
  rank: number;
  totalPlayers: number;
  sponsorBonus: number;
  player: PlayerDto;
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export type LeaderboardScope = 'today' | 'week';

export interface LeaderboardRowDto {
  rank: number;
  displayName: string; // first name + last initial
  company: string;
  score: number;
  isCurrentPlayer?: boolean;
}

export interface LeaderboardResponse {
  scope: LeaderboardScope;
  rows: LeaderboardRowDto[];
  totalPlayers: number;
  resetsAt: string; // ISO
}

// ── Booth display ─────────────────────────────────────────────────────────────

export interface BoothDisplayResponse {
  rows: LeaderboardRowDto[];
  totalPlayers: number;
  eventName: string;
  resetsAt: string;
}
