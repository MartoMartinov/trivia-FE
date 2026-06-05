import { ChangeDetectionStrategy, Component } from '@angular/core';
import { IonHeader, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'pm-header',
  templateUrl: 'pm-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonHeader, IonToolbar],
})
export class PmHeaderComponent {}
