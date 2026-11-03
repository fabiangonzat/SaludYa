import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { WELLNESS_STORAGE_PREFIX } from '../pages/bienestar/wellness.models';
import { HISTORY_STORAGE_PREFIX } from '../pages/historial/history.models';
import { APPOINTMENT_STORAGE_PREFIX } from './appointments.models';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

const TOKEN_KEY = 'saludya_token';
const EMAIL_KEY = 'saludya_demo_email';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // Cambia por la URL real de tu backend (Node/Express, etc.)
  private readonly loginUrl = '/api/auth/login';

  loginDemo(email: string, remember: boolean): void {
    this.persistSession(`demo-${Date.now()}`, remember, email);
  }

  login(credentials: LoginCredentials, remember: boolean): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, credentials).pipe(
      tap(({ token }) => {
        // "Recordarme": sesión persistente; si no, dura solo la pestaña
        this.persistSession(token, remember);
      })
    );
  }

  logout(): void {
    this.clearStorage(localStorage);
    this.clearStorage(sessionStorage);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('saludya:logout'));
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }

  private persistSession(token: string, remember: boolean, email?: string): void {
    const keep = remember ? localStorage : sessionStorage;
    const drop = remember ? sessionStorage : localStorage;
    keep.setItem(TOKEN_KEY, token);
    if (email !== undefined) {
      keep.setItem(EMAIL_KEY, email);
    }
    this.clearStorage(drop);
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('saludya:session-changed'));
  }

  private clearStorage(storage: Storage): void {
    storage.removeItem(TOKEN_KEY);
    storage.removeItem(EMAIL_KEY);
    const wellnessKeys: string[] = [];
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(WELLNESS_STORAGE_PREFIX) || key?.startsWith(HISTORY_STORAGE_PREFIX) || key?.startsWith(APPOINTMENT_STORAGE_PREFIX)) wellnessKeys.push(key);
    }
    wellnessKeys.forEach((key) => storage.removeItem(key));
  }
}
