import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { TranslateService } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { alertCircle, close } from 'ionicons/icons';
import { GameStore } from '../stores/game/game.store';

addIcons({ alertCircle, close });

const SESSION_ENDED_TOAST_DURATION_MS = 5000;

// Blocks /game and /sponsor once RegisterPage has flagged the session they depend on as
// abandoned — e.g. the player left mid-game, RegisterPage reset the store, and they hit
// browser "forward" to get back here. Checks specifically for 'abandoned' rather than
// requiring 'active', because a brand-new player's very first navigation into /game also
// has status 'idle' (the session only becomes 'active' once GamePage's own ngOnInit starts
// it) — treating that the same as an abandoned session would block every legitimate game start.
// Runs as an Angular route guard rather than an Ionic page-lifecycle hook because the target
// page's component instance may or may not be the one Ionic cached from before (its async
// view-cleanup timing decides that), so any check living in the component itself can't be
// relied on to run at all.
export const activeSessionGuard: CanActivateFn = () => {
  const gameStore = inject(GameStore);
  const router = inject(Router);

  if (gameStore.status() !== 'abandoned') {
    return true;
  }

  const toastCtrl = inject(ToastController);
  const translate = inject(TranslateService);
  presentSessionEndedToast(toastCtrl, translate);

  return router.createUrlTree(['/register']);
};

async function presentSessionEndedToast(toastCtrl: ToastController, translate: TranslateService): Promise<void> {
  const toast = await toastCtrl.create({
    message: `${translate.instant('GAME.SESSION_ENDED_1')}\n${translate.instant('GAME.SESSION_ENDED_2')}`,
    duration: SESSION_ENDED_TOAST_DURATION_MS,
    position: 'top',
    cssClass: 'pm-toast-warning',
    icon: 'alert-circle',
    buttons: [{ icon: 'close', role: 'cancel' }],
  });
  await toast.present();
}
