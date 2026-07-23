import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';

import { ApiService } from '../../core/services/api.service';
import { BoothTokenStore } from '../../core/stores/booth-token/booth-token.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

addIcons({ chevronBackOutline });

@Component({
  selector: 'app-static-page',
  templateUrl: 'static-page.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, PmHeaderComponent, RouterLink],
})
export class StaticPagePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly boothTokenStore = inject(BoothTokenStore);

  readonly title = signal<string>('');
  readonly content = signal<SafeHtml | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

  /** Carries the kiosk boothToken forward on the "Back to register" link, if this device has one. */
  readonly registerQueryParams = computed(() => {
    const boothToken = this.boothTokenStore.boothToken();
    return boothToken ? { boothToken } : {};
  });

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.api.getPage(id).subscribe({
      next: (page) => {
        this.title.set(page.title);
        this.content.set(this.sanitizer.bypassSecurityTrustHtml(page.content));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }
}
