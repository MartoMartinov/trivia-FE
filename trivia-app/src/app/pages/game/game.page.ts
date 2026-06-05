import {
  ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GameStore } from '../../core/stores/game/game.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';
import type { LastResult } from '../../core/stores/game/game.slice';

@Component({
  selector: 'app-game',
  templateUrl: 'game.page.html',
  styleUrls: ['game.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GameStore],
  imports: [IonContent, TranslatePipe, UpperCasePipe, PmHeaderComponent],
})
export class GamePage implements OnInit, OnDestroy {
  readonly gameStore = inject(GameStore);
  private readonly router = inject(Router);

  readonly selectedIndex = signal<number | null>(null);
  // Local result display — cleared before moving to next question
  readonly lastResult = signal<LastResult | null>(null);

  readonly timeLeft = signal(90);
  readonly timeLeftPct = computed(() => (this.timeLeft() / 90) * 100);

  private timerRef: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.gameStore.startSession(undefined);
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private startTimer(): void {
    this.timerRef = setInterval(() => {
      const endsAt = this.gameStore.endsAt();
      if (!endsAt) return;
      const remaining = Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 1000));
      this.timeLeft.set(remaining);
      if (remaining === 0) this.endGame();
    }, 500);
  }

  private clearTimer(): void {
    if (this.timerRef) clearInterval(this.timerRef);
  }

  private endGame(): void {
    this.clearTimer();
    const sessionId = this.gameStore.sessionId();
    this.gameStore.completeSession(undefined);
    this.router.navigate(['/results', sessionId]);
  }

  selectAnswer(index: number): void {
    if (this.selectedIndex() !== null || this.gameStore.isPending()) return;

    const question = this.gameStore.currentQuestion();
    if (!question) return;

    this.selectedIndex.set(index);
    this.lastResult.set(null);

    this.gameStore.submitAnswer({ questionId: question.id, choiceIndex: index });

    // poll for result then advance
    const poll = setInterval(() => {
      const result = this.gameStore.lastResult();
      if (result) {
        this.lastResult.set(result);
        clearInterval(poll);
        setTimeout(() => {
          this.selectedIndex.set(null);
          this.lastResult.set(null);
          if (!this.gameStore.hasMoreQuestions()) {
            this.endGame();
          }
        }, 1100);
      }
    }, 100);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    return `${m}:${String(seconds % 60).padStart(2, '0')}`;
  }
}
