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

/** Result of verifying the rotating QR registration token (spec F9 — signed, expiring booth QR). */
export interface VerifyRegistrationTokenResponse {
  valid: boolean;
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
  /** Optional question image (spec §9.5). Null/absent for text-only questions. */
  imageUrl?: string | null;
  // correctIndex is intentionally absent — returned only in SubmitAnswerResponse
}

export interface SponsorDto {
  id: number;
  name: string;
  logoUrl: string;
  primaryColor: string;
  textColor: string;
  websiteUrl: string | null;
  /** Optional question image (spec §9.5). Null/absent for text-only questions. */
  imageUrl: string | null;
  /** Promo video to watch before the question unlocks. Null when no video is attached. */
  videoUrl: string | null;
  /** Poster image shown before the video plays. Null falls back to the dark gradient. */
  posterUrl: string | null;
  /** Seconds the player has to answer after the video ends before auto-advancing. */
}

export interface SponsorQuestionDto {
  id: number;
  prompt: string;
  choices: ChoiceDto[];
  bonusPoints: number;
  timerSeconds: number;
  sponsor: SponsorDto;
}

export interface StartSessionResponse {
  sessionId: number;
  endsAt: string; // ISO
  /** Total session length in seconds (spec §9.3, admin-configurable). Drives the timer denominator. */
  durationSeconds: number;
  /** Pre-game "get ready" countdown in seconds (spec §3.4). 0 disables it. */
  countdownSeconds: number;
  /** Total number of regular questions for this session (admin-configurable). */
  totalQuestions: number;
  /** The first question to display immediately. */
  currentQuestion: QuestionDto;
  /** One question per difficulty (easy, medium, hard) — ready to serve as the next question. */
  buffer: QuestionDto[];
  /** Sponsor bonus questions shown at the end, in order. Empty array means no sponsor round. */
  sponsorQuestions: SponsorQuestionDto[];
}

export interface NextBatchResponse {
  /** One question per difficulty (easy, medium, hard) for the upcoming turn. */
  buffer: QuestionDto[];
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

export interface SubmitSponsorAnswerRequest {
  questionId: number;
  choiceIndex: number;
}

export interface SponsorTrackRequest {
  questionId: number;
  event: 'website_click';
}

export interface SubmitSponsorAnswerResponse {
  correct: boolean;
  correctIndex: number;
  /** Bonus points awarded for the sponsored question (0 when incorrect). */
  bonusPoints: number;
  /** Authoritative running session score after the sponsor bonus is applied. */
  score: number;
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

// ── Event config ─────────────────────────────────────────────────────────────

export interface EventConfigResponse {
  eventLogoUrl: string | null;
  /** Combined app + event logo for the booth/TV display. */
  tvLogoUrl: string | null;
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

// ── Static pages ─────────────────────────────────────────────────────────────

export interface StaticPageResponse {
  id: number;
  title: string;
  /** Trusted HTML content from the admin panel. */
  content: string;
}

// ── Booth display ─────────────────────────────────────────────────────────────

/** The player currently on the hottest correct-answer streak (spec §8.2 hot-streak panel). */
export interface HotStreakDto {
  displayName: string;
  company: string;
  streak: number;
}

/** A sponsor card shown on the booth screen (spec §8.2 sponsor cards). */
export interface SponsorCardDto {
  id: number;
  name: string;
  tagline: string;
  primaryColor: string;
  logoUrl: string;
}

export interface BoothDisplayResponse {
  rows: LeaderboardRowDto[];
  totalPlayers: number;
  eventName: string;
  resetsAt: string;
  /** Average score across today's players (spec §8.2). */
  avgScore: number;
  /** Current hottest streak, or null when nobody has a streak yet. */
  hotStreak: HotStreakDto | null;
  /** Active sponsor cards to rotate/display on the booth screen. */
  sponsorCards: SponsorCardDto[];
  /** Event/sponsor logo URL for the booth header, provided by the backend. */
  eventLogoUrl?: string | null;
}
