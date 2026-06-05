import { Injectable } from '@angular/core';
import type { Difficulty } from '../models/api.models';

// Mirrors the server-side ScoringService formula — for optimistic UI only.
// The authoritative score always comes from the API response.
@Injectable({ providedIn: 'root' })
export class ScoringService {
  readonly BASE_POINTS = 100;

  multiplierFor(streak: number): number {
    if (streak >= 6) return 2.5;
    if (streak >= 4) return 2;
    if (streak >= 2) return 1.5;
    return 1;
  }

  computePoints(streak: number): number {
    return Math.round(this.BASE_POINTS * this.multiplierFor(streak));
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
