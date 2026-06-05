import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { GameStore } from '../../core/stores/game/game.store';
import { ApiService } from '../../core/services/api.service';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

@Component({
  selector: 'app-sponsor',
  templateUrl: 'sponsor.page.html',
  styleUrls: ['sponsor.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe, PmHeaderComponent],
})
export class SponsorPage {
  private readonly router = inject(Router);
  // GameStore from parent route provider
  readonly selectedIndex = signal<number | null>(null);
  readonly answered = signal(false);
  readonly isCorrect = signal<boolean | null>(null);

  skip(): void {
    this.router.navigate(['/leaderboard']);
  }

  selectAnswer(index: number, correctIndex: number, bonus: number): void {
    if (this.answered()) return;
    this.selectedIndex.set(index);
    this.answered.set(true);
    this.isCorrect.set(index === correctIndex);
    setTimeout(() => this.router.navigate(['/leaderboard']), 1500);
  }
}
