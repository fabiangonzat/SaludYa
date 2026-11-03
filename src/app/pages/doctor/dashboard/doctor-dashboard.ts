import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { NgIf, NgFor, DatePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../services/auth.service';
import { AppointmentsService, AppointmentWithProfiles } from '../../../services/appointments.service';
import { DoctorsService } from '../../medicos/doctors.service';
import { AvailabilityService } from '../../../services/availability.service';

@Component({
  selector: 'app-doctor-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, NgClass, RouterLink],
  templateUrl: './doctor-dashboard.html',
  styleUrl: './doctor-dashboard.css',
})
export class DoctorDashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly doctorsService = inject(DoctorsService);
  private readonly availabilityService = inject(AvailabilityService);

  readonly user = this.auth.currentUser;
  readonly loading = this.appointmentsService.loading;
  readonly allAppointments = this.appointmentsService.appointments;

  doctorId = signal<string | null>(null);

  readonly today = new Date().toISOString().slice(0, 10);

  readonly todayAppointments = computed(() =>
    this.allAppointments().filter((a) => a.date === this.today).sort((a, b) => a.time.localeCompare(b.time))
  );
  readonly upcomingAppointments = computed(() =>
    this.allAppointments().filter((a) => a.date > this.today && a.status !== 'cancelada').slice(0, 5)
  );
  readonly stats = computed(() => {
    const all = this.allAppointments();
    return {
      total: all.length,
      pending: all.filter((a) => a.status === 'pendiente').length,
      confirmed: all.filter((a) => a.status === 'confirmada').length,
      completed: all.filter((a) => a.status === 'completada').length,
      todayCount: this.todayAppointments().length,
    };
  });

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser();
    if (user) {
      const doctor = await this.doctorsService.getByProfileId(user.id);
      if (doctor) {
        this.doctorId.set(doctor.id);
        await this.availabilityService.loadAvailability(doctor.id);
      }
    }
    await this.appointmentsService.load();
    this.appointmentsService.subscribeRealtime();
  }

  ngOnDestroy(): void {
    this.appointmentsService.unsubscribeRealtime();
  }

  async confirmAppointment(id: string): Promise<void> {
    await this.appointmentsService.updateStatus(id, 'confirmada');
  }

  async completeAppointment(id: string): Promise<void> {
    await this.appointmentsService.updateStatus(id, 'completada');
  }

  async cancelAppointment(id: string): Promise<void> {
    const reason = prompt('Motivo de cancelación:');
    if (reason !== null) {
      await this.appointmentsService.updateStatus(id, 'cancelada', { cancelReason: reason });
    }
  }

  statusLabel(status: AppointmentWithProfiles['status']): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente', confirmada: 'Confirmada', reprogramada: 'Reprogramada',
      'en-curso': 'En curso', completada: 'Completada', cancelada: 'Cancelada', 'no-asistio': 'No asistió',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      pendiente: 'badge--warning', confirmada: 'badge--success',
      completada: 'badge--info', cancelada: 'badge--error',
      reprogramada: 'badge--purple', 'en-curso': 'badge--teal',
    };
    return map[status] ?? '';
  }
}
