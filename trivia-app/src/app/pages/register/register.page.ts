import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { AuthStore } from '../../core/stores/auth/auth.store';
import { PlayerStore } from '../../core/stores/player/player.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, ReactiveFormsModule, TranslatePipe, PmHeaderComponent],
})
export class RegisterPage {
  private readonly authStore = inject(AuthStore);
  private readonly playerStore = inject(PlayerStore);
  private readonly router = inject(Router);

  readonly isPending = this.authStore.isPending;
  readonly hasError = this.authStore.hasError;
  readonly errorMessage = this.authStore.errorMessage;

  readonly form = new FormGroup({
    firstName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    lastName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    company: new FormControl('', [Validators.required]),
    phone: new FormControl(''),
    consent: new FormControl(false, [Validators.requiredTrue]),
  });

  submit(): void {
    if (this.form.invalid || this.isPending()) return;

    const { firstName, lastName, email, company, phone, consent } = this.form.getRawValue();

    this.authStore.register({
      firstName: firstName!,
      lastName: lastName!,
      email: email!,
      company: company!,
      phone: phone ?? '',
      consent: consent!,
    });

    // navigate to game once authenticated
    const sub = this.authStore.isAuthenticated;
    const check = setInterval(() => {
      if (sub()) {
        clearInterval(check);
        if (this.authStore.player()) {
          this.playerStore.setPlayer(this.authStore.player()!);
        }
        this.router.navigate(['/game']);
      }
    }, 200);
  }
}
