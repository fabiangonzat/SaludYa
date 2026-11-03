export type UserRole = 'patient' | 'doctor' | 'admin';
export type AppointmentStatus =
  | 'pendiente'
  | 'confirmada'
  | 'reprogramada'
  | 'en-curso'
  | 'completada'
  | 'cancelada'
  | 'no-asistio';
export type AppointmentAction = 'creada' | 'confirmada' | 'reprogramada' | 'cancelada' | 'completada';
export type Modality = 'presencial' | 'virtual';
export type DoctorGender = 'femenino' | 'masculino';

// ---------- TABLE TYPES ----------

export interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  role: UserRole;
  birth_date: string | null;
  gender: DoctorGender | null;
  city: string | null;
  created_at: string;
  updated_at: string;
}

export interface SpecialtyRow {
  id: number;
  name: string;
  icon: string | null;
  description: string | null;
}

export interface DoctorRow {
  id: string;
  profile_id: string;
  specialty_id: number | null;
  license: string | null;
  bio: string | null;
  price: number;
  rating: number;
  review_count: number;
  years_experience: number;
  location: string | null;
  city: string | null;
  gender: DoctorGender | null;
  university: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DoctorAvailabilityRow {
  id: string;
  doctor_id: string;
  day_of_week: number; // 0=domingo ... 6=sábado
  start_time: string;  // HH:MM
  end_time: string;    // HH:MM
  slot_duration_minutes: number;
  modality: Modality;
  is_active: boolean;
  created_at: string;
}

export interface DoctorSlotRow {
  id: string;
  doctor_id: string;
  date: string;  // YYYY-MM-DD
  time: string;  // HH:MM
  modality: Modality;
  is_taken: boolean;
  appointment_id: string | null;
  created_at: string;
}

export interface DoctorLanguageRow {
  id: number;
  doctor_id: string;
  language: string;
}

export interface DoctorReviewRow {
  id: string;
  doctor_id: string;
  patient_id: string;
  appointment_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

export interface AppointmentRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  specialty_id: number | null;
  date: string;
  time: string;
  modality: Modality;
  status: AppointmentStatus;
  reason: string;
  symptoms: string | null;
  notes: string | null;
  price: number;
  duration_minutes: number;
  cancel_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface AppointmentChangeRow {
  id: string;
  appointment_id: string;
  action: AppointmentAction;
  from_date: string | null;
  from_time: string | null;
  to_date: string | null;
  to_time: string | null;
  note: string | null;
  created_by: string | null;
  created_at: string;
}

export interface MessageRow {
  id: string;
  sender_id: string;
  receiver_id: string;
  appointment_id: string | null;
  content: string;
  is_read: boolean;
  created_at: string;
}

// ---------- DATABASE SCHEMA ----------

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: Omit<ProfileRow, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<ProfileRow, 'id' | 'created_at'>>;
      };
      specialties: {
        Row: SpecialtyRow;
        Insert: Omit<SpecialtyRow, 'id'>;
        Update: Partial<Omit<SpecialtyRow, 'id'>>;
      };
      doctors: {
        Row: DoctorRow;
        Insert: Omit<DoctorRow, 'id' | 'rating' | 'review_count' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DoctorRow, 'id' | 'created_at'>>;
      };
      doctor_availability: {
        Row: DoctorAvailabilityRow;
        Insert: Omit<DoctorAvailabilityRow, 'id' | 'created_at'>;
        Update: Partial<Omit<DoctorAvailabilityRow, 'id' | 'doctor_id' | 'created_at'>>;
      };
      doctor_slots: {
        Row: DoctorSlotRow;
        Insert: Omit<DoctorSlotRow, 'id' | 'created_at'>;
        Update: Partial<Omit<DoctorSlotRow, 'id' | 'created_at'>>;
      };
      doctor_languages: {
        Row: DoctorLanguageRow;
        Insert: Omit<DoctorLanguageRow, 'id'>;
        Update: Partial<Omit<DoctorLanguageRow, 'id'>>;
      };
      doctor_reviews: {
        Row: DoctorReviewRow;
        Insert: Omit<DoctorReviewRow, 'id' | 'created_at'>;
        Update: Partial<Omit<DoctorReviewRow, 'id' | 'created_at'>>;
      };
      appointments: {
        Row: AppointmentRow;
        Insert: Omit<AppointmentRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<AppointmentRow, 'id' | 'created_at'>>;
      };
      appointment_changes: {
        Row: AppointmentChangeRow;
        Insert: Omit<AppointmentChangeRow, 'id' | 'created_at'>;
        Update: never;
      };
      messages: {
        Row: MessageRow;
        Insert: Omit<MessageRow, 'id' | 'created_at' | 'is_read'>;
        Update: Pick<MessageRow, 'is_read'>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      book_appointment: {
        Args: { p_doctor_id: string; p_date: string; p_time: string; p_modality: Modality; p_reason: string; p_symptoms?: string | null; p_price?: number; p_duration_minutes?: number };
        Returns: AppointmentRow;
      };
      change_appointment_status: {
        Args: { p_appointment_id: string; p_status: AppointmentStatus; p_note?: string | null };
        Returns: AppointmentRow;
      };
      reschedule_appointment: {
        Args: { p_appointment_id: string; p_date: string; p_time: string };
        Returns: AppointmentRow;
      };
    };
    Enums: Record<string, never>;
  };
};
