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

  /** The multiplier always corresponds to the difficulty actually played, not raw streak. */
  readonly MULTIPLIER_BY_DIFFICULTY: Record<Difficulty, number> = {
    easy: 1,
    medium: 1.5,
    hard: 2,
    hard_plus: 2.5,
  };

  multiplierFor(difficulty: Difficulty): number {
    return this.MULTIPLIER_BY_DIFFICULTY[difficulty] ?? 1;
  }

  basePointsFor(difficulty: Difficulty): number {
    return (
      this.BASE_POINTS_BY_DIFFICULTY[difficulty] ??
      this.BASE_POINTS_BY_DIFFICULTY.easy
    );
  }

  /** points = base_question_points × difficulty_multiplier (spec §5.2). */
  computePoints(difficulty: Difficulty): number {
    return Math.round(
      this.basePointsFor(difficulty) * this.multiplierFor(difficulty),
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
