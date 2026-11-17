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
  conversation_id: string | null;
  sender_id: string;
  receiver_id: string;
  appointment_id: string | null;
  content: string;
  message_type: 'text' | 'image' | 'document';
  attachment_path: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
}

export interface ConversationRow {
  id: string;
  patient_id: string;
  doctor_id: string;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface ConversationSummaryRow {
  conversation_id: string;
  counterpart_id: string;
  counterpart_name: string;
  counterpart_avatar: string | null;
  specialty: string | null;
  last_message: string | null;
  last_message_at: string;
  unread_count: number;
}

export type DoctorVerificationStatus = 'pending' | 'approved' | 'rejected';

export interface DoctorVerificationRequestRow {
  id: string;
  doctor_profile_id: string;
  license: string;
  specialty_name: string;
  university: string | null;
  years_experience: number;
  consultation_price: number;
  bio: string | null;
  status: DoctorVerificationStatus;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  notification_sent_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DoctorVerificationDocumentRow {
  id: string;
  request_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  created_at: string;
}

export type CommissionStatus = 'accrued' | 'settled' | 'void';

export interface AppointmentCommissionRow {
  id: string;
  appointment_id: string;
  doctor_id: string;
  gross_amount: number;
  commission_rate: number;
  platform_fee: number;
  doctor_payout: number;
  status: CommissionStatus;
  settled_at: string | null;
  created_at: string;
  updated_at: string;
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
      conversations: {
        Row: ConversationRow;
        Insert: Omit<ConversationRow, 'id' | 'created_at' | 'updated_at' | 'last_message_at'>;
        Update: never;
      };
      doctor_verification_requests: {
        Row: DoctorVerificationRequestRow;
        Insert: Omit<DoctorVerificationRequestRow, 'id' | 'status' | 'review_note' | 'reviewed_by' | 'reviewed_at' | 'notification_sent_at' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<DoctorVerificationRequestRow, 'id' | 'doctor_profile_id' | 'created_at'>>;
      };
      doctor_verification_documents: {
        Row: DoctorVerificationDocumentRow;
        Insert: Omit<DoctorVerificationDocumentRow, 'id' | 'created_at'>;
        Update: never;
      };
      appointment_commissions: {
        Row: AppointmentCommissionRow;
        Insert: Omit<AppointmentCommissionRow, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Pick<AppointmentCommissionRow, 'status' | 'settled_at'>>;
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
      review_doctor_verification: {
        Args: { p_request_id: string; p_decision: 'approved' | 'rejected'; p_review_note?: string | null };
        Returns: DoctorVerificationRequestRow;
      };
      open_care_conversation: {
        Args: { p_doctor_id: string; p_patient_id?: string | null };
        Returns: ConversationRow;
      };
      send_conversation_message: {
        Args: { p_conversation_id: string; p_content: string; p_message_type?: string; p_attachment_path?: string | null };
        Returns: MessageRow;
      };
      mark_conversation_read: {
        Args: { p_conversation_id: string };
        Returns: number;
      };
      get_my_conversations: {
        Args: Record<string, never>;
        Returns: ConversationSummaryRow[];
      };
    };
    Enums: Record<string, never>;
  };
};
