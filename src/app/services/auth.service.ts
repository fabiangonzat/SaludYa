import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
}

const TOKEN_KEY = 'saludya_token';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);

  // Cambia por la URL real de tu backend (Node/Express, etc.)
  private readonly loginUrl = '/api/auth/login';

  loginDemo(email: string, remember: boolean): void {
    const storage = remember ? localStorage : sessionStorage;
    storage.setItem(TOKEN_KEY, `demo-${Date.now()}`);
    storage.setItem('saludya_demo_email', email);
  }

  login(credentials: LoginCredentials, remember: boolean): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(this.loginUrl, credentials).pipe(
      tap(({ token }) => {
        // "Recordarme": sesión persistente; si no, dura solo la pestaña
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem(TOKEN_KEY, token);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem('saludya_demo_email');
    sessionStorage.removeItem('saludya_demo_email');
  }

  get token(): string | null {
    return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
  }

  get isLoggedIn(): boolean {
    return !!this.token;
  }
}
