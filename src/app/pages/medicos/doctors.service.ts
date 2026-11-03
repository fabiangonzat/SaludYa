import { Injectable, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../../core/supabase/supabase.client';
import { DoctorRow, SpecialtyRow } from '../../core/supabase/supabase.types';
import { Doctor, TimeSlot } from './doctors.models';

export interface DoctorWithProfile extends Doctor {
  profile: { full_name: string; email: string; avatar_url: string | null; city: string | null; gender: string | null } | null;
  profile_id: string;
  specialty_id: number | null;
  is_active: boolean;
}

type DoctorDatabaseResult = DoctorRow & {
  profile: DoctorWithProfile['profile'];
  specialty: SpecialtyRow | null;
  languages: { language: string }[];
  slots: { date: string; time: string; modality: 'presencial' | 'virtual'; is_taken: boolean }[];
};

@Injectable({ providedIn: 'root' })
export class DoctorsService {
  private readonly supabase: SupabaseClient = getSupabaseClient();

  readonly doctors = signal<DoctorWithProfile[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const { data, error } = await this.supabase
      .from('doctors')
      .select(`
        *,
        profile:profiles(full_name, email, avatar_url, city, gender),
        specialty:specialties(*),
        languages:doctor_languages(language),
        slots:doctor_slots(date, time, modality, is_taken)
      `)
      .eq('is_active', true)
      .order('rating', { ascending: false });

    if (error) {
      this.error.set('No se pudo cargar el directorio médico.');
    } else {
      this.doctors.set((data ?? []).map((doctor) => this.toDoctor(doctor as DoctorDatabaseResult)));
    }
    this.loading.set(false);
  }

  async getById(id: string): Promise<DoctorWithProfile | null> {
    const { data } = await this.supabase
      .from('doctors')
      .select(`
        *,
        profile:profiles(full_name, email, avatar_url, city, gender),
        specialty:specialties(*),
        languages:doctor_languages(language),
        slots:doctor_slots(date, time, modality, is_taken)
      `)
      .eq('id', id)
      .single();
    return data ? this.toDoctor(data as DoctorDatabaseResult) : null;
  }

  async getByProfileId(profileId: string): Promise<DoctorWithProfile | null> {
    const { data } = await this.supabase
      .from('doctors')
      .select(`
        *,
        profile:profiles(full_name, email, avatar_url, city, gender),
        specialty:specialties(*),
        languages:doctor_languages(language),
        slots:doctor_slots(date, time, modality, is_taken)
      `)
      .eq('profile_id', profileId)
      .single();
    return data ? this.toDoctor(data as DoctorDatabaseResult) : null;
  }

  async createDoctorProfile(
    profileId: string,
    data: {
      specialtyId: number | null;
      license: string;
      bio: string;
      price: number;
      yearsExperience: number;
      location: string;
      university: string;
      languages: string[];
    }
  ): Promise<{ id: string | null; error: string | null }> {
    const { data: doctor, error } = await this.supabase
      .from('doctors')
      .insert({
        profile_id: profileId,
        specialty_id: data.specialtyId,
        license: data.license,
        bio: data.bio,
        price: data.price,
        years_experience: data.yearsExperience,
        location: data.location,
        university: data.university,
        is_active: true,
      })
      .select('id')
      .single();

    if (error || !doctor) return { id: null, error: error?.message ?? 'Error creando perfil.' };

    // Insertar idiomas
    if (data.languages.length > 0) {
      await this.supabase.from('doctor_languages').insert(
        data.languages.map((lang) => ({ doctor_id: doctor.id, language: lang }))
      );
    }

    return { id: doctor.id, error: null };
  }

  async updateDoctorProfile(
    doctorId: string,
    updates: Partial<Omit<DoctorRow, 'id' | 'profile_id' | 'created_at'>>
  ): Promise<{ error: string | null }> {
    const { error } = await this.supabase
      .from('doctors')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', doctorId);
    return { error: error?.message ?? null };
  }

  async getSpecialties(): Promise<SpecialtyRow[]> {
    const { data } = await this.supabase.from('specialties').select('*').order('name');
    return data ?? [];
  }

  private toDoctor(row: DoctorDatabaseResult): DoctorWithProfile {
    const fullName = row.profile?.full_name?.trim() || 'Médico sin nombre';
    const [firstName = 'Médico', ...lastNameParts] = fullName.split(/\s+/);
    const slots: TimeSlot[] = (row.slots ?? []).map((slot) => ({
      date: slot.date,
      time: slot.time.slice(0, 5),
      modality: slot.modality,
      taken: slot.is_taken,
    }));
    const modalities = [...new Set(slots.map((slot) => slot.modality))];
    return {
      id: row.id,
      profile_id: row.profile_id,
      specialty_id: row.specialty_id,
      is_active: row.is_active,
      profile: row.profile,
      demo: true,
      firstName,
      lastName: lastNameParts.join(' ') || '',
      specialty: row.specialty?.name ?? 'Sin especialidad',
      license: row.license ?? undefined,
      bio: row.bio ?? '',
      price: row.price,
      rating: row.rating,
      yearsExperience: row.years_experience,
      reviewCount: row.review_count,
      location: row.location ?? '',
      city: row.city ?? row.profile?.city ?? '',
      gender: (row.gender ?? row.profile?.gender ?? 'femenino') as Doctor['gender'],
      languages: (row.languages ?? []).map((item) => item.language),
      modalities: modalities.length ? modalities : ['presencial'],
      education: row.university ? [row.university] : [],
      university: row.university ?? '',
      initials: fullName.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
      color: '#087bfa',
      conditions: [],
      reviews: [],
      slots,
    };
  }
}
