import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { from, Observable, switchMap, throwError } from 'rxjs';
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
      switchMap((token) => {
        // With nothing stored there is nothing to refresh, and the request would come back 401
        // anyway — but /auth/refresh is rate-limited per IP, so on a shared network that wasted
        // round trip spends a slot every other player needs. Fail locally instead, shaped like
        // the 401 the server would have sent so callers keep treating it as a dead session.
        if (typeof token !== 'string' || !token) {
          return throwError(() => new HttpErrorResponse({
            status: 401,
            statusText: 'Unauthorized',
            url: `${environment.apiUrl}/auth/refresh`,
            error: { message: 'No refresh token stored.' },
          }));
        }

        return this.http.post<AccessTokenResponse>(
          `${environment.apiUrl}/auth/refresh`,
          { refreshToken: token },
        );
      }),
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
