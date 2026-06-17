import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { timer, switchMap } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import { environment } from '../../../environments/environment';
import type { BoothDisplayResponse } from '../../core/models/api.models';

const POLL_MS = 10_000;
const QR_SIZE = 220;

@Component({
  selector: 'app-booth-display',
  templateUrl: 'booth-display.page.html',
  styleUrls: ['booth-display.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe],
})
export class BoothDisplayPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly data = signal<BoothDisplayResponse | null>(null);

  /** QR code image pointing at the public game URL (spec §8.3), generated dynamically. */
  readonly qrSrc = computed(() =>
    environment.qrApiUrl
      .replace(/\{size\}/g, String(QR_SIZE))
      .replace('{data}', encodeURIComponent(environment.playUrl)),
  );
  readonly playUrl = environment.playUrl;

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    timer(0, POLL_MS).pipe(
      switchMap(() => this.api.getBoothDisplay(token)),
    ).subscribe((res) => this.data.set(res));
  }
}
