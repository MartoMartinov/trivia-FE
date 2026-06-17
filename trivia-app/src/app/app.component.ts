import { ChangeDetectionStrategy, Component, OnInit, inject } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { AppConfigStore } from './core/stores/app-config/app-config.store';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonApp, IonRouterOutlet],
})
export class AppComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  // Injecting here ensures the store (and its onInit hook) is created at app startup.
  readonly appConfigStore = inject(AppConfigStore);

  ngOnInit(): void {
    this.translate.setDefaultLang('en');
    this.translate.use('en');
    document.documentElement.lang = 'en';
  }
}
