import { Injectable, signal } from '@angular/core';
import { DemoAppointment } from '../pages/medicos/doctors.models';

const STORAGE_KEY = 'saludya_demo_appointments';

function readStored(): DemoAppointment[] {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DemoAppointment[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  readonly appointments = signal<DemoAppointment[]>(readStored());

  add(appointment: DemoAppointment): void {
    this.appointments.update((list) => [appointment, ...list]);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(this.appointments()));
  }
}
