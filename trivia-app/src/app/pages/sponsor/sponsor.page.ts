import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
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

  readonly videoStarted = signal(false);
  readonly unlocked = signal(false);
  readonly countdown = signal(30);
  readonly selectedIndex = signal<number | null>(null);
  readonly answered = signal(false);

  readonly choices = [
    { index: 0, text: 'ProMill X200' },
    { index: 1, text: 'UltraCut 500 Series' },
    { index: 2, text: 'MaxTurn Pro Elite' },
    { index: 3, text: 'PrecisionEdge Z1' },
  ];

  startVideo(): void {
    if (this.videoStarted()) return;
    this.videoStarted.set(true);
    const total = 3000;
    const start = Date.now();
    const t = setInterval(() => {
      const rem = Math.max(0, total - (Date.now() - start));
      this.countdown.set(Math.ceil((rem / total) * 30));
      if (rem <= 0) { clearInterval(t); this.unlocked.set(true); }
    }, 80);
  }

  pick(index: number): void {
    if (!this.unlocked() || this.answered()) return;
    this.selectedIndex.set(index);
    this.answered.set(true);
    setTimeout(() => this.router.navigate(['/results', 1001]), 1100);
  }
}
