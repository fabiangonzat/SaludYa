import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { APPOINTMENT_STORAGE_PREFIX, AppointmentChange, MedicalAppointment, NewAppointment } from './appointments.models';

export { APPOINTMENT_STORAGE_PREFIX } from './appointments.models';

function sessionSuffix(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function toTimestamp(date: string, time: string): number {
  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute).getTime();
}

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly auth = inject(AuthService);
  private readonly storageKey = () => `${APPOINTMENT_STORAGE_PREFIX}${sessionSuffix(this.auth.token ?? 'sin-sesion')}`;
  readonly appointments = signal<MedicalAppointment[]>(this.readStored());
  readonly demo = true;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('saludya:session-changed', () => this.appointments.set(this.readStored()));
      window.addEventListener('saludya:logout', () => this.appointments.set([]));
    }
  }

  private readStored(): MedicalAppointment[] {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(this.storageKey()) ?? '[]');
      return Array.isArray(parsed) ? parsed as MedicalAppointment[] : [];
    } catch { return []; }
  }

  private persist(next: MedicalAppointment[]): void {
    this.appointments.set(next);
    try { sessionStorage.setItem(this.storageKey(), JSON.stringify(next)); } catch { /* The in-memory demo remains available if storage is full. */ }
  }

  hasSlot(doctorId: string, date: string, time: string, exceptId?: string): boolean {
    return this.appointments().some((appointment) => appointment.id !== exceptId && appointment.doctorId === doctorId && appointment.date === date && appointment.time === time && appointment.status !== 'cancelada');
  }

  create(input: NewAppointment): MedicalAppointment | null {
    if (!input.reason.trim() || !input.doctorId || toTimestamp(input.date, input.time) <= Date.now() || this.hasSlot(input.doctorId, input.date, input.time)) return null;
    const at = new Date().toISOString();
    const appointment: MedicalAppointment = {
      ...input, id: `demo-appointment-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: at, updatedAt: at, status: 'pendiente', demo: true,
      changes: [{ action: 'creada', at, toDate: input.date, toTime: input.time }],
    };
    this.persist([appointment, ...this.appointments()]);
    return appointment;
  }

  cancel(id: string, reason: string): MedicalAppointment | null {
    const current = this.appointments().find((appointment) => appointment.id === id);
    if (!current || !['pendiente', 'confirmada', 'reprogramada'].includes(current.status) || toTimestamp(current.date, current.time) <= Date.now()) return null;
    const at = new Date().toISOString();
    const change: AppointmentChange = { action: 'cancelada', at, fromDate: current.date, fromTime: current.time, note: reason.trim() };
    const updated = { ...current, status: 'cancelada' as const, cancelReason: reason.trim(), updatedAt: at, changes: [...current.changes, change] };
    this.persist(this.appointments().map((appointment) => appointment.id === id ? updated : appointment));
    return updated;
  }

  reschedule(id: string, date: string, time: string): MedicalAppointment | null {
    const current = this.appointments().find((appointment) => appointment.id === id);
    if (!current || !['pendiente', 'confirmada', 'reprogramada'].includes(current.status) || toTimestamp(current.date, current.time) <= Date.now() || toTimestamp(date, time) <= Date.now() || this.hasSlot(current.doctorId, date, time, id)) return null;
    const at = new Date().toISOString();
    const change: AppointmentChange = { action: 'reprogramada', at, fromDate: current.date, fromTime: current.time, toDate: date, toTime: time };
    const updated = { ...current, date, time, status: 'reprogramada' as const, updatedAt: at, changes: [...current.changes, change] };
    this.persist(this.appointments().map((appointment) => appointment.id === id ? updated : appointment));
    return updated;
  }
}
