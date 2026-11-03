import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Observable, delay, of } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { HISTORY_STORAGE_PREFIX, MedicalHistoryApi, MedicalHistoryRecord, PatientDeclaredAntecedent } from './history.models';

export const MEDICAL_HISTORY_API = new InjectionToken<MedicalHistoryApi>('MEDICAL_HISTORY_API');

function suffix(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

@Injectable({ providedIn: 'root' })
export class MedicalHistoryService {
  private readonly auth = inject(AuthService);
  private readonly api = inject(MEDICAL_HISTORY_API, { optional: true });
  private storageKey(): string { return `${HISTORY_STORAGE_PREFIX}${suffix(this.auth.token ?? 'sin-sesion')}`; }
  readonly connected = !!this.api;
  readonly records = signal<MedicalHistoryRecord[]>([]);
  readonly patientAntecedents = signal<PatientDeclaredAntecedent[]>(this.readPatientAntecedents());
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly allRecords = computed(() => [...this.records(), ...this.patientAntecedents()]);
  readonly lastUpdated = computed(() => [...this.allRecords()].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0]?.occurredAt ?? null);

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('saludya:session-changed', () => this.patientAntecedents.set(this.readPatientAntecedents()));
      window.addEventListener('saludya:logout', () => {
        this.records.set([]);
        this.patientAntecedents.set([]);
      });
    }
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    const request: Observable<MedicalHistoryRecord[]> = this.api?.listOwnRecords() ?? of([]).pipe(delay(180));
    request.subscribe({
      next: (records) => {
        this.records.set(records);
        this.patientAntecedents.set(this.readPatientAntecedents());
        this.loading.set(false);
      },
      error: () => {
        this.error.set('No se pudo cargar el expediente clínico. Inténtalo nuevamente.');
        this.loading.set(false);
      },
    });
  }

  savePatientAntecedent(entry: PatientDeclaredAntecedent): void {
    const current = this.patientAntecedents();
    const exists = current.some((item) => item.id === entry.id);
    const next = exists ? current.map((item) => item.id === entry.id ? entry : item) : [entry, ...current];
    this.patientAntecedents.set(next);
    this.persistPatientAntecedents(next);
  }

  deletePatientAntecedent(id: string): void {
    const next = this.patientAntecedents().filter((entry) => entry.id !== id);
    this.patientAntecedents.set(next);
    this.persistPatientAntecedents(next);
  }

  private readPatientAntecedents(): PatientDeclaredAntecedent[] {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(this.storageKey()) ?? '[]');
      return Array.isArray(parsed) ? parsed as PatientDeclaredAntecedent[] : [];
    } catch { return []; }
  }

  private persistPatientAntecedents(entries: PatientDeclaredAntecedent[]): void {
    try { sessionStorage.setItem(this.storageKey(), JSON.stringify(entries)); } catch { /* Keep the current session state usable when storage is unavailable. */ }
  }
}
