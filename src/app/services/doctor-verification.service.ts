import { Injectable, inject, signal } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import {
  DoctorVerificationDocumentRow,
  DoctorVerificationRequestRow,
  DoctorVerificationStatus,
} from '../core/supabase/supabase.types';
import { AuthService } from './auth.service';

export interface VerificationRequestWithDetails extends DoctorVerificationRequestRow {
  applicant: { full_name: string; email: string; phone: string | null } | null;
  documents: DoctorVerificationDocumentRow[];
}

export interface NewDoctorVerification {
  license: string;
  specialtyName: string;
  university: string;
  yearsExperience: number;
  consultationPrice: number;
  bio: string;
  clinicAddress: string;
}

export interface OwnDoctorVerificationStatus {
  status: DoctorVerificationStatus;
  review_note: string | null;
}

const BUCKET = 'doctor-verification-documents';
const MAX_FILES = 4;
const MAX_FILE_SIZE = 8 * 1024 * 1024;
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

@Injectable({ providedIn: 'root' })
export class DoctorVerificationService {
  private readonly supabase: SupabaseClient = getSupabaseClient();
  private readonly auth = inject(AuthService);

  readonly requests = signal<VerificationRequestWithDetails[]>([]);
  readonly loading = signal(false);

  validateFiles(files: File[]): string | null {
    if (!files.length) return 'Adjunta al menos una imagen de tu licencia o credencial profesional.';
    if (files.length > MAX_FILES) return `Puedes adjuntar hasta ${MAX_FILES} imágenes.`;
    const invalid = files.find((file) => !IMAGE_TYPES.has(file.type));
    if (invalid) return 'Solo se aceptan imágenes JPG, PNG o WEBP.';
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE);
    if (oversized) return 'Cada imagen debe pesar como máximo 8 MB.';
    return null;
  }

  async getOwnRequestStatus(): Promise<{ request: OwnDoctorVerificationStatus | null; error: string | null }> {
    const user = this.auth.currentUser();
    if (!user) return { request: null, error: 'No hay una sesión médica activa.' };

    const { data, error } = await this.supabase
      .from('doctor_verification_requests')
      .select('status, review_note')
      .eq('doctor_profile_id', user.id)
      .maybeSingle();

    return { request: data, error: error?.message ?? null };
  }

  async submit(input: NewDoctorVerification, files: File[]): Promise<{ error: string | null; notificationSent: boolean }> {
    const validationError = this.validateFiles(files);
    if (validationError) return { error: validationError, notificationSent: false };
    const { data: userData } = await this.supabase.auth.getUser();
    const user = userData.user;
    if (!user) return { error: 'Debes tener una sesión activa para enviar documentos.', notificationSent: false };

    const { data: request, error: requestError } = await this.supabase
      .from('doctor_verification_requests')
      .insert({
        doctor_profile_id: user.id,
        license: input.license.trim(),
        specialty_name: input.specialtyName.trim(),
        university: input.university.trim() || null,
        years_experience: input.yearsExperience,
        consultation_price: input.consultationPrice,
        bio: input.bio.trim() || null,
        clinic_address: input.clinicAddress.trim() || null,
      })
      .select()
      .single();
    if (requestError || !request) return { error: requestError?.message ?? 'No se pudo crear la solicitud.', notificationSent: false };

    const documents: Omit<DoctorVerificationDocumentRow, 'id' | 'created_at'>[] = [];
    for (const file of files) {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${user.id}/${request.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await this.supabase.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
      if (uploadError) return { error: `No se pudo subir ${file.name}.`, notificationSent: false };
      documents.push({ request_id: request.id, storage_path: path, file_name: file.name, content_type: file.type });
    }
    const { error: documentsError } = await this.supabase.from('doctor_verification_documents').insert(documents);
    if (documentsError) return { error: 'Las imágenes se subieron, pero no se pudo registrar la solicitud.', notificationSent: false };

    const { error: emailError } = await this.supabase.functions.invoke('notify-doctor-verification', { body: { requestId: request.id } });
    return { error: null, notificationSent: !emailError };
  }

  async loadForAdmin(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.supabase
      .from('doctor_verification_requests')
      .select('*, applicant:profiles!doctor_verification_requests_doctor_profile_id_fkey(full_name, email, phone), documents:doctor_verification_documents(*)')
      .order('created_at', { ascending: true });
    this.requests.set((data ?? []) as VerificationRequestWithDetails[]);
    this.loading.set(false);
  }

  async review(requestId: string, decision: 'approved' | 'rejected', note = ''): Promise<string | null> {
    const { error } = await this.supabase.rpc('review_doctor_verification', {
      p_request_id: requestId,
      p_decision: decision,
      p_review_note: note || null,
    });
    if (!error) await this.loadForAdmin();
    return error?.message ?? null;
  }

  async getDocumentUrl(path: string): Promise<string | null> {
    const { data, error } = await this.supabase.storage.from(BUCKET).createSignedUrl(path, 10 * 60);
    return error ? null : data.signedUrl;
  }
}
