import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { TranslateService } from '@ngx-translate/core';
import { from, of } from 'rxjs';

export const translationGuard: CanActivateFn = () => {
  const translate = inject(TranslateService);

  if (translate.currentLang) {
    return of(true);
  }

  return from(translate.use('en').toPromise().then(() => true));
};
