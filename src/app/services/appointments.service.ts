import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { AppointmentRow, AppointmentChangeRow } from '../core/supabase/supabase.types';
import { AuthService } from './auth.service';

export type { AppointmentRow, AppointmentChangeRow };
export type { AppointmentStatus } from '../core/supabase/supabase.types';

export interface AppointmentWithProfiles extends AppointmentRow {
  patient: { full_name: string; email: string; phone: string | null; avatar_url: string | null } | null;
  doctor_profile: { full_name: string; avatar_url: string | null } | null;
  specialty: string;
  doctorId: string;
  doctorName: string;
  doctorInitials: string;
  doctorColor: string;
  durationMinutes?: number;
  createdAt: string;
  updatedAt: string;
  cancelReason?: string;
  conversationId?: string;
  clinicalRecordId?: string;
  demo: true;
  changes: { action: string; at: string; fromDate?: string; fromTime?: string; toDate?: string; toTime?: string; note?: string }[];
}

type AppointmentDatabaseResult = AppointmentRow & {
  patient: AppointmentWithProfiles['patient'];
  doctor: { profile: AppointmentWithProfiles['doctor_profile']; specialty: { name: string } | null } | null;
  specialty: { name: string } | null;
};

@Injectable({ providedIn: 'root' })
export class AppointmentsService {
  private readonly supabase: SupabaseClient = getSupabaseClient();
  private readonly auth = inject(AuthService);
  private channel: RealtimeChannel | null = null;

  readonly appointments = signal<AppointmentWithProfiles[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  // ─── Cargar citas ────────────────────────────────────────────────────────

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const user = this.auth.currentUser();
    if (!user) { this.loading.set(false); return; }

    let query = this.supabase
      .from('appointments')
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(full_name, email, phone, avatar_url),
        specialty:specialties(name),
        doctor:doctors!appointments_doctor_id_fkey(profile:profiles!doctors_profile_id_fkey(full_name, avatar_url), specialty:specialties(name))
      `)
      .order('date', { ascending: true })
      .order('time', { ascending: true });

    if (user.role === 'patient') {
      query = query.eq('patient_id', user.id);
    } else if (user.role === 'doctor') {
      // doctor_id en appointments apunta al perfil del médico (doctors.profile_id == user.id)
      const { data: doctorData } = await this.supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', user.id)
        .single();
      if (doctorData) query = query.eq('doctor_id', doctorData.id);
    }
    // admin: sin filtro → ve todas las citas

    const { data, error } = await query;
    if (error) {
      this.error.set('No se pudieron cargar las citas.');
    } else {
      this.appointments.set((data ?? []).map((appointment) => this.toAppointment(appointment as AppointmentDatabaseResult)));
    }
    this.loading.set(false);
  }

  // ─── Realtime ────────────────────────────────────────────────────────────

  subscribeRealtime(): void {
    this.channel = this.supabase
      .channel('appointments-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => {
        this.load();
      })
      .subscribe();
  }

  unsubscribeRealtime(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  // ─── CRUD ────────────────────────────────────────────────────────────────

  async create(input: {
    doctorId: string;
    specialtyId: number | null;
    date: string;
    time: string;
    modality: 'presencial' | 'virtual';
    reason: string;
    symptoms?: string;
    price: number;
    durationMinutes?: number;
  }): Promise<{ data: AppointmentRow | null; error: string | null }> {
    const user = this.auth.currentUser();
    if (!user) return { data: null, error: 'No hay sesión activa.' };

    const { data, error } = await this.supabase.rpc('book_appointment', {
      p_doctor_id: input.doctorId,
      p_date: input.date,
      p_time: input.time,
      p_modality: input.modality,
      p_reason: input.reason,
      p_symptoms: input.symptoms ?? null,
      p_price: input.price,
      p_duration_minutes: input.durationMinutes ?? 30,
    });
    if (!error) await this.load();
    return { data: (data as AppointmentRow | null) ?? null, error: error?.message ?? null };
  }

  async updateStatus(
    appointmentId: string,
    status: AppointmentRow['status'],
    options?: { cancelReason?: string; notes?: string }
  ): Promise<{ error: string | null }> {
    const user = this.auth.currentUser();
    const { error } = await this.supabase.rpc('change_appointment_status', {
      p_appointment_id: appointmentId,
      p_status: status,
      p_note: options?.cancelReason ?? options?.notes ?? null,
    });
    if (!error) await this.load();
    return { error: error?.message ?? null };
  }

  async reschedule(
    appointmentId: string,
    newDate: string,
    newTime: string
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase.rpc('reschedule_appointment', {
      p_appointment_id: appointmentId, p_date: newDate, p_time: newTime,
    });
    if (!error) await this.load();
    return { error: error?.message ?? null };
  }

  async getChanges(appointmentId: string): Promise<AppointmentChangeRow[]> {
    const { data } = await this.supabase
      .from('appointment_changes')
      .select('*')
      .eq('appointment_id', appointmentId)
      .order('created_at', { ascending: true });
    return data ?? [];
  }

  private toAppointment(row: AppointmentDatabaseResult): AppointmentWithProfiles {
    const doctorName = row.doctor?.profile?.full_name ?? 'Médico';
    const specialtyName = row.specialty?.name ?? row.doctor?.specialty?.name ?? 'Sin especialidad';
    return {
      ...row,
      patient: row.patient,
      doctor_profile: row.doctor?.profile ?? null,
      specialty: specialtyName,
      doctorId: row.doctor_id,
      doctorName,
      doctorInitials: doctorName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
      doctorColor: '#087bfa',
      durationMinutes: row.duration_minutes,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      cancelReason: row.cancel_reason ?? undefined,
      conversationId: undefined,
      clinicalRecordId: undefined,
      demo: true,
      changes: [],
    };
  }
}
