import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { GameStore } from '../../../core/stores/game/game.store';

@Component({
  selector: 'pm-header',
  templateUrl: 'pm-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PmHeaderComponent {
  @Input() tag = 'TRIVIA';

  private readonly gameStore = inject(GameStore);

  readonly sponsorLogoUrl = computed(() =>
    this.gameStore.sponsorQuestion()?.sponsor.logoUrl || null
  );
}
