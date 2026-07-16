import { ChangeDetectionStrategy, Component, computed, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { BoothTokenStore } from '../../core/stores/booth-token/booth-token.store';
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
  private readonly boothTokenStore = inject(BoothTokenStore);
  private readonly router = inject(Router);

  readonly topRows = computed(() => this.store.rows().slice(0, 10));
  readonly isCurrentPlayerInTopRows = computed(() =>
    this.topRows().some((r) => r.isCurrentPlayer),
  );

  ngOnInit(): void {
    this.store.setScope(this.store.activeScope());
  }

  setScope(scope: 'today' | 'week'): void {
    this.store.setScope(scope);
  }

  goToRegister(): void {
    const boothToken = this.boothTokenStore.boothToken();
    this.router.navigate(['/register'], { queryParams: boothToken ? { boothToken } : {} });
  }

  initials(displayName: string): string {
    const parts = displayName.trim().split(/\s+/);
    return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
  }

  rankBadgeClass(rank: number, isCurrentPlayer: boolean): string {
    if (isCurrentPlayer) return 'bg-orange text-white';
    if (rank === 1) return 'bg-gold text-navy';
    if (rank === 2) return 'bg-[#CBD5E1] text-navy';
    if (rank === 3) return 'bg-[#FFB783] text-navy';
    return 'bg-paper text-ink';
  }
}
