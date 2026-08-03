import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  eyeOffOutline,
  eyeOutline,
  keyOutline,
  lockClosedOutline,
  mailOutline,
} from 'ionicons/icons';

import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { apiErrorMessage } from '../../core/http/api-error';
import { ApiService } from '../../core/services/api.service';
import { AuthStore } from '../../core/stores/auth/auth.store';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

addIcons({
  checkmarkCircle,
  eyeOffOutline,
  eyeOutline,
  keyOutline,
  lockClosedOutline,
  mailOutline,
});

/** The three reset calls, plus the terminal confirmation, as one linear wizard. */
type Step = 'email' | 'code' | 'password' | 'done';

/** Number of digits in the emailed reset code (backend spec). */
const CODE_LENGTH = 6;

/** Group validator — the confirmation field has to repeat the new password exactly. */
function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirmPassword } = group.value as {
    password: string;
    confirmPassword: string;
  };
  // Stay silent until something has been typed, so the field isn't red before it's touched.
  if (!confirmPassword) return null;
  return password === confirmPassword ? null : { mismatch: true };
}

/**
 * Password reset for a returning player who can't remember their password.
 *
 * Deliberately reachable without a booth QR token — unlike registration, resetting a
 * password proves nothing about being at the event, and the reset code itself is the
 * credential. The QR gate still applies when the player comes back to log in.
 *
 * Talks to ApiService directly rather than through a store: the flow is a one-shot,
 * unauthenticated wizard whose state dies with the page, so none of it belongs in
 * app-wide state (same reasoning as the unsubscribe/resubscribe pages). AuthStore is the
 * one exception, and only to discard state — see submitNewPassword.
 */
@Component({
  selector: 'app-forgotten-password',
  templateUrl: 'forgotten-password.page.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, ReactiveFormsModule, TranslatePipe, PmHeaderComponent, RouterLink],
})
export class ForgottenPasswordPage implements OnInit {
  private readonly api = inject(ApiService);
  private readonly authStore = inject(AuthStore);
  private readonly translate = inject(TranslateService);

  readonly codeLength = CODE_LENGTH;

  readonly step = signal<Step>('email');
  readonly isPending = signal(false);
  readonly errorMessage = signal<string | null>(null);

  /** Reveal toggles, one per field so they don't leak state across each other. */
  readonly showPassword = signal(false);
  readonly showConfirmPassword = signal(false);

  /** Set right after a re-send so the code step can confirm it inline. */
  readonly codeResent = signal(false);

  /**
   * The address the code went to — shown back on the code step, and sent alongside the
   * code on verify. Mirrored into a signal purely so the template can render it.
   */
  readonly sentToEmail = signal('');

  /** Proof the code was verified. Held only in memory, for the one call that consumes it. */
  private resetToken = '';

  readonly emailForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
  });

  readonly codeForm = new FormGroup({
    code: new FormControl('', [
      Validators.required,
      Validators.pattern(new RegExp(`^\\d{${CODE_LENGTH}}$`)),
    ]),
  });

  readonly passwordForm = new FormGroup(
    {
      password: new FormControl('', [Validators.required, Validators.minLength(6)]),
      confirmPassword: new FormControl('', [Validators.required]),
    },
    { validators: passwordsMatch },
  );

  async ngOnInit(): Promise<void> {
    // Pre-fill from the stored registration profile — a player who has played on this
    // device is almost certainly resetting that same account.
    try {
      const saved = await SecureStorage.get(STORAGE_KEYS.REGISTRATION);
      if (typeof saved === 'string') {
        const data = JSON.parse(saved);
        if (data?.email) this.emailForm.patchValue({ email: data.email });
      }
    } catch {}
  }

  /** Step 1 — ask the backend to mail a reset code. */
  requestCode(): void {
    if (this.emailForm.invalid || this.isPending()) return;

    const email = this.emailForm.getRawValue().email!.trim();
    this.begin();

    this.api.forgottenPassword({ email }).subscribe({
      next: () => {
        this.sentToEmail.set(email);
        this.isPending.set(false);
        this.step.set('code');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  /** Mail a fresh code without leaving the code step (the previous one may have expired). */
  resendCode(): void {
    if (this.isPending()) return;
    this.begin();
    this.codeResent.set(false);

    this.api.forgottenPassword({ email: this.sentToEmail() }).subscribe({
      next: () => {
        this.isPending.set(false);
        this.codeResent.set(true);
        this.codeForm.reset();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  /** Step 2 — trade the emailed code for a short-lived reset token. */
  verifyCode(): void {
    if (this.codeForm.invalid || this.isPending()) return;

    this.begin();
    this.codeResent.set(false);

    this.api
      .verifyResetCode({ email: this.sentToEmail(), code: this.codeForm.getRawValue().code! })
      .subscribe({
        next: (res) => {
          this.resetToken = res.resetToken;
          this.isPending.set(false);
          this.step.set('password');
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  /**
   * Step 3 — set the new password against the verified token.
   *
   * A successful reset revokes every token on the account server-side, so the session this device
   * may still be holding (the access token outlives a finished game, and getting here is in-app
   * routing) is dead the moment this returns. Dropping it locally keeps the two in step: left in
   * place, it still reads as a valid login to the guards, and the next authenticated call would go
   * out with a credential the API has already thrown away.
   */
  submitNewPassword(): void {
    if (this.passwordForm.invalid || this.isPending()) return;

    this.begin();

    this.api
      .resetPassword({
        resetToken: this.resetToken,
        password: this.passwordForm.getRawValue().password!,
      })
      .subscribe({
        next: async () => {
          // The token is single-use and the password is already changed — drop both so
          // nothing sensitive lingers behind the success screen.
          this.resetToken = '';
          this.passwordForm.reset();
          await this.authStore.logout();
          this.isPending.set(false);
          this.step.set('done');
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  /** Back out to the email step to retry with a different address. */
  changeEmail(): void {
    if (this.isPending()) return;
    this.codeForm.reset();
    this.codeResent.set(false);
    this.errorMessage.set(null);
    this.step.set('email');
  }

  private begin(): void {
    this.errorMessage.set(null);
    this.isPending.set(true);
  }

  /**
   * Surface the backend's own wording where it has any (it is already player-facing copy,
   * and the rate-limit case gets rewritten by apiErrorMessage), falling back to the shared
   * generic message.
   */
  private fail(err: unknown): void {
    const fallback = `${this.translate.instant('REGISTER.ERROR_GENERIC_1')} ${this.translate.instant('REGISTER.ERROR_GENERIC_2')}`;
    this.errorMessage.set(apiErrorMessage(err, this.translate) ?? fallback);
    this.isPending.set(false);
  }
}
