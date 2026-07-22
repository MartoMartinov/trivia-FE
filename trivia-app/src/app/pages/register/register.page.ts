import { ChangeDetectionStrategy, Component, computed, effect, inject, OnDestroy, OnInit, signal, untracked } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { DomSanitizer } from '@angular/platform-browser';
import { IonContent, IonIcon, ToastController } from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';

import { SecureStorage } from '@aparajita/capacitor-secure-storage';

import { STORAGE_KEYS } from '../../core/constants/storage-keys';
import { ApiService } from '../../core/services/api.service';
import { AppConfigStore } from '../../core/stores/app-config/app-config.store';
import { AuthStore } from '../../core/stores/auth/auth.store';
import { BoothTokenStore } from '../../core/stores/booth-token/booth-token.store';
import { PlayerStore } from '../../core/stores/player/player.store';
import { sanitizeAdminHtml } from '../../shared/utils/sanitize-admin-html';
import { addIcons } from 'ionicons';
import {
  alertCircle,
  close,
  eyeOutline,
  eyeOffOutline,
  personOutline,
  mailOutline,
  businessOutline,
  callOutline,
  lockClosedOutline,
} from 'ionicons/icons';
import { PmHeaderComponent } from '../../shared/components/pm-header/pm-header.component';

addIcons({
  alertCircle,
  close,
  eyeOutline,
  eyeOffOutline,
  personOutline,
  mailOutline,
  businessOutline,
  callOutline,
  lockClosedOutline,
});

@Component({
  selector: 'app-register',
  templateUrl: 'register.page.html',
  styleUrls: ['register.page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonContent, IonIcon, ReactiveFormsModule, TranslatePipe, PmHeaderComponent, RouterLink],
})
export class RegisterPage implements OnInit, OnDestroy {
  private authCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly api = inject(ApiService);
  private readonly appConfigStore = inject(AppConfigStore);
  private readonly authStore = inject(AuthStore);
  private readonly boothTokenStore = inject(BoothTokenStore);
  private readonly playerStore = inject(PlayerStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toastCtrl = inject(ToastController);
  private readonly translate = inject(TranslateService);
  private readonly sanitizer = inject(DomSanitizer);

  readonly isPending = this.authStore.isPending;
  readonly hasError = this.authStore.hasError;
  readonly errorMessage = this.authStore.errorMessage;

  /**
   * Landing hero copy served by the admin panel (event-config). The body's event specifics
   * (session length, prize count) are rendered server-side so they track the admin config.
   * Both fall back to bundled i18n copy when the backend doesn't provide them.
   */
  readonly landingHeadline = this.appConfigStore.landingHeadline;
  readonly landingBody = this.appConfigStore.landingBody;
  /**
   * HTML-sanitized (DOMPurify, `style` attribute allowed) versions for [innerHTML] binding —
   * Angular's built-in sanitizer strips `style` outright, which admin color styling relies on.
   */
  readonly landingHeadlineHtml = computed(() => sanitizeAdminHtml(this.sanitizer, this.landingHeadline()));
  readonly landingBodyHtml = computed(() => sanitizeAdminHtml(this.sanitizer, this.landingBody()));

  /** No booth QR token in the URL at all — block registration outright (spec F9: registration is only reachable via the on-screen QR). */
  readonly tokenBlocked = signal(false);

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

  /** Which form the single auth page currently shows. Registration is the default entry point. */
  readonly mode = signal<'register' | 'login'>('register');

  /** Reveal-password toggles, one per form so they don't leak state across the switch. */
  readonly showRegisterPassword = signal(false);
  readonly showLoginPassword = signal(false);

  readonly form = new FormGroup({
    firstName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    lastName: new FormControl('', [Validators.required, Validators.minLength(2)]),
    email: new FormControl('', [Validators.required, Validators.email]),
    company: new FormControl('', [Validators.required]),
    // Phone is required (spec §3.2). Pattern allows digits, spaces, and common separators.
    phone: new FormControl('', [Validators.required, Validators.pattern(/^[+]?[\d\s()-]{7,}$/)]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    consent: new FormControl(false, [Validators.requiredTrue]),
  });

  readonly loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
  });

  async ngOnInit(): Promise<void> {
    try {
      const saved = await SecureStorage.get(STORAGE_KEYS.REGISTRATION);
      if (typeof saved === 'string') {
        const data = JSON.parse(saved);
        this.form.patchValue(data);
        // Pre-fill the returning player's email on the login form too.
        if (data?.email) this.loginForm.patchValue({ email: data.email });
      }
    } catch {}

    await this.checkRegistrationToken();
  }

  /** Flip between register and login without losing either form's state; clear any stale error toast trigger. */
  switchMode(target: 'register' | 'login'): void {
    this.mode.set(target);
  }

  /**
   * Two independent query params gate registration:
   * - `boothToken` — durable, admin-issued token for kiosk tablets (spec: stays valid all day).
   *   Checked first and silently: a missing/failed boothToken is expected on a personal-phone
   *   scan, so it never shows a toast — it just falls through to `token`.
   * - `token` — the per-player QR that rotates every 5-10 min (spec F9). Checked second; if this
   *   also fails, the player really has no valid way in, so we warn and block.
   */
  private async checkRegistrationToken(): Promise<void> {
    const hadBoothToken = await this.tryBoothToken();
    if (!hadBoothToken) await this.tryPlayerToken();
    // Both token sources read their values from the snapshot synchronously above, so the
    // credential is safe to wipe from the URL now — leaving a clean /register in history.
    this.stripTokensFromUrl();
  }

  /**
   * Remove the one-time `token`/`boothToken` credentials from the address bar once consumed,
   * so the secret doesn't linger in browser history, bookmarks, or a shared/copied URL.
   * Uses replaceUrl so it swaps the current history entry rather than adding one.
   */
  private stripTokensFromUrl(): void {
    const params = this.route.snapshot.queryParamMap;
    if (!params.has('token') && !params.has('boothToken')) return;
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {},
      replaceUrl: true,
    });
  }

  private async tryBoothToken(): Promise<boolean> {
    let boothToken = this.route.snapshot.queryParamMap.get('boothToken');

    if (!boothToken) {
      await this.boothTokenStore.restore();
      boothToken = this.boothTokenStore.boothToken();
    }

    if (!boothToken) return false;

    try {
      const res = await firstValueFrom(this.api.verifyRegistrationToken(boothToken));
      if (res.valid) {
        this.boothTokenStore.set(boothToken);
        return true;
      }
    } catch {}

    this.boothTokenStore.clear();
    return false;
  }

  private async tryPlayerToken(): Promise<void> {
    const token = this.route.snapshot.queryParamMap.get('token');

    if (!token) {
      this.tokenBlocked.set(true);
      this.showTokenExpiredToast();
      return;
    }

    this.api.verifyRegistrationToken(token).subscribe({
      next: (res) => {
        if (!res.valid) {
          this.tokenBlocked.set(true);
          this.showTokenExpiredToast();
        }
      },
      error: () => {
        this.tokenBlocked.set(true);
        this.showTokenExpiredToast();
      },
    });
  }

  private async showTokenExpiredToast(): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: `${this.translate.instant('REGISTER.TOKEN_EXPIRED_1')}\n${this.translate.instant('REGISTER.TOKEN_EXPIRED_2')}`,
      duration: 40000,
      position: 'top',
      cssClass: 'pm-toast-warning',
      icon: 'alert-circle',
      buttons: [{ icon: 'close', role: 'cancel' }],
    });
    await toast.present();
  }

  ngOnDestroy(): void {
    if (this.authCheckInterval) clearInterval(this.authCheckInterval);
  }

  submit(): void {
    if (this.form.invalid || this.isPending() || this.tokenBlocked()) return;

    const { firstName, lastName, email, company, phone, password, consent } = this.form.getRawValue();

    // Persist the profile (minus password) so a returning player's registration is pre-filled next time.
    SecureStorage.set(STORAGE_KEYS.REGISTRATION, JSON.stringify({ firstName, lastName, email, company, phone })).catch(() => {});

    this.authStore.register({
      firstName: firstName!,
      lastName: lastName!,
      email: email!,
      company: company!,
      phone: phone ?? '',
      password: password!,
      consent: consent!,
    });

    this.watchAuthAndNavigate();
  }

  loginSubmit(): void {
    if (this.loginForm.invalid || this.isPending() || this.tokenBlocked()) return;

    const { email, password } = this.loginForm.getRawValue();

    this.authStore.login({ email: email!, password: password! });

    this.watchAuthAndNavigate();
  }

  /** Poll the auth store until authentication lands, then hand the player to PlayerStore and enter the game. */
  private watchAuthAndNavigate(): void {
    if (this.authCheckInterval) return;
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
