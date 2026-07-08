import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { timer, switchMap } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { AppConfigStore } from '../../core/stores/app-config/app-config.store';
import { environment } from '../../../environments/environment';
import type { BoothDisplayResponse } from '../../core/models/api.models';

const POLL_MS = 10_000;
const QR_SIZE = 220;

@Component({
  selector: 'app-booth-display',
  templateUrl: 'booth-display.page.html',
  styleUrls: ['booth-display.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent],
})
export class BoothDisplayPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly appConfig = inject(AppConfigStore);

  readonly data = signal<BoothDisplayResponse | null>(null);

  /** QR code image pointing at the public game URL (spec §8.3), generated dynamically. */
  readonly qrSrc = computed(() =>
    environment.qrApiUrl
      .replace(/\{size\}/g, String(QR_SIZE))
      .replace('{data}', encodeURIComponent(environment.playUrl)),
  );
  readonly playUrl = environment.playUrl;

  ngOnInit(): void {
    // const token  this.route.snapshot.queryParamMap.get('token') ?? '';
    timer(0, POLL_MS).pipe(
      switchMap(() => this.api.getBoothDisplay()),
    ).subscribe((res) => this.data.set(res));
  }

  initials(displayName: string): string {
    return displayName
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w.charAt(0).toUpperCase())
      .join('');
  }
}
