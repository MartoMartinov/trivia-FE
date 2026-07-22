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
import { QRCodeComponent } from 'angularx-qrcode';

import { GameStore } from '../../core/stores/game/game.store';
import { ApiService } from '../../core/services/api.service';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';
import type { SponsorDto, SponsorQuestionDto } from '../../core/models/api.models';

const PLACEHOLDER_REEL_SECONDS = 5;
const REVEAL_DELAY_MS = 1100;
const FINISH_DELAY_MS = 2100;

/**
 * The sponsor round is a three-phase flow inside a single page:
 *  intro    — handoff screen explaining the sponsor round + its flat scoring, with a Continue button
 *  question — the per-question video/timer/answer experience
 *  outro    — a "find out more" CTA with a clickable QR code to the sponsor's site
 */
type SponsorPhase = 'intro' | 'question' | 'outro';

@Component({
  selector: 'app-sponsor',
  templateUrl: 'sponsor.page.html',
  styleUrls: ['sponsor.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe, PmHeaderComponent, QRCodeComponent],
})
export class SponsorPage implements OnInit, OnDestroy {
  readonly gameStore = inject(GameStore);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);

  readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('videoEl');

  /** Which of the three sponsor-round screens is currently showing. */
  readonly phase = signal<SponsorPhase>('intro');

  /** Total sponsor questions — drives the intro copy ("The next N questions…"). */
  readonly sponsorCount = computed(() => this.gameStore.sponsorQuestions().length);

  /**
   * Sponsor featured on the outro CTA. Uses the last sponsor question's sponsor (the most
   * recent brand the player saw). Its websiteUrl is what the QR code encodes.
   */
  readonly outroSponsor = computed<SponsorDto | null>(() => {
    const qs = this.gameStore.sponsorQuestions();
    return qs.length ? qs[qs.length - 1].sponsor : null;
  });

  /**
   * The question currently rendered. Only advances/clears AFTER the reveal delay so
   * the correct-answer highlight stays visible even after the store has already moved
   * sponsorIndex past this question.
   */
  readonly sponsorQuestion = signal<SponsorQuestionDto | null>(null);
  readonly result = this.gameStore.lastSponsorResult;

  readonly sponsorInitials = computed(() => {
    // Falls back to the outro sponsor: on the outro screen sponsorQuestion is cleared to null.
    const name = this.sponsorQuestion()?.sponsor.name ?? this.outroSponsor()?.name ?? '';
    return name.split(/\s+/).map((word) => word[0] ?? '').slice(0, 2).join('').toUpperCase();
  });

  readonly bonusBadgeParams = computed(() => {
    const q = this.sponsorQuestion();
    const all = this.gameStore.sponsorQuestions();
    const current = q ? all.findIndex((sq) => sq.id === q.id) + 1 : 0;
    return { current, total: all.length };
  });

  readonly videoStarted = signal(false);
  readonly unlocked = signal(false);
  readonly isMuted = signal(false);
  /** Seconds remaining in the video reel (drives the badge inside the player). */
  readonly secondsLeft = signal(0);
  readonly selectedIndex = signal<number | null>(null);

  /** Integer seconds left — drives the MM:SS label only. */
  readonly questionSecondsLeft = signal(0);
  /** Continuous 0–1 progress — drives the timer bar at ~60 fps via rAF. */
  readonly timerProgress = signal(1);

  readonly questionTimerLabel = computed(() => {
    const s = this.questionSecondsLeft();
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  });

  /** Bar width %: full while video plays, then drains continuously once unlocked. */
  readonly questionTimerPct = computed(() =>
    this.unlocked() ? this.timerProgress() * 100 : 100,
  );

  private questionTimerTick: ReturnType<typeof setInterval> | null = null;
  private rafId: number | null = null;
  private rafStartTime = 0;
  private rafTotalMs = 0;

  ngOnInit(): void {
    // No sponsor round configured → skip straight to results, no intro/outro.
    if (!this.gameStore.hasSponsorRound()) {
      this.finish();
      return;
    }
    // Otherwise the page opens on the 'intro' handoff screen (the signal's default);
    // the first question loads only once the player taps Continue.
  }

  ngOnDestroy(): void {
    this.clearQuestionTimer();
  }

  // ── Phase navigation ────────────────────────────────────────────────────────

  /** Intro → first sponsor question. */
  continueToQuestions(): void {
    this.phase.set('question');
    this.sponsorQuestion.set(this.gameStore.currentSponsorQuestion());
    this.maybeAutoUnlock();
  }

  /** Last question answered/expired → the outro CTA screen. */
  private goToOutro(): void {
    this.clearQuestionTimer();
    this.videoRef()?.nativeElement.pause();
    this.sponsorQuestion.set(null);
    this.phase.set('outro');
  }

  // ── Sponsor link ──────────────────────────────────────────────────────────────

  clickSponsorLink(): void {
    const sq = this.sponsorQuestion();
    if (!sq?.sponsor.websiteUrl) return;
    const sessionId = this.gameStore.sessionId();
    if (sessionId) {
      this.api.trackSponsorClick(sessionId, { sponsorId: sq.sponsor.id, questionId: sq.id, event: 'website_click' }).subscribe();
    }
    window.open(sq.sponsor.websiteUrl, '_blank', 'noopener,noreferrer');
  }

  /** Fires the same click tracking as the in-question link when the outro QR/link is used. */
  trackOutroClick(): void {
    const sponsor = this.outroSponsor();
    const sessionId = this.gameStore.sessionId();
    const questions = this.gameStore.sponsorQuestions();
    const lastQuestion = questions[questions.length - 1];
    if (!sponsor?.websiteUrl || !sessionId || !lastQuestion) return;
    this.api
      .trackSponsorClick(sessionId, { questionId: lastQuestion.id, event: 'website_click' })
      .subscribe();
  }

  /** Outro "See results" button. */
  seeResults(): void {
    this.finish();
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

  toggleMute(): void {
    const video = this.videoRef()?.nativeElement;
    if (!video) return;
    video.muted = !video.muted;
    this.isMuted.set(video.muted);
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
        // Capture isLast now — after applySponsorResult the store index has already advanced.
        const isLast = !this.gameStore.hasSponsorRound();
        setTimeout(() => {
          if (isLast) {
            this.goToOutro();
          } else {
            this.resetForNextQuestion();
          }
        }, isLast ? FINISH_DELAY_MS : REVEAL_DELAY_MS);
      }
    }, 100);
  }

  // ── Question timer ────────────────────────────────────────────────────────────

  private startQuestionTimer(): void {
    const seconds = this.sponsorQuestion()?.timerSeconds ?? 30;
    this.questionSecondsLeft.set(seconds);
    this.timerProgress.set(1);

    // rAF loop: updates the bar continuously at ~60 fps.
    this.rafTotalMs = seconds * 1000;
    this.rafStartTime = performance.now();
    const rafTick = () => {
      const elapsed = performance.now() - this.rafStartTime;
      const progress = Math.max(0, 1 - elapsed / this.rafTotalMs);
      this.timerProgress.set(progress);
      if (progress > 0) {
        this.rafId = requestAnimationFrame(rafTick);
      } else {
        this.rafId = null;
      }
    };
    this.rafId = requestAnimationFrame(rafTick);

    // setInterval: updates the integer MM:SS label once per second.
    this.questionTimerTick = setInterval(() => {
      const next = this.questionSecondsLeft() - 1;
      if (next <= 0) {
        this.clearQuestionTimer();
        this.questionSecondsLeft.set(0);
        this.timerProgress.set(0);
        this.gameStore.skipSponsorQuestion();
        if (this.gameStore.hasSponsorRound()) {
          this.resetForNextQuestion();
        } else {
          this.goToOutro();
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
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
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
    this.sponsorQuestion.set(this.gameStore.currentSponsorQuestion());
    this.selectedIndex.set(null);
    this.videoStarted.set(false);
    this.unlocked.set(false);
    this.isMuted.set(false);
    this.secondsLeft.set(0);
    this.questionSecondsLeft.set(0);
    this.timerProgress.set(1);
    this.maybeAutoUnlock();
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

  private maybeAutoUnlock(): void {
    const sq = this.sponsorQuestion();
    if (sq?.sponsor.imageUrl && !sq?.sponsor.videoUrl) {
      this.unlocked.set(true);
      this.startQuestionTimer();
    }
  }

  private finish(): void {
    const sessionId = this.gameStore.sessionId();
    this.gameStore.completeSession(undefined);
    this.router.navigate(['/results', sessionId]);
  }
}
