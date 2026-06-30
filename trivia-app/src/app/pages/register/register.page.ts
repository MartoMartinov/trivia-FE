import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, OnInit, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { IonContent, ToastController } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { AuthStore } from '../../core/stores/auth/auth.store';
import { PlayerStore } from '../../core/stores/player/player.store';
import { addIcons } from 'ionicons';
import { alertCircle, close } from 'ionicons/icons';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

addIcons({ alertCircle, close });

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, ReactiveFormsModule, TranslatePipe, PmHeaderComponent, RouterLink],
})
export class RegisterPage implements OnInit, OnDestroy {
  private authCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly authStore = inject(AuthStore);
  private readonly playerStore = inject(PlayerStore);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);

  readonly isPending = this.authStore.isPending;
  readonly hasError = this.authStore.hasError;
  readonly errorMessage = this.authStore.errorMessage;

  constructor() {
    effect(async () => {
      if (!this.hasError()) return;
      const fallback = `${this.translate.instant('REGISTER.ERROR_GENERIC_1')}\n${this.translate.instant('REGISTER.ERROR_GENERIC_2')}`;
      const msg = untracked(() => this.errorMessage()) ?? fallback;
      const toast = await this.toastCtrl.create({
        message: msg,
        duration: 40000,
        position: 'top',
        cssClass: 'pm-toast-warning',
        icon: 'alert-circle',
        buttons: [{ icon: 'close', role: 'cancel' }],
      });
      await toast.present();
    });
  }

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
