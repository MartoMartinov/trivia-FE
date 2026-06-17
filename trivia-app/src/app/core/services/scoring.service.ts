import { Injectable } from '@angular/core';
import type { Difficulty } from '../models/api.models';

// Mirrors the server-side ScoringService formula — for optimistic UI only.
// The authoritative score always comes from the API response.
@Injectable({ providedIn: 'root' })
export class ScoringService {
  /** Base points per difficulty (spec §5.1). `hard_plus` is reserved for sponsor questions. */
  readonly BASE_POINTS_BY_DIFFICULTY: Record<Difficulty, number> = {
    easy: 100,
    medium: 150,
    hard: 200,
    hard_plus: 250,
  };

  multiplierFor(streak: number): number {
    if (streak >= 6) return 2.5;
    if (streak >= 4) return 2;
    if (streak >= 2) return 1.5;
    return 1;
  }

  basePointsFor(difficulty: Difficulty): number {
    return (
      this.BASE_POINTS_BY_DIFFICULTY[difficulty] ??
      this.BASE_POINTS_BY_DIFFICULTY.easy
    );
  }

  /** points = base_question_points × active_streak_multiplier (spec §5.2). */
  computePoints(difficulty: Difficulty, streak: number): number {
    return Math.round(
      this.basePointsFor(difficulty) * this.multiplierFor(streak),
    );
  }

  formatScore(n: number): string {
    return Math.round(n).toLocaleString('en-US');
  }

  formatTime(ms: number): string {
    const seconds = Math.max(0, Math.ceil(ms / 1000));
    const minutes = Math.floor(seconds / 60);
    return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
