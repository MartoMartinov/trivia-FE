import { Observable } from 'rxjs';
import type { AccessTokenResponse, LoginResponse } from '../models/api.models';

export interface AuthStrategy {
  refresh(): Observable<AccessTokenResponse>;
  persistAfterLogin(res: LoginResponse): Promise<void>;
  clear(): Promise<void>;
  readonly httpOptions: { withCredentials: boolean };
  readonly platformHeader: 'web' | 'native';
}
