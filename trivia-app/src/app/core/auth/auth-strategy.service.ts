import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { Observable } from 'rxjs';
import { WebAuthStrategy } from './web-auth.strategy';
import { NativeAuthStrategy } from './native-auth.strategy';
import type { AuthStrategy } from './auth.strategy';
import type { AccessTokenResponse, LoginResponse } from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthStrategyService implements AuthStrategy {
  private readonly strategy: AuthStrategy = Capacitor.isNativePlatform()
    ? new NativeAuthStrategy()
    : new WebAuthStrategy();

  get httpOptions() { return this.strategy.httpOptions; }
  get platformHeader() { return this.strategy.platformHeader; }

  refresh(): Observable<AccessTokenResponse> {
    return this.strategy.refresh();
  }

  persistAfterLogin(res: LoginResponse): Promise<void> {
    return this.strategy.persistAfterLogin(res);
  }

  clear(): Promise<void> {
    return this.strategy.clear();
  }
}
