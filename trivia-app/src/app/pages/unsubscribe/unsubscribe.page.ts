import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ApiService } from '../../core/services/api.service';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

type State = 'initial' | 'loading' | 'success' | 'invalid' | 'no-token';

@Component({
  selector: 'app-unsubscribe',
  templateUrl: 'unsubscribe.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, PmHeaderComponent, TranslatePipe, RouterLink],
})
export class UnsubscribePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);

  readonly state = signal<State>('initial');

  private token: string | null = null;

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) this.state.set('no-token');
  }

  confirm(): void {
    if (!this.token || this.state() === 'loading') return;
    this.state.set('loading');
    this.api.unsubscribe(this.token).subscribe({
      next: () => this.state.set('success'),
      error: () => this.state.set('invalid'),
    });
  }
}
