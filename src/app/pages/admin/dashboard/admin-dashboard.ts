import { Component, inject, OnInit, OnDestroy, signal, computed } from '@angular/core';
import { NgIf, NgFor, DatePipe, NgClass, DecimalPipe } from '@angular/common';
import { AuthService } from '../../../services/auth.service';
import { AppointmentsService, AppointmentWithProfiles } from '../../../services/appointments.service';
import { DoctorsService } from '../../medicos/doctors.service';
import { DoctorVerificationService } from '../../../services/doctor-verification.service';
import { CommissionsService } from '../../../services/commissions.service';

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
  private readonly verificationService = inject(DoctorVerificationService);
  private readonly commissionsService = inject(CommissionsService);

  readonly user = this.auth.currentUser;
  readonly loading = this.appointmentsService.loading;
  readonly appointments = this.appointmentsService.appointments;
  readonly doctors = this.doctorsService.doctors;
  readonly verificationRequests = this.verificationService.requests;
  readonly verificationLoading = this.verificationService.loading;
  readonly verificationMessage = signal('');
  readonly commissions = this.commissionsService.commissions;
  readonly commissionsLoading = this.commissionsService.loading;
  readonly financeMessage = signal('');
  readonly commissionRate = 0.15;

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

  readonly finance = computed(() => {
    const commissions = this.commissions().filter((item) => item.status !== 'void');
    const accrued = commissions.filter((item) => item.status === 'accrued');
    const settled = commissions.filter((item) => item.status === 'settled');
    const sum = (items: typeof commissions, field: 'gross_amount' | 'platform_fee' | 'doctor_payout') =>
      items.reduce((total, item) => total + Number(item[field] ?? 0), 0);
    return {
      consultations: commissions.length,
      gross: sum(commissions, 'gross_amount'),
      platformRevenue: sum(commissions, 'platform_fee'),
      doctorPayout: sum(commissions, 'doctor_payout'),
      pendingSettlement: sum(accrued, 'doctor_payout'),
      paidOut: sum(settled, 'doctor_payout'),
    };
  });

  readonly doctorEarnings = computed(() => {
    const grouped = new Map<string, { name: string; consultations: number; gross: number; commission: number; payout: number }>();
    for (const item of this.commissions().filter((entry) => entry.status !== 'void')) {
      const name = item.doctor?.profile?.full_name ?? 'Médico';
      const existing = grouped.get(item.doctor_id) ?? { name, consultations: 0, gross: 0, commission: 0, payout: 0 };
      existing.consultations++;
      existing.gross += Number(item.gross_amount);
      existing.commission += Number(item.platform_fee);
      existing.payout += Number(item.doctor_payout);
      grouped.set(item.doctor_id, existing);
    }
    return [...grouped.values()].sort((a, b) => b.commission - a.commission);
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
    await Promise.all([this.appointmentsService.load(), this.doctorsService.load(), this.verificationService.loadForAdmin(), this.commissionsService.loadForAdmin()]);
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

  async reviewVerification(requestId: string, decision: 'approved' | 'rejected'): Promise<void> {
    const note = decision === 'rejected' ? prompt('Indica el motivo del rechazo para el solicitante:') : '';
    if (note === null) return;
    const error = await this.verificationService.review(requestId, decision, note ?? '');
    this.verificationMessage.set(error ?? (decision === 'approved' ? 'Médico aprobado y habilitado en el directorio.' : 'Solicitud rechazada.'));
    if (!error && decision === 'approved') await this.doctorsService.load();
  }

  async openDocument(path: string): Promise<void> {
    const url = await this.verificationService.getDocumentUrl(path);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    else this.verificationMessage.set('No se pudo abrir el documento privado.');
  }

  async refreshVerifications(): Promise<void> {
    await this.verificationService.loadForAdmin();
  }

  async settleCommission(id: string): Promise<void> {
    const error = await this.commissionsService.markSettled(id);
    this.financeMessage.set(error ?? 'Pago al médico marcado como liquidado.');
  }

  formatSoles(value: number): string {
    return new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', minimumFractionDigits: 2 }).format(value);
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
