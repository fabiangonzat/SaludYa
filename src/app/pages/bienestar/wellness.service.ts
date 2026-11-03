import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { EMPTY_WELLNESS, MoodEntry, WellnessGoal, WellnessHabit, WellnessMeasurement, WellnessState, WELLNESS_STORAGE_PREFIX } from './wellness.models';

function sessionSuffix(token: string): string {
  let hash = 2166136261;
  for (let index = 0; index < token.length; index += 1) hash = Math.imul(hash ^ token.charCodeAt(index), 16777619);
  return (hash >>> 0).toString(36);
}

function validState(value: unknown): value is WellnessState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as WellnessState;
  return Array.isArray(candidate.measurements) && Array.isArray(candidate.habits) && Array.isArray(candidate.goals) && Array.isArray(candidate.moods);
}

@Injectable({ providedIn: 'root' })
export class WellnessService {
  private readonly auth = inject(AuthService);
  private storageKey(): string { return `${WELLNESS_STORAGE_PREFIX}${sessionSuffix(this.auth.token() || 'sin-sesion')}`; }
  readonly state = signal<WellnessState>(this.restore());
  readonly latestMeasurement = computed(() => [...this.state().measurements].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null);
  readonly lastUpdated = computed(() => {
    const state = this.state();
    return state.updatedAt ?? [...state.measurements.map((item) => item.occurredAt), ...state.moods.map((item) => item.occurredAt), ...state.habits.map((item) => item.createdAt), ...state.goals.map((item) => item.createdAt)].sort().at(-1) ?? null;
  });

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('saludya:session-changed', () => this.state.set(this.restore()));
      window.addEventListener('saludya:logout', () => this.state.set({ ...EMPTY_WELLNESS }));
    }
  }

  private restore(): WellnessState {
    try {
      const raw = sessionStorage.getItem(this.storageKey());
      if (!raw) return { ...EMPTY_WELLNESS };
      const parsed: unknown = JSON.parse(raw);
      return validState(parsed) ? parsed : { ...EMPTY_WELLNESS };
    } catch {
      return { ...EMPTY_WELLNESS };
    }
  }

  private save(next: WellnessState): void {
    const updated = { ...next, updatedAt: new Date().toISOString() };
    this.state.set(updated);
    try { sessionStorage.setItem(this.storageKey(), JSON.stringify(updated)); } catch { /* The in-memory state remains usable if storage is unavailable. */ }
  }

  saveMeasurement(measurement: WellnessMeasurement): void {
    const measurements = this.state().measurements;
    const exists = measurements.some((item) => item.id === measurement.id);
    this.save({ ...this.state(), measurements: exists ? measurements.map((item) => item.id === measurement.id ? measurement : item) : [measurement, ...measurements] });
  }
  deleteMeasurement(id: string): void { this.save({ ...this.state(), measurements: this.state().measurements.filter((item) => item.id !== id) }); }
  addHabit(habit: WellnessHabit): void { this.save({ ...this.state(), habits: [habit, ...this.state().habits] }); }
  updateHabit(habit: WellnessHabit): void { this.save({ ...this.state(), habits: this.state().habits.map((item) => item.id === habit.id ? habit : item) }); }
  deleteHabit(id: string): void { this.save({ ...this.state(), habits: this.state().habits.filter((item) => item.id !== id) }); }
  addGoal(goal: WellnessGoal): void { this.save({ ...this.state(), goals: [goal, ...this.state().goals] }); }
  updateGoal(goal: WellnessGoal): void { this.save({ ...this.state(), goals: this.state().goals.map((item) => item.id === goal.id ? goal : item) }); }
  deleteGoal(id: string): void { this.save({ ...this.state(), goals: this.state().goals.filter((item) => item.id !== id) }); }
  addMood(mood: MoodEntry): void { this.save({ ...this.state(), moods: [mood, ...this.state().moods] }); }
  deleteMood(id: string): void { this.save({ ...this.state(), moods: this.state().moods.filter((item) => item.id !== id) }); }
}
