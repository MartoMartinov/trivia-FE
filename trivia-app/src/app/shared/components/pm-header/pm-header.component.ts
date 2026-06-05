import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'pm-header',
  templateUrl: 'pm-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PmHeaderComponent {
  @Input() tag = 'TRIVIA';
}
