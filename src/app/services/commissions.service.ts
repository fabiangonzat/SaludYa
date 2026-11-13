import { Injectable, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { AppointmentCommissionRow } from '../core/supabase/supabase.types';

export interface CommissionWithDoctor extends AppointmentCommissionRow {
  doctor: { profile: { full_name: string } | null } | null;
}

@Injectable({ providedIn: 'root' })
export class CommissionsService {
  private readonly supabase: SupabaseClient = getSupabaseClient();
  readonly commissions = signal<CommissionWithDoctor[]>([]);
  readonly loading = signal(false);

  async loadForAdmin(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.supabase
      .from('appointment_commissions')
      .select('*, doctor:doctors(profile:profiles(full_name))')
      .order('created_at', { ascending: false });
    this.commissions.set((data ?? []) as CommissionWithDoctor[]);
    this.loading.set(false);
  }

  async markSettled(id: string): Promise<string | null> {
    const { error } = await this.supabase
      .from('appointment_commissions')
      .update({ status: 'settled', settled_at: new Date().toISOString() })
      .eq('id', id);
    if (!error) await this.loadForAdmin();
    return error?.message ?? null;
  }
}
