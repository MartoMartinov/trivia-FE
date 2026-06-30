import {
  ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal,
} from '@angular/core';
import { UpperCasePipe } from '@angular/common';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GameStore } from '../../core/stores/game/game.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';
import type { LastResult } from '../../core/stores/game/game.slice';

/** Game lifecycle phase: waiting for the session, the pre-game countdown, or active play. */
type GamePhase = 'loading' | 'countdown' | 'playing';

const DEFAULT_DURATION_SECONDS = 90;
const REVEAL_DELAY_MS = 1100;

@Component({
  selector: 'app-game',
  templateUrl: 'game.page.html',
  styleUrls: ['game.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe, UpperCasePipe, PmHeaderComponent],
})
export class GamePage implements OnInit, OnDestroy {
  readonly gameStore = inject(GameStore);
  private readonly router = inject(Router);

  readonly phase = signal<GamePhase>('loading');
  readonly countdownValue = signal(0);

  readonly selectedIndex = signal<number | null>(null);
  readonly lastResult = signal<LastResult | null>(null);
  /** The question currently rendered — updated only after the reveal delay, not when the store advances. */
  readonly displayQuestion = signal<ReturnType<typeof this.gameStore.currentQuestion>>(null);

  readonly timeLeft = signal(0);
  // Total session length (denominator) — sourced from the session config, not a magic number.
  readonly totalSeconds = signal(DEFAULT_DURATION_SECONDS);
  /** Continuous 0–1 progress updated at ~60 fps via rAF — drives the timer bar smoothly. */
  readonly timerProgress = signal(1);
  readonly timeLeftPct = computed(() => this.timerProgress() * 100);

  private timerRef: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private playEndsAt = 0;
  // Guards against the answer-advance path and the timer-expiry path both ending the game (race).
  private hasEnded = false;

  constructor() {
    // Once the session has loaded its first question, kick off the pre-game countdown.
    effect(() => {
      if (this.phase() !== 'loading') return;
      if (this.gameStore.isLoading()) return;
      if (!this.gameStore.currentQuestion()) return;
      this.beginCountdown();
    });
  }

  ngOnInit(): void {
    this.gameStore.startSession(undefined);
  }

  ngOnDestroy(): void {
    this.clearTimer();
  }

  private beginCountdown(): void {
    const seconds = this.gameStore.countdownSeconds();
    if (seconds <= 0) {
      this.beginPlaying();
      return;
    }
    this.phase.set('countdown');
    this.countdownValue.set(seconds);
    const tick = setInterval(() => {
      const next = this.countdownValue() - 1;
      if (next <= 0) {
        clearInterval(tick);
        this.beginPlaying();
      } else {
        this.countdownValue.set(next);
      }
    }, 1000);
  }

  private beginPlaying(): void {
    const duration = this.gameStore.durationSeconds() || DEFAULT_DURATION_SECONDS;
    this.totalSeconds.set(duration);
    this.timeLeft.set(duration);
    this.playEndsAt = Date.now() + duration * 1000;
    this.displayQuestion.set(this.gameStore.currentQuestion());
    this.phase.set('playing');
    this.startTimer();
  }

  private startTimer(): void {
    // setInterval at 500 ms: updates the integer MM:SS display and detects expiry.
    this.timerRef = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((this.playEndsAt - Date.now()) / 1000));
      this.timeLeft.set(remaining);
      if (remaining === 0) this.endGame();
    }, 500);

    // rAF loop: updates timerProgress continuously at ~60 fps for a smooth bar.
    const totalMs = this.totalSeconds() * 1000;
    const rafTick = () => {
      const progress = Math.max(0, (this.playEndsAt - Date.now()) / totalMs);
      this.timerProgress.set(progress);
      if (progress > 0) {
        this.rafId = requestAnimationFrame(rafTick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(rafTick);
  }

  private clearTimer(): void {
    if (this.timerRef) clearInterval(this.timerRef);
    this.timerRef = null;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private endGame(): void {
    if (this.hasEnded) return;
    this.hasEnded = true;
    this.clearTimer();
    if (this.gameStore.hasSponsorRound()) {
      this.router.navigate(['/sponsor']);
      return;
    }
    const sessionId = this.gameStore.sessionId();
    this.gameStore.completeSession(undefined);
    this.router.navigate(['/results', sessionId]);
  }

  private goToSponsor(): void {
    if (this.hasEnded) return;
    this.hasEnded = true;
    this.clearTimer();
    this.router.navigate(['/sponsor']);
  }

  selectAnswer(index: number): void {
    if (this.phase() !== 'playing') return;
    if (this.selectedIndex() !== null || this.gameStore.isPending()) return;

    const question = this.displayQuestion();
    if (!question) return;

    this.selectedIndex.set(index);
    this.lastResult.set(null);
    this.gameStore.clearLastResult();
    this.gameStore.submitAnswer({ questionId: question.id, choiceIndex: index });

    const poll = setInterval(() => {
      const result = this.gameStore.lastResult();
      if (result) {
        this.lastResult.set(result);
        clearInterval(poll);
        setTimeout(() => {
          this.selectedIndex.set(null);
          this.lastResult.set(null);
          // Advance the display only after the reveal — the store already has the next question.
          const nextQuestion = this.gameStore.currentQuestion();
          if (nextQuestion) {
            this.displayQuestion.set(nextQuestion);
          } else {
            this.displayQuestion.set(null);
            if (this.gameStore.hasSponsorRound()) {
              this.goToSponsor();
            } else {
              this.endGame();
            }
          }
        }, REVEAL_DELAY_MS);
      }
    }, 100);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    return `${m}:${String(seconds % 60).padStart(2, '0')}`;
  }

  difficultyDotColor(difficulty: string | undefined): string {
    switch (difficulty) {
      case 'easy':      return '#16a34a';
      case 'medium':    return '#f5b400';
      case 'hard':      return '#f34d23';
      case 'hard_plus': return '#dc2323';
      default:          return '#f34d23';
    }
  }
}
