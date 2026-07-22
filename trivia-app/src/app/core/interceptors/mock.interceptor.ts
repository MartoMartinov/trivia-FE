import {
  HttpInterceptorFn,
  HttpRequest,
  HttpHandlerFn,
  HttpResponse,
} from '@angular/common/http';
import { of, delay } from 'rxjs';
import { environment } from '../../../environments/environment';

const MOCK_PLAYER = {
  id: 1,
  firstName: 'Jake',
  lastName: 'Thompson',
  email: 'jake@example.com',
  company: 'Precision Parts Co.',
  phone: '+1 555 0100',
};

const MOCK_QUESTIONS = [
  {
    id: 1,
    prompt:
      'What type of cutting tool is best suited for high-speed machining of aluminum?',
    difficulty: 'medium',
    choices: [
      { index: 0, text: 'Carbide end mill' },
      { index: 1, text: 'High-speed steel drill bit' },
      { index: 2, text: 'Diamond-coated insert' },
      { index: 3, text: 'Ceramic turning tool' },
    ],
  },
  {
    id: 2,
    prompt:
      'Which measurement tool offers the highest precision for inside diameters?',
    difficulty: 'easy',
    choices: [
      { index: 0, text: 'Tape measure' },
      { index: 1, text: 'Bore gauge' },
      { index: 2, text: 'Caliper' },
      { index: 3, text: 'Ruler' },
    ],
  },
  {
    id: 3,
    prompt: 'In CNC machining, what does the "G00" command represent?',
    difficulty: 'hard',
    imageUrl:
      'https://placehold.co/800x420/0E1524/F34D23?text=CNC+Control+Panel',
    choices: [
      { index: 0, text: 'Dwell' },
      { index: 1, text: 'Rapid positioning' },
      { index: 2, text: 'Linear feed' },
      { index: 3, text: 'Spindle stop' },
    ],
  },
  {
    id: 4,
    prompt: 'Which coolant type is preferred for grinding hardened steel?',
    difficulty: 'medium',
    choices: [
      { index: 0, text: 'Straight oil' },
      { index: 1, text: 'Water-soluble emulsion' },
      { index: 2, text: 'Compressed air' },
      { index: 3, text: 'No coolant' },
    ],
  },
  {
    id: 5,
    prompt: 'What is the primary purpose of a chamfer on a machined part?',
    difficulty: 'hard',
    choices: [
      { index: 0, text: 'Increase weight' },
      { index: 1, text: 'Ease assembly & remove burrs' },
      { index: 2, text: 'Add color' },
      { index: 3, text: 'Reduce strength' },
    ],
  },
  {
    id: 6,
    prompt: 'Which material is hardest on the Mohs scale?',
    difficulty: 'easy',
    choices: [
      { index: 0, text: 'Tungsten carbide' },
      { index: 1, text: 'Diamond' },
      { index: 2, text: 'Hardened steel' },
      { index: 3, text: 'Titanium' },
    ],
  },
  {
    id: 7,
    prompt: 'Built-up edge (BUE) in turning is most likely to form when machining at:',
    difficulty: 'hard_plus',
    choices: [
      { index: 0, text: 'Very high speeds with carbide tools' },
      { index: 1, text: 'Low cutting speeds and moderate temperatures' },
      { index: 2, text: 'High feed rates with ceramic inserts' },
      { index: 3, text: 'Any speed with coated tools' },
    ],
  },
];

const CORRECT_ANSWERS: Record<number, number> = {
  1: 0,
  2: 1,
  3: 1,
  4: 1,
  5: 1,
  6: 1,
  7: 1,
};

// Base points per difficulty (spec §5.1), mirrored from ScoringService.
const BASE_POINTS_BY_DIFFICULTY: Record<string, number> = {
  easy: 100,
  medium: 150,
  hard: 200,
  hard_plus: 250,
};
// Multiplier corresponds to the difficulty actually answered, not raw streak,
// mirrored from ScoringService.MULTIPLIER_BY_DIFFICULTY.
const MULTIPLIER_BY_DIFFICULTY: Record<string, number> = {
  easy: 1,
  medium: 1.5,
  hard: 2,
  hard_plus: 2.5,
};
const DIFFICULTY_BY_QUESTION_ID: Record<number, string> = MOCK_QUESTIONS.reduce<
  Record<number, string>
>((map, q) => {
  map[q.id] = q.difficulty;
  return map;
}, {});

const SESSION_DURATION_SECONDS = 90;
const SESSION_COUNTDOWN_SECONDS = 3;
// Flat points per correct sponsor question (admin-configurable, spec §5.3) — replaces
// the difficulty multiplier for the sponsor round. Every correct sponsor answer is worth this.
const SPONSOR_POINTS_PER_CORRECT = 300;

const MOCK_SPONSOR_QUESTION = {
  id: 1,
  prompt:
    'Which Sandvik Coromant product is rated #1 for precision milling applications?',
  choices: [
    { index: 0, text: 'ProMill X200' },
    { index: 1, text: 'UltraCut 500 Series' },
    { index: 2, text: 'MaxTurn Pro Elite' },
    { index: 3, text: 'PrecisionEdge Z1' },
  ],
  timerSeconds: 30,
  sponsor: {
    id: 1,
    name: 'Sandvik Coromant',
    logoUrl: '',
    primaryColor: '#DE0016',
    textColor: '#ffffff',
    imageUrl: 'https://placehold.co/800x450/0E1524/decf00?text=Sandvik+Coromant',
    videoUrl: null,
    posterUrl: null,
    websiteUrl: 'https://www.sandvik.coromant.com',
  },
};

const MOCK_SPONSOR_QUESTION_2 = {
  id: 2,
  prompt: 'What does Haas Automation primarily manufacture?',
  choices: [
    { index: 0, text: 'Aerospace composites' },
    { index: 1, text: 'Precision grinding fluids' },
    { index: 2, text: 'CNC machine tools for the shop floor' },
    { index: 3, text: 'Metrology instruments' },
  ],
  timerSeconds: 30,
  sponsor: {
    id: 2,
    name: 'Haas Automation',
    logoUrl: '',
    primaryColor: '#C8102E',
    textColor: '#ffffff',
    imageUrl: null,
    videoUrl: '/video_demo.mp4',
    posterUrl: '/video_demo.png',
    websiteUrl: 'https://www.haascnc.com',
  },
};

const MOCK_SPONSOR_QUESTIONS = [MOCK_SPONSOR_QUESTION, MOCK_SPONSOR_QUESTION_2];

// Correct answer index per sponsor question id
const SPONSOR_CORRECT_ANSWERS: Record<number, number> = { 1: 1, 2: 2 };

const MOCK_SPONSOR_CARDS = [
  {
    id: 1,
    name: 'Sandvik Coromant',
    tagline: 'Precision milling, perfected.',
    primaryColor: '#DE0016',
    logoUrl: '',
  },
  {
    id: 2,
    name: 'Haas Automation',
    tagline: 'Built for the shop floor.',
    primaryColor: '#C8102E',
    logoUrl: '',
  },
];

const MOCK_LEADERBOARD_ROWS = [
  { rank: 1, displayName: 'Maria S.', company: 'Acme Machining', score: 1820 },
  {
    rank: 2,
    displayName: 'Jake T.',
    company: 'Precision Parts Co.',
    score: 1450,
  },
  { rank: 3, displayName: 'Sam R.', company: 'MetalWorks LLC', score: 1320 },
  { rank: 4, displayName: 'Ling K.', company: 'FastCut Inc.', score: 1180 },
  { rank: 5, displayName: 'Dave H.', company: 'ProMill Ltd.', score: 980 },
  { rank: 6, displayName: 'Chris M.', company: 'Delta Tools', score: 920 },
  { rank: 7, displayName: 'Dana K.', company: 'CNC Direct', score: 880 },
  { rank: 8, displayName: 'Pat L.', company: 'Apex Metalwork', score: 800 },
  { rank: 9, displayName: 'Mo S.', company: 'TopGrind Co.', score: 740 },
  { rank: 10, displayName: 'Alex P.', company: 'Ironclad Mfg', score: 720 },
];

const MOCK_CURRENT_PLAYER_ROW = {
  rank: 12,
  displayName: 'You T.',
  company: 'Precision Parts Co.',
  score: 650,
  isCurrentPlayer: true,
};

let mockScore = 0;
let mockStreak = 0;
let mockMaxStreak = 0;
let mockSponsorBonus = 0;
let mockSessionId = 1001;
let mockTotalQuestions = 5;

function matchesRoute(
  url: string,
  method: string,
  pattern: string,
  patternMethod: string,
): boolean {
  if (method !== patternMethod) return false;
  const base = environment.apiUrl;
  const path = url.replace(base, '');
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
  return regex.test(path);
}


export const mockInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
) => {
  const url = req.url;
  const method = req.method;

  if (!url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const respond = (body: unknown) =>
    of(new HttpResponse({ status: 200, body })).pipe(delay(300));

  // GET /register/verify-token — mock: token value 'expired' simulates an expired/invalid QR token
  if (matchesRoute(url, method, '/register/verify-token', 'GET')) {
    const token = req.params.get('token');
    return respond({ valid: token !== 'expired' });
  }

  // POST /auth/register
  if (matchesRoute(url, method, '/auth/register', 'POST')) {
    mockScore = 0;
    mockStreak = 0;
    mockMaxStreak = 0;
    mockSponsorBonus = 0;
    return respond({
      accessToken: 'mock-access-token',
      accessExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      player: MOCK_PLAYER,
    });
  }

  // POST /auth/refresh
  if (matchesRoute(url, method, '/auth/refresh', 'POST')) {
    return respond({
      accessToken: 'mock-access-token',
      accessExpiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    });
  }

  // POST /auth/logout
  if (matchesRoute(url, method, '/auth/logout', 'POST')) {
    return respond({ message: 'Logged out' });
  }

  // POST /sessions/start
  if (matchesRoute(url, method, '/sessions/start', 'POST')) {
    mockScore = 0;
    mockStreak = 0;
    mockMaxStreak = 0;
    mockSponsorBonus = 0;
    mockSessionId++;
    mockTotalQuestions = Math.floor(Math.random() * 4) + 3; // 3-6
    const currentQuestion = MOCK_QUESTIONS[0];
    const buffer = [
      MOCK_QUESTIONS.find((q) => q.difficulty === 'easy')!,
      MOCK_QUESTIONS.find((q) => q.difficulty === 'medium' && q.id !== currentQuestion.id)!,
      MOCK_QUESTIONS.find((q) => q.difficulty === 'hard')!,
      MOCK_QUESTIONS.find((q) => q.difficulty === 'hard_plus')!,
    ].filter(Boolean);
    return respond({
      sessionId: mockSessionId,
      endsAt: new Date(
        Date.now() + SESSION_DURATION_SECONDS * 1000,
      ).toISOString(),
      durationSeconds: SESSION_DURATION_SECONDS,
      countdownSeconds: SESSION_COUNTDOWN_SECONDS,
      totalQuestions: mockTotalQuestions,
      sponsorPointsPerCorrect: SPONSOR_POINTS_PER_CORRECT,
      currentQuestion,
      buffer,
      sponsorQuestions: MOCK_SPONSOR_QUESTIONS,
    });
  }

  // GET /sessions/:id/questions/next
  if (matchesRoute(url, method, '/sessions/:id/questions/next', 'GET')) {
    const buffer = [
      MOCK_QUESTIONS.find((q) => q.difficulty === 'easy')!,
      MOCK_QUESTIONS.find((q) => q.difficulty === 'medium')!,
      MOCK_QUESTIONS.find((q) => q.difficulty === 'hard')!,
      MOCK_QUESTIONS.find((q) => q.difficulty === 'hard_plus')!,
    ].filter(Boolean);
    return respond({ buffer });
  }

  // POST /sessions/:id/answers
  if (matchesRoute(url, method, '/sessions/:id/answers', 'POST')) {
    const body = req.body as { questionId: number; choiceIndex: number };
    const correct = CORRECT_ANSWERS[body.questionId] === body.choiceIndex;
    if (correct) {
      mockStreak++;
      mockMaxStreak = Math.max(mockMaxStreak, mockStreak);
    } else {
      mockStreak = 0;
    }
    const answeredDifficulty = DIFFICULTY_BY_QUESTION_ID[body.questionId] ?? 'easy';
    const multiplier = MULTIPLIER_BY_DIFFICULTY[answeredDifficulty] ?? 1;
    const basePoints = BASE_POINTS_BY_DIFFICULTY[answeredDifficulty] ?? 100;
    const points = correct ? Math.round(basePoints * multiplier) : 0;
    mockScore += points;
    return respond({
      correct,
      correctIndex: CORRECT_ANSWERS[body.questionId],
      pointsEarned: points,
      score: mockScore,
      streak: mockStreak,
      multiplier,
    });
  }

  // POST /sessions/:id/sponsor-answer
  if (matchesRoute(url, method, '/sessions/:id/sponsor-answer', 'POST')) {
    const body = req.body as { questionId: number; choiceIndex: number };
    const correctIndex = SPONSOR_CORRECT_ANSWERS[body.questionId] ?? 0;
    const correct = correctIndex === body.choiceIndex;
    // Sponsor scoring uses a flat, admin-configurable value (spec §5.3) — independent of streak.
    const bonusPoints = correct ? SPONSOR_POINTS_PER_CORRECT : 0;
    mockSponsorBonus += bonusPoints;
    mockScore += bonusPoints;
    return respond({
      correct,
      correctIndex,
      bonusPoints,
      score: mockScore,
    });
  }

  // POST /sessions/:id/sponsor-track
  if (matchesRoute(url, method, '/sessions/:id/sponsor-track', 'POST')) {
    return respond({ ok: true });
  }

  // POST /sessions/:id/complete
  if (matchesRoute(url, method, '/sessions/:id/complete', 'POST')) {
    return respond({
      sessionId: mockSessionId,
      score: mockScore,
      correctAnswers: 4,
      totalAnswers: 6,
      bestStreak: mockMaxStreak,
      rank: 3,
      totalPlayers: 11,
      sponsorBonus: mockSponsorBonus,
    });
  }

  // GET /sessions/:id/result
  if (matchesRoute(url, method, '/sessions/:id/result', 'GET')) {
    return respond({
      sessionId: mockSessionId,
      score: mockScore,
      correctAnswers: 4,
      totalAnswers: 6,
      bestStreak: mockMaxStreak,
      rank: 3,
      totalPlayers: 11,
      sponsorBonus: mockSponsorBonus,
      player: MOCK_PLAYER,
    });
  }

  // GET /leaderboard
  if (matchesRoute(url, method, '/leaderboard', 'GET')) {
    return respond({
      scope: 'today',
      rows: [...MOCK_LEADERBOARD_ROWS, MOCK_CURRENT_PLAYER_ROW],
      totalPlayers: 47,
      resetsAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
  }

  // GET /event-config
  if (matchesRoute(url, method, '/event-config', 'GET')) {
    return respond({
      eventLogoUrl: '/public/event-logo.png',
      // HTML strings — rendered via [innerHTML] on the register page (Angular-sanitized).
      landingHeadline: "Think you're the smartest machinist at IMTS? <span style=\"color: #F34D23\">Prove it.</span>",
      // Body rendered server-side with the admin session length (90s) and prize count (Top 3).
      landingBody:
        "You've got <strong>90 seconds</strong> to answer as many questions as you can. Climb the leaderboard, earn bragging rights, and finish in today's <strong>Top 3</strong> to win prizes.<br>One shot per day. Make it count.",
    });
  }

  // GET /booth-display/:id
  if (matchesRoute(url, method, '/booth-display/:id', 'GET')) {
    const top = MOCK_LEADERBOARD_ROWS.slice(0, 10);
    const avgScore = Math.round(
      top.reduce((sum, r) => sum + r.score, 0) / top.length,
    );
    return respond({
      rows: top,
      totalPlayers: 11,
      eventName: 'IMTS 2026',
      resetsAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      avgScore,
      hotStreak: {
        displayName: 'Maria S.',
        company: 'Acme Machining',
        streak: 6,
      },
      sponsorCards: MOCK_SPONSOR_CARDS,
    });
  }

  return next(req);
};
