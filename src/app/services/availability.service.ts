import { Injectable, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { DoctorAvailabilityRow, DoctorSlotRow } from '../core/supabase/supabase.types';

export type { DoctorAvailabilityRow, DoctorSlotRow };

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

@Injectable({ providedIn: 'root' })
export class AvailabilityService {
  private readonly supabase: SupabaseClient = getSupabaseClient();

  readonly availability = signal<DoctorAvailabilityRow[]>([]);
  readonly slots = signal<DoctorSlotRow[]>([]);
  readonly loading = signal(false);

  dayName(dayOfWeek: number): string {
    return DAY_NAMES[dayOfWeek] ?? '';
  }

  // ─── Disponibilidad recurrente ─────────────────────────────────────────

  async loadAvailability(doctorId: string): Promise<void> {
    this.loading.set(true);
    const { data } = await this.supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true)
      .order('day_of_week');
    this.availability.set(data ?? []);
    this.loading.set(false);
  }

  async saveAvailability(
    doctorId: string,
    entries: Omit<DoctorAvailabilityRow, 'id' | 'created_at' | 'doctor_id'>[]
  ): Promise<{ error: string | null }> {
    // Borrar existentes y reemplazar
    await this.supabase.from('doctor_availability').delete().eq('doctor_id', doctorId);

    if (entries.length === 0) {
      this.availability.set([]);
      return { error: null };
    }

    const { error } = await this.supabase.from('doctor_availability').insert(
      entries.map((e) => ({ ...e, doctor_id: doctorId }))
    );

    if (!error) await this.loadAvailability(doctorId);
    return { error: error?.message ?? null };
  }

  // ─── Slots concretos ───────────────────────────────────────────────────

  async loadSlots(doctorId: string, fromDate?: string, toDate?: string): Promise<void> {
    this.loading.set(true);
    let query = this.supabase
      .from('doctor_slots')
      .select('*')
      .eq('doctor_id', doctorId)
      .order('date').order('time');

    if (fromDate) query = query.gte('date', fromDate);
    if (toDate) query = query.lte('date', toDate);

    const { data } = await query;
    this.slots.set(data ?? []);
    this.loading.set(false);
  }

  async generateSlots(
    doctorId: string,
    fromDate: string,
    days: number = 30
  ): Promise<{ generated: number; error: string | null }> {
    // Obtener disponibilidad recurrente
    const { data: avail } = await this.supabase
      .from('doctor_availability')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('is_active', true);

    if (!avail || avail.length === 0) return { generated: 0, error: null };

    const slots: Omit<DoctorSlotRow, 'id' | 'created_at'>[] = [];
    const start = new Date(fromDate + 'T00:00:00');

    for (let d = 0; d < days; d++) {
      const current = new Date(start);
      current.setDate(start.getDate() + d);
      const dayOfWeek = current.getDay();
      const dateStr = current.toISOString().slice(0, 10);

      const dayRules = avail.filter((a) => a.day_of_week === dayOfWeek);
      for (const rule of dayRules) {
        const times = generateTimeSlots(rule.start_time, rule.end_time, rule.slot_duration_minutes);
        for (const time of times) {
          slots.push({
            doctor_id: doctorId,
            date: dateStr,
            time,
            modality: rule.modality,
            is_taken: false,
            appointment_id: null,
          });
        }
      }
    }

    if (slots.length === 0) return { generated: 0, error: null };

    // Upsert para evitar duplicados
    const { error } = await this.supabase
      .from('doctor_slots')
      .upsert(slots, { onConflict: 'doctor_id,date,time', ignoreDuplicates: true });

    return { generated: slots.length, error: error?.message ?? null };
  }

  async getAvailableSlots(doctorId: string, date: string): Promise<DoctorSlotRow[]> {
    const { data } = await this.supabase
      .from('doctor_slots')
      .select('*')
      .eq('doctor_id', doctorId)
      .eq('date', date)
      .eq('is_taken', false)
      .order('time');
    return data ?? [];
  }
}

function generateTimeSlots(start: string, end: string, durationMin: number): string[] {
  const slots: string[] = [];
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let current = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (current + durationMin <= endMin) {
    const h = Math.floor(current / 60).toString().padStart(2, '0');
    const m = (current % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    current += durationMin;
  }
  return slots;
}
