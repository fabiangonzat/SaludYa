import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AppointmentsService, AppointmentWithProfiles } from '../../services/appointments.service';
import { AvailabilityService } from '../../services/availability.service';

type AppointmentFilter = 'todas' | 'proximas' | 'pendientes' | 'completadas' | 'canceladas';

@Component({
  selector: 'app-appointments-page',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './appointments-page.html',
  styleUrl: './appointments-page.css',
})
export class AppointmentsPage {
  private readonly auth = inject(AuthService);
  readonly service = inject(AppointmentsService);
  readonly availability = inject(AvailabilityService);
  readonly user = this.auth.currentUser;
  readonly isDoctor = computed(() => this.user()?.role === 'doctor');
  readonly filter = signal<AppointmentFilter>('todas');
  readonly query = signal('');
  readonly calendarView = signal<'mes' | 'semana'>('mes');
  readonly calendarCursor = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  readonly selectedDate = signal('');
  readonly selected = signal<AppointmentWithProfiles | null>(null);
  readonly action = signal<'cancelar' | 'reprogramar' | ''>('');
  readonly reason = signal('');
  readonly newDate = signal('');
  readonly newTime = signal('');
  readonly message = signal('');
  readonly today = this.toYmd(new Date());
  readonly tabs: { id: AppointmentFilter; label: string }[] = [
    { id: 'todas', label: 'Todas' },
    { id: 'proximas', label: 'Próximas' },
    { id: 'pendientes', label: 'Pendientes' },
    { id: 'completadas', label: 'Completadas' },
    { id: 'canceladas', label: 'Canceladas' },
  ];

  readonly filtered = computed(() => {
    const text = this.query().trim().toLocaleLowerCase('es');
    return this.service.appointments()
      .filter((appointment) => {
        const statusMatch = this.filter() === 'todas'
          || (this.filter() === 'proximas' && this.isActive(appointment) && this.isFuture(appointment.date, appointment.time))
          || (this.filter() === 'pendientes' && appointment.status === 'pendiente')
          || (this.filter() === 'completadas' && appointment.status === 'completada')
          || (this.filter() === 'canceladas' && appointment.status === 'cancelada');
        const person = this.isDoctor() ? appointment.patient?.full_name ?? 'Paciente' : appointment.doctorName;
        return statusMatch && (!text || `${person} ${appointment.specialty} ${appointment.reason}`.toLocaleLowerCase('es').includes(text));
      })
      .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  });

  readonly upcoming = computed(() => this.service.appointments()
    .filter((appointment) => this.isActive(appointment) && this.isFuture(appointment.date, appointment.time))
    .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] ?? null);
  readonly pendingCount = computed(() => this.service.appointments().filter((a) => a.status === 'pendiente').length);
  readonly upcomingCount = computed(() => this.service.appointments().filter((a) => this.isActive(a) && this.isFuture(a.date, a.time)).length);
  readonly completedCount = computed(() => this.service.appointments().filter((a) => a.status === 'completada').length);
  readonly cancelledCount = computed(() => this.service.appointments().filter((a) => a.status === 'cancelada').length);

  readonly calendarDays = computed(() => {
    const cursor = this.calendarCursor();
    const dates: Date[] = [];
    if (this.calendarView() === 'semana') {
      const start = new Date(cursor);
      start.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
      for (let i = 0; i < 7; i++) {
        const date = new Date(start);
        date.setDate(start.getDate() + i);
        dates.push(date);
      }
    } else {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      first.setDate(1 - ((first.getDay() + 6) % 7));
      for (let i = 0; i < 42; i++) {
        const date = new Date(first);
        date.setDate(first.getDate() + i);
        dates.push(date);
      }
    }
    return dates.map((date) => {
      const key = this.toYmd(date);
      return {
        date,
        key,
        inMonth: date.getMonth() === cursor.getMonth(),
        appointments: this.service.appointments().filter((appointment) => appointment.date === key),
      };
    });
  });

  readonly appointmentsOnSelectedDate = computed(() => this.service.appointments()
    .filter((appointment) => appointment.date === this.selectedDate())
    .sort((a, b) => a.time.localeCompare(b.time)));

  constructor() {
    void this.service.load();
  }

  private toYmd(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private isActive(appointment: AppointmentWithProfiles): boolean {
    return ['pendiente', 'confirmada', 'reprogramada'].includes(appointment.status);
  }

  calendarTitle(): string {
    const cursor = this.calendarCursor();
    if (this.calendarView() === 'mes') {
      return new Intl.DateTimeFormat('es-PE', { month: 'long', year: 'numeric' }).format(cursor);
    }
    const start = new Date(cursor);
    start.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const formatter = new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' });
    return `${formatter.format(start)} – ${formatter.format(end)} ${end.getFullYear()}`;
  }

  localDate(value: string): Date {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  moveCalendar(delta: number): void {
    const cursor = new Date(this.calendarCursor());
    if (this.calendarView() === 'mes') {
      cursor.setMonth(cursor.getMonth() + delta, 1);
    } else {
      cursor.setDate(cursor.getDate() + delta * 7);
    }
    this.calendarCursor.set(cursor);
    this.selectedDate.set('');
  }

  setCalendarView(view: 'mes' | 'semana'): void {
    this.calendarView.set(view);
  }

  selectCalendarDay(key: string): void { this.selectedDate.set(key); }
  setFilter(value: AppointmentFilter): void { this.filter.set(value); }

  filterCount(filter: AppointmentFilter): number {
    if (filter === 'todas') return this.service.appointments().length;
    if (filter === 'proximas') return this.upcomingCount();
    if (filter === 'pendientes') return this.pendingCount();
    if (filter === 'completadas') return this.completedCount();
    return this.cancelledCount();
  }

  personName(appointment: AppointmentWithProfiles): string {
    return this.isDoctor() ? appointment.patient?.full_name ?? 'Paciente' : appointment.doctorName;
  }

  personInitials(appointment: AppointmentWithProfiles): string {
    const name = this.personName(appointment);
    return name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
  }

  open(appointment: AppointmentWithProfiles): void {
    this.selected.set(appointment);
    this.action.set('');
    this.message.set('');
    void this.availability.loadSlots(appointment.doctor_id);
  }

  close(): void { this.selected.set(null); this.action.set(''); this.message.set(''); }

  statusLabel(status: string): string {
    return ({
      pendiente: 'Pendiente de confirmación', confirmada: 'Confirmada', reprogramada: 'Reprogramada',
      'en-curso': 'En curso', completada: 'Completada', cancelada: 'Cancelada', 'no-asistio': 'No asistió',
    } as Record<string, string>)[status] ?? status;
  }

  canChange(appointment: AppointmentWithProfiles): boolean {
    return this.isActive(appointment) && this.isFuture(appointment.date, appointment.time);
  }

  private isFuture(date: string, time: string): boolean {
    const [year, month, day] = date.split('-').map(Number);
    const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime() > Date.now();
  }

  availableSlots() {
    const appointment = this.selected();
    return this.availability.slots().filter((slot) => !slot.is_taken
      && this.isFuture(slot.date, slot.time) && slot.modality === appointment?.modality);
  }

  slotDates(): string[] { return [...new Set(this.availableSlots().map((slot) => slot.date))].sort(); }
  slotTimes(): string[] { return this.availableSlots().filter((slot) => slot.date === this.newDate()).map((slot) => slot.time); }
  beginCancel(): void { this.action.set('cancelar'); this.reason.set(''); this.message.set(''); }
  beginReschedule(): void { this.action.set('reprogramar'); this.newDate.set(''); this.newTime.set(''); this.message.set(''); }

  async confirmAppointment(appointment: AppointmentWithProfiles): Promise<void> {
    const result = await this.service.updateStatus(appointment.id, 'confirmada');
    if (result.error) this.message.set(result.error);
  }

  async completeAppointment(appointment: AppointmentWithProfiles): Promise<void> {
    const result = await this.service.updateStatus(appointment.id, 'completada');
    if (result.error) this.message.set(result.error);
  }

  async cancel(): Promise<void> {
    const appointment = this.selected();
    if (!appointment) return;
    if (!this.reason().trim()) { this.message.set('Escribe el motivo de cancelación.'); return; }
    const result = await this.service.updateStatus(appointment.id, 'cancelada', { cancelReason: this.reason() });
    if (result.error) { this.message.set(result.error); return; }
    this.selected.set(this.service.appointments().find((item) => item.id === appointment.id) ?? null);
    this.action.set('');
  }

  async reschedule(): Promise<void> {
    const appointment = this.selected();
    if (!appointment) return;
    if (!this.newDate() || !this.newTime()) { this.message.set('Selecciona una fecha y hora disponibles.'); return; }
    const result = await this.service.reschedule(appointment.id, this.newDate(), this.newTime());
    if (result.error) { this.message.set(result.error); return; }
    this.selected.set(this.service.appointments().find((item) => item.id === appointment.id) ?? null);
    this.action.set('');
  }
}
