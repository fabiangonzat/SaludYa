import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RegistrationData {
  nombre: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  password: string;
}

@Injectable({ providedIn: 'root' })
export class RegistrationService {
  private http = inject(HttpClient);
  private readonly registerUrl = '/api/auth/register';

  register(data: RegistrationData): Observable<void> {
    return this.http.post<void>(this.registerUrl, data);
  }
}
