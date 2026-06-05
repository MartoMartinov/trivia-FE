import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { ApiService } from '../../core/services/api.service';
import { ScoringService } from '../../core/services/scoring.service';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';
import type { SessionResultDto } from '../../core/models/api.models';

@Component({
  selector: 'app-results',
  templateUrl: 'results.page.html',
  styleUrls: ['results.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, TranslatePipe, PmHeaderComponent],
})
export class ResultsPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(ApiService);
  readonly scoring = inject(ScoringService);

  readonly result = signal<SessionResultDto | null>(null);
  readonly isLoading = signal(true);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getSessionResult(id).subscribe({
      next: (res) => { this.result.set(res); this.isLoading.set(false); },
      error: () => this.isLoading.set(false),
    });
  }

  goToLeaderboard(): void {
    this.router.navigate(['/leaderboard']);
  }

  playAgain(): void {
    this.router.navigate(['/register']);
  }
}
