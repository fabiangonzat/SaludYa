import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { ProfileRow } from '../core/supabase/supabase.types';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly supabase: SupabaseClient = getSupabaseClient();

  async getProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  }

  async updateProfile(
    userId: string,
    updates: Partial<Omit<ProfileRow, 'id' | 'created_at' | 'role'>>
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', userId);
    return { error: error?.message ?? null };
  }

  async uploadAvatar(userId: string, file: File): Promise<{ url: string | null; error: string | null }> {
    const ext = file.name.split('.').pop();
    const path = `${userId}/avatar.${ext}`;

    const { error: uploadError } = await this.supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) return { url: null, error: uploadError.message };

    const { data } = this.supabase.storage.from('avatars').getPublicUrl(path);
    return { url: data.publicUrl, error: null };
  }
}
