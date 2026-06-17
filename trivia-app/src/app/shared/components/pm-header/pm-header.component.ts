import { ChangeDetectionStrategy, Component, inject, Input } from '@angular/core';
import { AppConfigStore } from '../../../core/stores/app-config/app-config.store';

@Component({
  selector: 'pm-header',
  templateUrl: 'pm-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PmHeaderComponent {
  @Input() tag = 'TRIVIA';

  private readonly appConfigStore = inject(AppConfigStore);

  readonly eventLogoUrl = this.appConfigStore.eventLogoUrl;
}
