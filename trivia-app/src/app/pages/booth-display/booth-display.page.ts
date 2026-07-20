import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { QRCodeComponent } from 'angularx-qrcode';
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
  imports: [IonContent, QRCodeComponent],
})
export class BoothDisplayPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  readonly appConfig = inject(AppConfigStore);

  readonly data = signal<BoothDisplayResponse | null>(null);

  readonly qrSize = QR_SIZE;
  readonly playUrl = environment.playUrl;

  ngOnInit(): void {
    const eventId = this.route.snapshot.paramMap.get('id') ?? '';
    timer(0, POLL_MS).pipe(
      switchMap(() => this.api.getBoothDisplay(eventId)),
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
