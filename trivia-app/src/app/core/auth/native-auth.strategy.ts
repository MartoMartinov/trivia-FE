import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { AuthStrategy } from './auth.strategy.model';
import type { AccessTokenResponse, LoginResponse } from '../models/api.models';
import { STORAGE_KEYS } from '../constants/storage-keys';
import { environment } from '../../../environments/environment';

@Injectable()
export class NativeAuthStrategy implements AuthStrategy {
  private readonly http = inject(HttpClient);

  readonly httpOptions = { withCredentials: false };
  readonly platformHeader = 'native' as const;

  refresh(): Observable<AccessTokenResponse> {
    return from(SecureStorage.get(STORAGE_KEYS.REFRESH_TOKEN)).pipe(
      switchMap((token) =>
        this.http.post<AccessTokenResponse>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken: typeof token === 'string' ? token : null },
        ),
      ),
    );
  }

  async persistAfterLogin(res: LoginResponse): Promise<void> {
    if (res.refreshToken) {
      await SecureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, res.refreshToken);
    }
  }

  async clear(): Promise<void> {
    await SecureStorage.remove(STORAGE_KEYS.REFRESH_TOKEN);
  }
}
