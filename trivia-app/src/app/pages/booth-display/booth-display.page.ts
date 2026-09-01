import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';
import { timer, switchMap } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { AppConfigStore } from '../../core/stores/app-config/app-config.store';
import type { BoothDisplayResponse, SponsorCardDto } from '../../core/models/api.models';
import { formatCountdown } from '../../shared/utils/format-countdown.util';

const POLL_MS = 30_000;
const SPONSOR_ROTATE_MS = 3_000;
const QR_SIZE = 220;

@Component({
  selector: 'app-booth-display',
  templateUrl: 'booth-display.page.html',
  styleUrls: ['booth-display.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, QRCodeComponent],
})
export class BoothDisplayPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly appConfig = inject(AppConfigStore);

  readonly data = signal<BoothDisplayResponse | null>(null);

  readonly qrSize = QR_SIZE;

  /**
   * QR target players scan to register (spec §8.3). Composed from the register page URL
   * (same origin the booth is served from) plus the admin-issued token from the backend.
   * Empty until the first booth-display response arrives so no stale/blank QR is rendered.
   */
  readonly qrData = computed(() => {
    const token = this.data()?.registrationToken;
    if (!token) return '';
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    return `${origin}/register?token=${encodeURIComponent(token)}`;
  });

  /**
   * Sponsor cards, deduplicated by name. Sponsors are global records shared
   * across sponsor questions, but a database written before that was enforced
   * can hold one row per question — same name, different id — which rendered
   * the same sponsor as several cards. Keyed on name rather than id for exactly
   * that reason. The highest id wins, so the most recently uploaded logo is the
   * one kept — matching how the backend resolves the same collision.
   */
  readonly sponsorCards = computed<SponsorCardDto[]>(() => {
    const byName = new Map<string, SponsorCardDto>();
    for (const s of this.data()?.sponsorCards ?? []) {
      const key = s.name.trim().toLowerCase();
      const kept = byName.get(key);
      if (!kept || s.id > kept.id) byName.set(key, s);
    }
    return [...byName.values()].sort((a, b) => a.id - b.id);
  });

  private readonly activeSponsorIndex = signal(0);

  /** The one sponsor card visible at a time, cycling through `sponsorCards()` on a timer. */
  readonly activeSponsor = computed<SponsorCardDto | null>(() => {
    const list = this.sponsorCards();
    if (!list.length) return null;
    return list[this.activeSponsorIndex() % list.length];
  });

  /** Falls back to the generic "midnight" copy only until the first response arrives. */
  readonly resetsInLabel = computed(() => {
    const countdown = formatCountdown(this.data()?.resetsAt);
    return countdown ? `RESETS IN ${countdown.toUpperCase()}` : 'RESETS AT MIDNIGHT';
  });

  ngOnInit(): void {
    const eventId = this.route.snapshot.paramMap.get('id') ?? '';
    timer(0, POLL_MS).pipe(
      switchMap(() => this.api.getBoothDisplay(eventId)),
    ).subscribe((res) => this.data.set(res));

    timer(SPONSOR_ROTATE_MS, SPONSOR_ROTATE_MS).subscribe(() => {
      this.activeSponsorIndex.update(i => i + 1);
    });
  }

  initials(displayName: string): string {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w.charAt(0).toUpperCase())
      .join('');
  }
  onQrClick(): void {
    const qr = this.qrData();
    if (qr) {
      window.open(qr, '_blank');
    }
  }
}
