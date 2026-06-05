import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import type { AuthStrategy } from './auth.strategy';
import type { AccessTokenResponse, LoginResponse } from '../models/api.models';
import { environment } from '../../../environments/environment';

@Injectable()
export class WebAuthStrategy implements AuthStrategy {
  private readonly http = inject(HttpClient);

  readonly httpOptions = { withCredentials: true };
  readonly platformHeader = 'web' as const;

  refresh(): Observable<AccessTokenResponse> {
    return this.http.post<AccessTokenResponse>(
      `${environment.apiUrl}/auth/refresh`,
      {},
      { withCredentials: true },
    );
  }

  async persistAfterLogin(_res: LoginResponse): Promise<void> {
    // no-op — the server already Set-Cookie'd the refresh token
  }

  async clear(): Promise<void> {
    // no-op — server clears the cookie on logout
  }
}
