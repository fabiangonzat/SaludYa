export type MetricType = 'peso' | 'presion' | 'frecuencia' | 'glucosa' | 'temperatura' | 'sueno';

export interface WellnessMeasurement {
  id: string;
  type: MetricType;
  value: number;
  secondaryValue?: number;
  unit: string;
  occurredAt: string;
  note: string;
  source: 'manual';
}

export interface WellnessHabit {
  id: string;
  name: string;
  dailyTarget: number;
  unit: string;
  checkIns: string[];
  createdAt: string;
}

export interface WellnessGoal {
  id: string;
  title: string;
  target: string;
  dueDate: string;
  progress: number;
  createdAt: string;
}

export interface MoodEntry {
  id: string;
  mood: number;
  stress: number;
  occurredAt: string;
  note: string;
}

export interface WellnessState {
  measurements: WellnessMeasurement[];
  habits: WellnessHabit[];
  goals: WellnessGoal[];
  moods: MoodEntry[];
  updatedAt?: string;
}

export const WELLNESS_STORAGE_PREFIX = 'saludya_wellness_v1_';
export const EMPTY_WELLNESS: WellnessState = { measurements: [], habits: [], goals: [], moods: [] };

export const METRICS: ReadonlyArray<{ id: MetricType; label: string; unit: string; color: string }> = [
  { id: 'peso', label: 'Peso', unit: 'kg', color: '#2278df' },
  { id: 'presion', label: 'Presión arterial', unit: 'mmHg', color: '#795cdd' },
  { id: 'frecuencia', label: 'Frecuencia cardíaca', unit: 'lpm', color: '#e66f72' },
  { id: 'glucosa', label: 'Glucosa', unit: 'mg/dL', color: '#e6a448' },
  { id: 'temperatura', label: 'Temperatura', unit: '°C', color: '#df8054' },
  { id: 'sueno', label: 'Horas de sueño', unit: 'h', color: '#4b9b8c' },
];

export function metricLabel(type: MetricType): string {
  return METRICS.find((metric) => metric.id === type)?.label ?? type;
}
