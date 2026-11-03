import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';

const TOKEN_KEY = 'saludya_token';
const EMAIL_KEY = 'saludya_demo_email';

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('al iniciar sesión sin Recordarme, no reutiliza un token persistente anterior', () => {
    service.loginDemo('ana@saludya.test', true);
    expect(localStorage.getItem(TOKEN_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();

    service.loginDemo('bruno@saludya.test', false);

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(EMAIL_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBeTruthy();
    expect(sessionStorage.getItem(EMAIL_KEY)).toBe('bruno@saludya.test');
    expect(service.token).toBe(sessionStorage.getItem(TOKEN_KEY));
    expect(service.isLoggedIn).toBe(true);
  });

  it('al iniciar sesión con Recordarme, no deja sesión huérfana en sessionStorage', () => {
    service.loginDemo('ana@saludya.test', false);
    service.loginDemo('bruno@saludya.test', true);

    expect(sessionStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(TOKEN_KEY)).toBeTruthy();
    expect(localStorage.getItem(EMAIL_KEY)).toBe('bruno@saludya.test');
    expect(service.token).toBe(localStorage.getItem(TOKEN_KEY));
  });

  it('login() también limpia el almacén que no corresponde a Recordarme', () => {
    localStorage.setItem(TOKEN_KEY, 'token-viejo');
    const http = TestBed.inject(HttpTestingController);

    service.login({ email: 'ana@saludya.test', password: 'secret' }, false).subscribe();

    const req = http.expectOne('/api/auth/login');
    req.flush({ token: 'token-nuevo' });

    expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(TOKEN_KEY)).toBe('token-nuevo');
    expect(service.token).toBe('token-nuevo');
    http.verify();
  });
});
