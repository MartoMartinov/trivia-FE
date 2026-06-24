import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import type {
  RegisterRequest,
  LoginResponse,
  StartSessionResponse,
  NextBatchResponse,
  SubmitAnswerRequest,
  SubmitAnswerResponse,
  SubmitSponsorAnswerRequest,
  SubmitSponsorAnswerResponse,
  SponsorTrackRequest,
  CompleteSessionResponse,
  SessionResultDto,
  LeaderboardResponse,
  LeaderboardScope,
  BoothDisplayResponse,
  EventConfigResponse,
  StaticPageResponse,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl;

  getEventConfig(): Observable<EventConfigResponse> {
    return this.http.get<EventConfigResponse>(`${this.base}/event-config`);
  }
  register(req: RegisterRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.base}/auth/register`, req);
  }

  startSession(): Observable<StartSessionResponse> {
    return this.http.post<StartSessionResponse>(
      `${this.base}/sessions/start`,
      {},
    );
  }

  fetchNextBatch(sessionId: number): Observable<NextBatchResponse> {
    return this.http.get<NextBatchResponse>(
      `${this.base}/sessions/${sessionId}/questions/next`,
    );
  }

  submitAnswer(
    sessionId: number,
    req: SubmitAnswerRequest,
  ): Observable<SubmitAnswerResponse> {
    return this.http.post<SubmitAnswerResponse>(
      `${this.base}/sessions/${sessionId}/answers`,
      req,
    );
  }

  submitSponsorAnswer(
    sessionId: number,
    req: SubmitSponsorAnswerRequest,
  ): Observable<SubmitSponsorAnswerResponse> {
    return this.http.post<SubmitSponsorAnswerResponse>(
      `${this.base}/sessions/${sessionId}/sponsor-answer`,
      req,
    );
  }

  trackSponsorClick(sessionId: number, req: SponsorTrackRequest): Observable<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(
      `${this.base}/sessions/${sessionId}/sponsor-track`,
      req,
    );
  }

  completeSession(sessionId: number): Observable<CompleteSessionResponse> {
    return this.http.post<CompleteSessionResponse>(
      `${this.base}/sessions/${sessionId}/complete`,
      {},
    );
  }

  getSessionResult(sessionId: number): Observable<SessionResultDto> {
    return this.http.get<SessionResultDto>(
      `${this.base}/sessions/${sessionId}/result`,
    );
  }

  getLeaderboard(
    scope: LeaderboardScope = 'today',
  ): Observable<LeaderboardResponse> {
    return this.http.get<LeaderboardResponse>(`${this.base}/leaderboard`, {
      params: { scope },
    });
  }

  getBoothDisplay(token: string): Observable<BoothDisplayResponse> {
    return this.http.get<BoothDisplayResponse>(`${this.base}/booth-display`, {
      params: { token },
    });
  }

  getPage(id: number): Observable<StaticPageResponse> {
    return this.http.get<StaticPageResponse>(`${this.base}/pages/${id}`);
  }
}
