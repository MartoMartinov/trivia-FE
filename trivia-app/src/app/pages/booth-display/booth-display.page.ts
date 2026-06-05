import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { timer, switchMap } from 'rxjs';

import { ApiService } from '../../core/services/api.service';
import type { BoothDisplayResponse } from '../../core/models/api.models';

const POLL_MS = 10_000;

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

  readonly data = signal<BoothDisplayResponse | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.queryParamMap.get('token') ?? '';
    timer(0, POLL_MS).pipe(
      switchMap(() => this.api.getBoothDisplay(token)),
    ).subscribe((res) => this.data.set(res));
  }
}
