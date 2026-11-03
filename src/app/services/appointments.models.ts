import { Modality } from '../pages/medicos/doctors.models';

export const APPOINTMENT_STORAGE_PREFIX = 'saludya_appointments_demo_v2_';

export type AppointmentStatus = 'pendiente' | 'confirmada' | 'reprogramada' | 'en-curso' | 'completada' | 'cancelada' | 'no-asistio';
export type AppointmentAction = 'creada' | 'reprogramada' | 'cancelada';

export interface AppointmentChange {
  action: AppointmentAction;
  at: string;
  fromDate?: string;
  fromTime?: string;
  toDate?: string;
  toTime?: string;
  note?: string;
}

export interface MedicalAppointment {
  id: string;
  doctorId: string;
  doctorName: string;
  doctorInitials: string;
  doctorColor: string;
  specialty: string;
  date: string;
  time: string;
  modality: Modality;
  price: number;
  durationMinutes?: number;
  reason: string;
  symptoms?: string;
  notes?: string;
  status: AppointmentStatus;
  createdAt: string;
  updatedAt: string;
  cancelReason?: string;
  conversationId?: string;
  clinicalRecordId?: string;
  demo: true;
  changes: AppointmentChange[];
}

export type NewAppointment = Omit<MedicalAppointment, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'changes'>;
