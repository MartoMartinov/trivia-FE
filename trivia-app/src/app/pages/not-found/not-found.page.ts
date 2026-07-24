import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

@Component({
  selector: 'app-not-found',
  templateUrl: 'not-found.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, PmHeaderComponent, TranslatePipe, RouterLink],
})
export class NotFoundPage {}
