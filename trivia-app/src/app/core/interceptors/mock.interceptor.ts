import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpResponse } from '@angular/common/http';
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
    id: 1, prompt: 'What type of cutting tool is best suited for high-speed machining of aluminum?',
    difficulty: 'medium',
    choices: [
      { index: 0, text: 'Carbide end mill' },
      { index: 1, text: 'High-speed steel drill bit' },
      { index: 2, text: 'Diamond-coated insert' },
      { index: 3, text: 'Ceramic turning tool' },
    ],
  },
  {
    id: 2, prompt: 'Which measurement tool offers the highest precision for inside diameters?',
    difficulty: 'easy',
    choices: [
      { index: 0, text: 'Tape measure' },
      { index: 1, text: 'Bore gauge' },
      { index: 2, text: 'Caliper' },
      { index: 3, text: 'Ruler' },
    ],
  },
  {
    id: 3, prompt: 'In CNC machining, what does the "G00" command represent?',
    difficulty: 'hard',
    choices: [
      { index: 0, text: 'Dwell' },
      { index: 1, text: 'Rapid positioning' },
      { index: 2, text: 'Linear feed' },
      { index: 3, text: 'Spindle stop' },
    ],
  },
  {
    id: 4, prompt: 'Which coolant type is preferred for grinding hardened steel?',
    difficulty: 'medium',
    choices: [
      { index: 0, text: 'Straight oil' },
      { index: 1, text: 'Water-soluble emulsion' },
      { index: 2, text: 'Compressed air' },
      { index: 3, text: 'No coolant' },
    ],
  },
  {
    id: 5, prompt: 'What is the primary purpose of a chamfer on a machined part?',
    difficulty: 'hard_plus',
    choices: [
      { index: 0, text: 'Increase weight' },
      { index: 1, text: 'Ease assembly & remove burrs' },
      { index: 2, text: 'Add color' },
      { index: 3, text: 'Reduce strength' },
    ],
  },
  {
    id: 6, prompt: 'Which material is hardest on the Mohs scale?',
    difficulty: 'easy',
    choices: [
      { index: 0, text: 'Tungsten carbide' },
      { index: 1, text: 'Diamond' },
      { index: 2, text: 'Hardened steel' },
      { index: 3, text: 'Titanium' },
    ],
  },
];

const CORRECT_ANSWERS: Record<number, number> = { 1: 0, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1 };

const MOCK_SPONSOR_QUESTION = {
  id: 1,
  prompt: 'Which Sandvik Coromant product is rated #1 for precision milling applications?',
  choices: [
    { index: 0, text: 'ProMill X200' },
    { index: 1, text: 'UltraCut 500 Series' },
    { index: 2, text: 'MaxTurn Pro Elite' },
    { index: 3, text: 'PrecisionEdge Z1' },
  ],
  bonusPoints: 200,
  sponsor: {
    id: 1,
    name: 'Sandvik Coromant',
    logoUrl: '',
    primaryColor: '#DE0016',
    mediaUrl: null,
    mediaType: null,
    websiteUrl: 'https://www.sandvik.coromant.com',
  },
};

const MOCK_LEADERBOARD_ROWS = [
  { rank: 1, displayName: 'Maria S.', company: 'Acme Machining', score: 1820 },
  { rank: 2, displayName: 'Jake T.', company: 'Precision Parts Co.', score: 1450 },
  { rank: 3, displayName: 'Sam R.', company: 'MetalWorks LLC', score: 1320 },
  { rank: 4, displayName: 'Ling K.', company: 'FastCut Inc.', score: 1180 },
  { rank: 5, displayName: 'Dave H.', company: 'ProMill Ltd.', score: 980 },
  { rank: 6, displayName: 'Chris M.', company: 'Delta Tools', score: 920 },
  { rank: 7, displayName: 'Dana K.', company: 'CNC Direct', score: 880 },
  { rank: 8, displayName: 'Pat L.', company: 'Apex Metalwork', score: 800 },
  { rank: 9, displayName: 'Mo S.', company: 'TopGrind Co.', score: 740 },
  { rank: 10, displayName: 'Alex P.', company: 'Ironclad Mfg', score: 720 },
];

let mockScore = 0;
let mockStreak = 0;
let mockSessionId = 1001;

function matchesRoute(url: string, method: string, pattern: string, patternMethod: string): boolean {
  if (method !== patternMethod) return false;
  const base = environment.apiUrl;
  const path = url.replace(base, '');
  const regex = new RegExp('^' + pattern.replace(/:[^/]+/g, '[^/]+') + '$');
  return regex.test(path);
}

export const mockInterceptor: HttpInterceptorFn = (req: HttpRequest<unknown>, next: HttpHandlerFn) => {
  const url = req.url;
  const method = req.method;

  if (!url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const respond = (body: unknown) => of(new HttpResponse({ status: 200, body })).pipe(delay(300));

  // POST /auth/register
  if (matchesRoute(url, method, '/auth/register', 'POST')) {
    mockScore = 0; mockStreak = 0;
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
    mockScore = 0; mockStreak = 0;
    mockSessionId++;
    return respond({
      sessionId: mockSessionId,
      endsAt: new Date(Date.now() + 90 * 1000).toISOString(),
      questions: MOCK_QUESTIONS,
      sponsorQuestion: MOCK_SPONSOR_QUESTION,
    });
  }

  // POST /sessions/:id/answers
  if (matchesRoute(url, method, '/sessions/:id/answers', 'POST')) {
    const body = req.body as { questionId: number; choiceIndex: number };
    const correct = CORRECT_ANSWERS[body.questionId] === body.choiceIndex;
    if (correct) {
      mockStreak++;
    } else {
      mockStreak = 0;
    }
    const multiplier = mockStreak >= 6 ? 2.5 : mockStreak >= 4 ? 2 : mockStreak >= 2 ? 1.5 : 1;
    const points = correct ? Math.round(100 * multiplier) : 0;
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

  // POST /sessions/:id/complete
  if (matchesRoute(url, method, '/sessions/:id/complete', 'POST')) {
    return respond({
      sessionId: mockSessionId,
      score: mockScore,
      correctAnswers: 4,
      totalAnswers: 6,
      bestStreak: mockStreak,
      rank: 3,
      totalPlayers: 11,
      sponsorBonus: 0,
    });
  }

  // GET /sessions/:id/result
  if (matchesRoute(url, method, '/sessions/:id/result', 'GET')) {
    return respond({
      sessionId: mockSessionId,
      score: mockScore,
      correctAnswers: 4,
      totalAnswers: 6,
      bestStreak: mockStreak,
      rank: 3,
      totalPlayers: 11,
      sponsorBonus: 0,
      player: MOCK_PLAYER,
    });
  }

  // GET /leaderboard
  if (matchesRoute(url, method, '/leaderboard', 'GET')) {
    return respond({
      scope: 'today',
      rows: MOCK_LEADERBOARD_ROWS,
      totalPlayers: 11,
      resetsAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
  }

  // GET /booth-display
  if (matchesRoute(url, method, '/booth-display', 'GET')) {
    return respond({
      rows: MOCK_LEADERBOARD_ROWS.slice(0, 10),
      totalPlayers: 11,
      eventName: 'IMTS 2026',
      resetsAt: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
    });
  }

  return next(req);
};
