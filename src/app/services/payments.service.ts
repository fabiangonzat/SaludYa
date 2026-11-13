import { Injectable } from '@angular/core';
import { getSupabaseClient } from '../core/supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  private readonly supabase = getSupabaseClient();

  async chargeWithCulqi(appointmentId: string, tokenId: string): Promise<{ error: string | null }> {
    const { data, error } = await this.supabase.functions.invoke('culqi-charge', {
      body: { appointmentId, tokenId },
    });
    return { error: error?.message ?? data?.error ?? null };
  }
}
