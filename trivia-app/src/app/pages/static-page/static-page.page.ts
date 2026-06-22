import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

import { ApiService } from '../../core/services/api.service';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

@Component({
  selector: 'app-static-page',
  templateUrl: 'static-page.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, PmHeaderComponent, RouterLink],
})
export class StaticPagePage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly sanitizer = inject(DomSanitizer);

  readonly title = signal<string>('');
  readonly content = signal<SafeHtml | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);

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
