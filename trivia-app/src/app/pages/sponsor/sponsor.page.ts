import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GameStore } from '../../core/stores/game/game.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

// Fallback reel length when no videoUrl is provided.
const PLACEHOLDER_REEL_SECONDS = 5;
const REVEAL_DELAY_MS = 1100;

@Component({
  selector: 'app-sponsor',
  templateUrl: 'sponsor.page.html',
  styleUrls: ['sponsor.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe, PmHeaderComponent],
})
export class SponsorPage implements OnInit, OnDestroy {
  readonly gameStore = inject(GameStore);
  private readonly router = inject(Router);

  readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  readonly sponsorQuestion = this.gameStore.currentSponsorQuestion;
  readonly result = this.gameStore.lastSponsorResult;

  readonly sponsorInitials = computed(() => {
    const name = this.sponsorQuestion()?.sponsor.name ?? '';
    return name.split(/\s+/).map((word) => word[0] ?? '').slice(0, 2).join('').toUpperCase();
  });

  readonly videoStarted = signal(false);
  readonly unlocked = signal(false);
  /** Seconds remaining in the video reel (drives the badge inside the player). */
  readonly secondsLeft = signal(0);
  readonly selectedIndex = signal<number | null>(null);

  /** Seconds remaining to answer after the video ends. Counts down in MM:SS. */
  readonly questionSecondsLeft = signal(0);

  readonly questionTimerLabel = computed(() => {
    const s = this.questionSecondsLeft();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  readonly questionTimerPct = computed(() => {
    if (!this.unlocked()) return 100;
    const total = this.sponsorQuestion()?.timerSeconds ?? 30;
    if (total === 0) return 0;
    return (this.questionSecondsLeft() / total) * 100;
  });

  private questionTimerTick: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    if (!this.gameStore.hasSponsorRound()) {
      this.finish();
    }
  }

  ngOnDestroy(): void {
    this.clearQuestionTimer();
  }

  // ── Video handlers ────────────────────────────────────────────────────────────

  startVideo(): void {
    if (this.videoStarted()) return;
    this.videoStarted.set(true);
    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.play().catch(() => this.runPlaceholderCountdown());
    } else {
      this.runPlaceholderCountdown();
    }
  }

  onMetadataLoaded(): void {
    const duration = this.videoRef()?.nativeElement.duration ?? PLACEHOLDER_REEL_SECONDS;
    this.secondsLeft.set(Math.ceil(duration));
  }

  onTimeUpdate(): void {
    const video = this.videoRef()?.nativeElement;
    if (!video) return;
    this.secondsLeft.set(Math.max(0, Math.ceil(video.duration - video.currentTime)));
  }

  onVideoEnded(): void {
    this.secondsLeft.set(0);
    this.unlocked.set(true);
    this.startQuestionTimer();
  }

  // ── Answer handling ───────────────────────────────────────────────────────────

  pick(index: number): void {
    if (!this.unlocked() || this.selectedIndex() !== null || this.gameStore.isPending()) return;
    const question = this.sponsorQuestion();
    if (!question) return;

    this.clearQuestionTimer();
    this.selectedIndex.set(index);
    this.gameStore.submitSponsorAnswer({ questionId: question.id, choiceIndex: index });

    const poll = setInterval(() => {
      if (this.gameStore.lastSponsorResult()) {
        clearInterval(poll);
        setTimeout(() => {
          if (this.gameStore.hasSponsorRound()) {
            this.resetForNextQuestion();
          } else {
            this.finish();
          }
        }, REVEAL_DELAY_MS);
      }
    }, 100);
  }

  // ── Question timer ────────────────────────────────────────────────────────────

  private startQuestionTimer(): void {
    const seconds = this.sponsorQuestion()?.timerSeconds ?? 30;
    this.questionSecondsLeft.set(seconds);
    this.questionTimerTick = setInterval(() => {
      const next = this.questionSecondsLeft() - 1;
      if (next <= 0) {
        this.clearQuestionTimer();
        this.questionSecondsLeft.set(0);
        // Timer expired — skip this question and advance or finish.
        this.gameStore.skipSponsorQuestion();
        if (this.gameStore.hasSponsorRound()) {
          this.resetForNextQuestion();
        } else {
          this.finish();
        }
      } else {
        this.questionSecondsLeft.set(next);
      }
    }, 1000);
  }

  private clearQuestionTimer(): void {
    if (this.questionTimerTick !== null) {
      clearInterval(this.questionTimerTick);
      this.questionTimerTick = null;
    }
  }

  // ── Navigation helpers ────────────────────────────────────────────────────────

  private resetForNextQuestion(): void {
    this.clearQuestionTimer();
    const video = this.videoRef()?.nativeElement;
    if (video) {
      video.pause();
      video.load();
    }
    this.gameStore.clearSponsorResult();
    this.selectedIndex.set(null);
    this.videoStarted.set(false);
    this.unlocked.set(false);
    this.secondsLeft.set(0);
    this.questionSecondsLeft.set(0);
  }

  private runPlaceholderCountdown(): void {
    this.secondsLeft.set(PLACEHOLDER_REEL_SECONDS);
    const tick = setInterval(() => {
      const next = this.secondsLeft() - 1;
      if (next <= 0) {
        clearInterval(tick);
        this.secondsLeft.set(0);
        this.unlocked.set(true);
        this.startQuestionTimer();
      } else {
        this.secondsLeft.set(next);
      }
    }, 1000);
  }

  private finish(): void {
    const sessionId = this.gameStore.sessionId();
    this.gameStore.completeSession(undefined);
    this.router.navigate(['/results', sessionId]);
  }
}
