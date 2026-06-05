import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { LeaderboardStore } from '../../core/stores/leaderboard/leaderboard.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

@Component({
  selector: 'app-leaderboard',
  templateUrl: 'leaderboard.page.html',
  styleUrls: ['leaderboard.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [LeaderboardStore],
  imports: [IonContent, TranslatePipe, PmHeaderComponent],
})
export class LeaderboardPage implements OnInit {
  readonly store = inject(LeaderboardStore);
  private readonly router = inject(Router);

  ngOnInit(): void {
    this.store.startPolling(undefined);
  }

  setScope(scope: 'today' | 'week'): void {
    this.store.setScope(scope);
  }

  goToRegister(): void {
    this.router.navigate(['/register']);
  }
}
