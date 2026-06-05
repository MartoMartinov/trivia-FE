import {
  ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GameStore } from '../../core/stores/game/game.store';
import { ScoringService } from '../../core/services/scoring.service';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

@Component({
  selector: 'app-game',
  templateUrl: 'game.page.html',
  styleUrls: ['game.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [GameStore],
  imports: [IonContent, TranslatePipe, PmHeaderComponent],
})
export class GamePage implements OnInit, OnDestroy {
  readonly gameStore = inject(GameStore);
  private readonly scoring = inject(ScoringService);
  private readonly router = inject(Router);

  readonly selectedIndex = signal<number | null>(null);
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

    this.gameStore.submitAnswer({ questionId: question.id, choiceIndex: index });

    setTimeout(() => {
      this.selectedIndex.set(null);
      if (!this.gameStore.hasMoreQuestions()) {
        this.endGame();
      }
    }, 1200);
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60);
    return `${m}:${String(seconds % 60).padStart(2, '0')}`;
  }

  getChoiceClass(index: number): string {
    const selected = this.selectedIndex();
    const result = this.gameStore.lastResult();
    if (selected === null) return 'border-dark-border hover:border-pm-orange/50 cursor-pointer';
    if (result && index === result.correctIndex) return 'border-green-500 bg-green-500/10';
    if (index === selected && result && !result.correct) return 'border-red-500 bg-red-500/10';
    return 'border-dark-border opacity-50';
  }
}
