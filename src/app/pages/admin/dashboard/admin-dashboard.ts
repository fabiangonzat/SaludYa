import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { NgIf, NgFor, DatePipe, NgClass, DecimalPipe } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { AppointmentsService, AppointmentWithProfiles } from '../../../services/appointments.service';
import { DoctorsService } from '../../medicos/doctors.service';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [NgIf, NgFor, DatePipe, NgClass, DecimalPipe],
 templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly doctorsService = inject(DoctorsService);

  readonly user = this.auth.currentUser;
  readonly loading = this.appointmentsService.loading;
  readonly appointments = this.appointmentsService.appointments;
  readonly doctors = this.doctorsService.doctors;

  readonly today = new Date().toISOString().slice(0, 10);
  searchQuery = signal('');
  filterStatus = signal('');

  readonly stats = computed(() => {
    const all = this.appointments();
    const docs = this.doctors();
    return {
      totalAppointments: all.length,
      todayAppointments: all.filter((a) => a.date === this.today).length,
      activeDoctors: docs.length,
      pendingAppointments: all.filter((a) => a.status === 'pendiente').length,
      cancelledRate: all.length
        ? Math.round((all.filter((a) => a.status === 'cancelada').length / all.length) * 100)
        : 0,
      completedToday: all.filter((a) => a.date === this.today && a.status === 'completada').length,
    };
  });

  readonly filteredAppointments = computed(() => {
    let list = this.appointments();
    const q = this.searchQuery().toLowerCase();
    const s = this.filterStatus();
    if (q) {
      list = list.filter(
        (a) =>
          a.patient?.full_name.toLowerCase().includes(q) ||
          a.doctor_profile?.full_name.toLowerCase().includes(q) ||
          a.reason.toLowerCase().includes(q)
      );
    }
    if (s) list = list.filter((a) => a.status === s);
    return list.slice(0, 50);
  });

  async ngOnInit(): Promise<void> {
    await Promise.all([this.appointmentsService.load(), this.doctorsService.load()]);
    this.appointmentsService.subscribeRealtime();
  }

  ngOnDestroy(): void {
    this.appointmentsService.unsubscribeRealtime();
  }

  async updateStatus(id: string, status: AppointmentWithProfiles['status']): Promise<void> {
    if (status === 'cancelada') {
      const reason = prompt('Motivo de cancelación:');
      if (reason === null) return;
      await this.appointmentsService.updateStatus(id, status, { cancelReason: reason });
    } else {
      await this.appointmentsService.updateStatus(id, status);
    }
  }

  async toggleDoctorActive(doctorId: string, isActive: boolean): Promise<void> {
    await this.doctorsService.updateDoctorProfile(doctorId, { is_active: !isActive });
    await this.doctorsService.load();
  }

  statusLabel(status: string): string {
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
