import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { WellnessService } from '../bienestar/wellness.service';
import { MetricType, WellnessMeasurement } from '../bienestar/wellness.models';
import { AppointmentsService } from '../../services/appointments.service';
import { MedicalAppointment } from '../../services/appointments.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, DatePipe],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly wellness = inject(WellnessService);
  readonly appointments = inject(AppointmentsService);
  readonly patientName = signal('');
  readonly today = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  readonly hasWellnessRecords = computed(() => {
    const data = this.wellness.state();
    return data.measurements.length + data.habits.length + data.goals.length + data.moods.length > 0;
  });
  readonly latestWeight = computed(() => this.latestOf('peso'));
  readonly latestPressure = computed(() => this.latestOf('presion'));
  readonly latestHeartRate = computed(() => this.latestOf('frecuencia'));
  readonly completedHabitsToday = computed(() => {
    const key = this.todayKey();
    return this.wellness.state().habits.filter((habit) => habit.checkIns.includes(key)).length;
  });
  readonly habitCount = computed(() => this.wellness.state().habits.length);
  readonly wellnessUpdated = computed(() => this.wellness.lastUpdated());
  readonly upcomingAppointment = computed(() => this.appointments.appointments().filter((a) => ['pendiente','confirmada','reprogramada'].includes(a.status) && a.date >= new Date().toISOString().slice(0,10)).sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] ?? null);
  appointmentStatus(appointment: MedicalAppointment): string { return appointment.status === 'pendiente' ? 'Pendiente de confirmación · demo' : appointment.status === 'reprogramada' ? 'Reprogramada · demo' : 'Confirmada · demo'; }
  readonly metrics = [
    { title: 'Próximas citas', value: '—', hint: 'Conecta tus citas para verlas aquí', icon: 'calendar' },
    { title: 'Consultas realizadas', value: '—', hint: 'Tu historial de atención', icon: 'check' },
    { title: 'Mensajes pendientes', value: '—', hint: 'Mensajes de tus especialistas', icon: 'message' },
    { title: 'Médicos disponibles', value: '—', hint: 'Especialistas de SaludYA', icon: 'users' },
  ];

  private todayKey(): string {
    const date = new Date();
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  private latestOf(type: MetricType): WellnessMeasurement | null {
    return this.wellness.state().measurements.filter((item) => item.type === type).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null;
  }
}
