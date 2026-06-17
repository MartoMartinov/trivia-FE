import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import { STORAGE_KEYS } from '../../core/constants/storage-keys';
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
export class RegisterPage implements OnInit, OnDestroy {
  private authCheckInterval: ReturnType<typeof setInterval> | null = null;
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
    // Phone is required (spec §3.2). Pattern allows digits, spaces, and common separators.
    phone: new FormControl('', [Validators.required, Validators.pattern(/^[+]?[\d\s()-]{7,}$/)]),
    consent: new FormControl(false, [Validators.requiredTrue]),
  });

  async ngOnInit(): Promise<void> {
    try {
      const saved = await SecureStorage.get(STORAGE_KEYS.REGISTRATION);
      if (typeof saved === 'string') this.form.patchValue(JSON.parse(saved));
    } catch {}
  }

  ngOnDestroy(): void {
    if (this.authCheckInterval) clearInterval(this.authCheckInterval);
  }

  submit(): void {
    if (this.form.invalid || this.isPending()) return;

    const { firstName, lastName, email, company, phone, consent } = this.form.getRawValue();

    SecureStorage.set(STORAGE_KEYS.REGISTRATION, JSON.stringify({ firstName, lastName, email, company, phone })).catch(() => {});

    this.authStore.register({
      firstName: firstName!,
      lastName: lastName!,
      email: email!,
      company: company!,
      phone: phone ?? '',
      consent: consent!,
    });

    this.authCheckInterval = setInterval(() => {
      if (this.authStore.isAuthenticated()) {
        clearInterval(this.authCheckInterval!);
        this.authCheckInterval = null;
        if (this.authStore.player()) {
          this.playerStore.setPlayer(this.authStore.player()!);
        }
        this.router.navigate(['/game']);
      }
    }, 200);
  }
}
