import { ChangeDetectionStrategy, Component, computed, inject, Input } from '@angular/core';
import { AppConfigStore } from '../../../core/stores/app-config/app-config.store';
import { BoothTokenStore } from '../../../core/stores/booth-token/booth-token.store';
import { RouterLink, RouterOutlet } from '@angular/router';
@Component({
  selector: 'pm-header',
  templateUrl: 'pm-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
})
export class PmHeaderComponent {
  @Input() tag = 'TRIVIA';

  private readonly appConfigStore = inject(AppConfigStore);
  private readonly boothTokenStore = inject(BoothTokenStore);

  readonly eventLogoUrl = this.appConfigStore.eventLogoUrl;
  readonly tvLogoUrl = this.appConfigStore.tvLogoUrl;

  /** Carries the kiosk boothToken forward on the logo→register link, if this device has one. */
  readonly registerQueryParams = computed(() => {
    const boothToken = this.boothTokenStore.boothToken();
    return boothToken ? { boothToken } : {};
  });
}
