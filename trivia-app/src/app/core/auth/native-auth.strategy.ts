import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { from, Observable, switchMap } from 'rxjs';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';
import type { AuthStrategy } from './auth.strategy.model';
import type { AccessTokenResponse, LoginResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';

const REFRESH_TOKEN_KEY = 'pm_refresh_token';

@Injectable()
export class NativeAuthStrategy implements AuthStrategy {
  private readonly http = inject(HttpClient);

  readonly httpOptions = { withCredentials: false };
  readonly platformHeader = 'native' as const;

  refresh(): Observable<AccessTokenResponse> {
    return from(SecureStorage.get(REFRESH_TOKEN_KEY)).pipe(
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
      await SecureStorage.set(REFRESH_TOKEN_KEY, res.refreshToken);
    }
  }

  async clear(): Promise<void> {
    await SecureStorage.remove(REFRESH_TOKEN_KEY);
  }
}
