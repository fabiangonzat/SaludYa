import { Injectable, InjectionToken, inject, signal } from '@angular/core';
import { Observable, defer, delay, of, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import { createDemoDoctors } from './doctors.catalog';
import { Doctor } from './doctors.models';

export interface DoctorsApi {
  list(): Observable<Doctor[]>;
  getById(id: string): Observable<Doctor>;
  occupySlot(doctorId: string, date: string, time: string): Observable<Doctor>;
}

export const DOCTORS_API = new InjectionToken<DoctorsApi>('DOCTORS_API');

function cloneDoctors(source: Doctor[]): Doctor[] {
  return source.map((doctor) => ({
    ...doctor,
    education: [...doctor.education],
    languages: [...doctor.languages],
    conditions: [...doctor.conditions],
    modalities: [...doctor.modalities],
    reviews: doctor.reviews.map((review) => ({ ...review })),
    slots: doctor.slots.map((slot) => ({ ...slot })),
  }));
}

function createDemoApi(): DoctorsApi {
  let catalog = cloneDoctors(createDemoDoctors());
  const lag = <T>(fn: () => T) => defer(() => of(fn())).pipe(delay(380));
  return {
    list: () => lag(() => cloneDoctors(catalog)),
    getById: (id) =>
      lag(() => {
        const doctor = catalog.find((item) => item.id === id);
        if (!doctor) throw new Error('not-found');
        return cloneDoctors([doctor])[0];
      }),
    occupySlot: (doctorId, date, time) =>
      lag(() => {
        const doctor = catalog.find((item) => item.id === doctorId);
        if (!doctor) throw new Error('not-found');
        const slot = doctor.slots.find((item) => item.date === date && item.time === time && !item.taken);
        if (!slot) throw new Error('slot-taken');
        slot.taken = true;
        catalog = catalog.map((item) => (item.id === doctorId ? { ...doctor, slots: doctor.slots.map((s) => ({ ...s })) } : item));
        return cloneDoctors([doctor])[0];
      }),
  };
}

@Injectable({ providedIn: 'root' })
export class DoctorsService {
  private readonly injected = inject(DOCTORS_API, { optional: true });
  private readonly api: DoctorsApi = this.injected ?? createDemoApi();
  readonly demo = !this.injected;
  readonly doctors = signal<Doctor[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.list().subscribe({
      next: (doctors) => {
        this.doctors.set(doctors);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No pudimos cargar el directorio médico. Inténtalo nuevamente.');
        this.loading.set(false);
      },
    });
  }

  getById(id: string): Observable<Doctor> {
    return this.api.getById(id);
  }

  occupySlot(doctorId: string, date: string, time: string): Observable<Doctor> {
    return this.api.occupySlot(doctorId, date, time).pipe(
      tap((updated) => {
        this.doctors.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
      }),
    );
  }
}

export function doctorsApiNotFound(): Observable<never> {
  return throwError(() => new Error('not-found'));
}
