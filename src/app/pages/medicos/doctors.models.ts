export type Modality = 'presencial' | 'virtual';
export type AvailabilityWindow = 'hoy' | 'manana' | 'semana';
export type SortKey = 'relevancia' | 'calificacion' | 'precio' | 'experiencia' | 'disponibilidad';
export type DoctorGender = 'femenino' | 'masculino';

export interface DoctorReview {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface TimeSlot {
  date: string;
  time: string;
  modality: Modality;
  taken: boolean;
}

export interface Doctor {
  id: string;
  demo: true;
  firstName: string;
  lastName: string;
  specialty: string;
  license?: string;
  yearsExperience: number;
  rating: number;
  reviewCount: number;
  price: number;
  modalities: Modality[];
  location: string;
  city: string;
  gender: DoctorGender;
  languages: string[];
  university: string;
  education: string[];
  bio: string;
  initials: string;
  color: string;
  conditions: string[];
  reviews: DoctorReview[];
  slots: TimeSlot[];
}

export interface DoctorFilters {
  query: string;
  specialty: string;
  location: string;
  modality: '' | Modality;
  availability: '' | AvailabilityWindow;
  priceMin: number | null;
  priceMax: number | null;
  minRating: number | null;
  gender: '' | DoctorGender;
  language: string;
}

export interface DemoAppointment {
  id: string;
  doctorId: string;
  doctorName: string;
  specialty: string;
  date: string;
  time: string;
  modality: Modality;
  price: number;
  createdAt: string;
  demo: true;
  status: 'confirmada';
}

export const EMPTY_FILTERS: DoctorFilters = {
  query: '',
  specialty: '',
  location: '',
  modality: '',
  availability: '',
  priceMin: null,
  priceMax: null,
  minRating: null,
  gender: '',
  language: '',
};

export const SPECIALTIES = [
  'Medicina general',
  'Cardiología',
  'Dermatología',
  'Pediatría',
  'Ginecología',
  'Neurología',
  'Oftalmología',
  'Traumatología',
  'Odontología',
  'Psicología',
] as const;

export function doctorFullName(doctor: Doctor): string {
  return `${doctor.firstName} ${doctor.lastName}`;
}
