import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GameStore } from '../../core/stores/game/game.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

// Length of the simulated sponsor reel when no real video media is supplied (mock/demo).
const PLACEHOLDER_REEL_SECONDS = 5;
const REVEAL_DELAY_MS = 1100;

@Component({
  selector: 'app-sponsor',
  templateUrl: 'sponsor.page.html',
  styleUrls: ['sponsor.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe, PmHeaderComponent],
})
export class SponsorPage implements OnInit {
  readonly gameStore = inject(GameStore);
  private readonly router = inject(Router);

  readonly sponsorQuestion = this.gameStore.currentSponsorQuestion;
  readonly result = this.gameStore.lastSponsorResult;

  readonly sponsorInitials = computed(() => {
    const name = this.sponsorQuestion()?.sponsor.name ?? '';
    return name.split(/\s+/).map((word) => word[0] ?? '').slice(0, 2).join('').toUpperCase();
  });

  readonly videoStarted = signal(false);
  readonly unlocked = signal(false);
  // Real seconds remaining in the reel — the label always matches actual elapsed time.
  readonly secondsLeft = signal(0);
  readonly selectedIndex = signal<number | null>(null);

  ngOnInit(): void {
    // Direct navigation without a pending sponsor round → fall straight through to results.
    if (!this.gameStore.hasSponsorRound()) {
      this.finish();
    }
  }

  startVideo(): void {
    if (this.videoStarted()) return;
    this.videoStarted.set(true);
    this.secondsLeft.set(PLACEHOLDER_REEL_SECONDS);
    const tick = setInterval(() => {
      const next = this.secondsLeft() - 1;
      if (next <= 0) {
        clearInterval(tick);
        this.secondsLeft.set(0);
        this.unlocked.set(true);
      } else {
        this.secondsLeft.set(next);
      }
    }, 1000);
  }

  pick(index: number): void {
    if (!this.unlocked() || this.selectedIndex() !== null || this.gameStore.isPending()) return;
    const question = this.sponsorQuestion();
    if (!question) return;

    this.selectedIndex.set(index);
    this.gameStore.submitSponsorAnswer({ questionId: question.id, choiceIndex: index });

    // Wait for the authoritative result, reveal it, then advance to the next sponsor
    // question or complete the session when all sponsor questions are answered.
    const poll = setInterval(() => {
      if (this.gameStore.lastSponsorResult()) {
        clearInterval(poll);
        setTimeout(() => {
          if (this.gameStore.hasSponsorRound()) {
            // More sponsor questions remain — clear result and reset local UI for next round.
            this.gameStore.clearSponsorResult();
            this.selectedIndex.set(null);
            this.videoStarted.set(false);
            this.unlocked.set(false);
            this.secondsLeft.set(0);
          } else {
            this.finish();
          }
        }, REVEAL_DELAY_MS);
      }
    }, 100);
  }

  private finish(): void {
    const sessionId = this.gameStore.sessionId();
    this.gameStore.completeSession(undefined);
    this.router.navigate(['/results', sessionId]);
  }
}
