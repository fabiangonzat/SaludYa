import { Observable } from 'rxjs';

export type HistoryCategory = 'consultas' | 'diagnosticos' | 'recetas' | 'examenes' | 'antecedentes' | 'documentos';
export type RecordSource = 'profesional' | 'paciente';

export interface HistoryAttachment {
  id: string;
  name: string;
  format: string;
  downloadUrl: string;
}

/** Normalized view model. The API adapter maps authorized clinical entities into this shape. */
export interface MedicalHistoryRecord {
  id: string;
  category: HistoryCategory;
  title: string;
  summary: string;
  occurredAt: string;
  source: RecordSource;
  professional?: string;
  specialty?: string;
  institution?: string;
  status?: string;
  details?: Record<string, string>;
  attachments?: HistoryAttachment[];
}

export interface PatientDeclaredAntecedent {
  id: string;
  title: string;
  summary: string;
  occurredAt: string;
  category: 'antecedentes';
  source: 'paciente';
  status: 'Declarado por el paciente';
  professional?: string;
  specialty?: string;
  institution?: string;
  details?: Record<string, string>;
  attachments?: HistoryAttachment[];
}

export interface MedicalHistoryApi {
  listOwnRecords(): Observable<MedicalHistoryRecord[]>;
}

export const HISTORY_STORAGE_PREFIX = 'saludya_history_patient_v1_';
