import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { METRICS, MetricType, MoodEntry, WellnessGoal, WellnessHabit, WellnessMeasurement, metricLabel } from './wellness.models';
import { WellnessService } from './wellness.service';

type Period = 'semana' | 'mes' | 'todo';
interface ChartPoint { x: number; y: number; label: string; value: number; }

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function localTime(): string {
  const date = new Date();
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}
function dayKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

@Component({
  selector: 'app-wellness-page', standalone: true, imports: [DatePipe, FormsModule, RouterLink],
  templateUrl: './wellness-page.html', styleUrl: './wellness-page.css',
})
export class WellnessPage {
  readonly service = inject(WellnessService);
  readonly metrics = METRICS;
  readonly now = new Date();
  readonly chartType = signal<MetricType>('peso');
  readonly historyType = signal<MetricType | 'todo'>('todo');
  readonly historyPeriod = signal<Period>('todo');
  readonly reportPeriod = signal<'semana' | 'mes'>('semana');
  readonly chartData = computed(() => this.makeChart(this.chartType()));
  readonly visibleMeasurements = computed(() => {
    const type = this.historyType();
    const period = this.historyPeriod();
    const start = this.periodStart(period);
    return [...this.service.state().measurements]
      .filter((item) => (type === 'todo' || item.type === type) && (!start || new Date(item.occurredAt) >= start))
      .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
  });
  readonly currentDay = dayKey();
  readonly checkedHabitCount = computed(() => this.service.state().habits.filter((habit) => habit.checkIns.includes(this.currentDay)).length);
  readonly habitCompletion = computed(() => this.service.state().habits.length ? Math.round(this.checkedHabitCount() / this.service.state().habits.length * 100) : 0);
  readonly activeWeek = computed(() => this.makeWeekActivity());
  readonly weekActiveDays = computed(() => this.activeWeek().filter((day) => day.active).length);
  readonly moodOptions = [{ value: 1, label: 'Muy bajo' }, { value: 2, label: 'Bajo' }, { value: 3, label: 'Neutral' }, { value: 4, label: 'Bien' }, { value: 5, label: 'Muy bien' }];
  readonly stressOptions = [{ value: 1, label: 'Muy bajo' }, { value: 2, label: 'Bajo' }, { value: 3, label: 'Moderado' }, { value: 4, label: 'Alto' }, { value: 5, label: 'Muy alto' }];

  metricType: MetricType = 'peso';
  metricValue = '';
  metricSecondary = '';
  metricDate = localDate();
  metricTime = localTime();
  metricNote = '';
  editingMeasurement: string | null = null;
  formMessage = '';

  habitName = '';
  habitTarget = 8;
  habitUnit = 'vasos';
  habitFormOpen = false;

  goalTitle = '';
  goalTarget = '';
  goalDueDate = '';
  goalFormOpen = false;

  mood = 3;
  stress = 3;
  moodNote = '';

  readonly latestByType = computed(() => {
    const entries = this.service.state().measurements;
    return Object.fromEntries(this.metrics.map((metric) => [metric.id, entries.filter((item) => item.type === metric.id).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0] ?? null])) as Record<MetricType, WellnessMeasurement | null>;
  });
  readonly reportMeasurements = computed(() => {
    const start = this.periodStart(this.reportPeriod());
    return this.service.state().measurements.filter((item) => !start || new Date(item.occurredAt) >= start).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  });
  readonly reportHabitChecks = computed(() => {
    const start = this.periodStart(this.reportPeriod());
    return this.service.state().habits.flatMap((habit) => habit.checkIns.filter((date) => !start || new Date(`${date}T00:00:00`) >= start).map((date) => ({ name: habit.name, date })));
  });
  readonly reportMoods = computed(() => {
    const start = this.periodStart(this.reportPeriod());
    return this.service.state().moods.filter((entry) => !start || new Date(entry.occurredAt) >= start);
  });

  unitFor(type: MetricType): string { return METRICS.find((metric) => metric.id === type)?.unit ?? ''; }
  labelFor(type: MetricType): string { return metricLabel(type); }
  pressureValue(item: WellnessMeasurement | null): string { return item ? `${item.value}/${item.secondaryValue ?? '—'} ${item.unit}` : 'Sin registro'; }
  scalarValue(item: WellnessMeasurement | null): string { return item ? `${item.value} ${item.unit}` : 'Sin registro'; }

  saveMeasurement(): void {
    const value = Number(this.metricValue);
    const secondary = Number(this.metricSecondary);
    if (!Number.isFinite(value) || value <= 0 || !this.metricDate || !this.metricTime || (this.metricType === 'presion' && (!Number.isFinite(secondary) || secondary <= 0))) {
      this.formMessage = 'Completa la fecha, hora y valores positivos para guardar el registro.';
      return;
    }
    if (this.metricNote.length > 300) { this.formMessage = 'La observación admite hasta 300 caracteres.'; return; }
    this.service.saveMeasurement({
      id: this.editingMeasurement ?? `measurement-${Date.now()}`,
      type: this.metricType, value,
      ...(this.metricType === 'presion' ? { secondaryValue: secondary } : {}),
      unit: this.unitFor(this.metricType), occurredAt: `${this.metricDate}T${this.metricTime}`,
      note: this.metricNote.trim(), source: 'manual',
    });
    this.formMessage = this.editingMeasurement ? 'Registro actualizado en esta sesión.' : 'Registro guardado en esta sesión.';
    this.clearMeasurementForm();
  }

  editMeasurement(item: WellnessMeasurement): void {
    this.editingMeasurement = item.id; this.metricType = item.type; this.metricValue = String(item.value);
    this.metricSecondary = item.secondaryValue == null ? '' : String(item.secondaryValue);
    [this.metricDate, this.metricTime] = item.occurredAt.split('T'); this.metricNote = item.note; this.formMessage = '';
    document.getElementById('wellness-measurement-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  deleteMeasurement(item: WellnessMeasurement): void {
    if (confirm(`¿Eliminar el registro de ${this.labelFor(item.type)} del ${item.occurredAt.replace('T', ' ')}?`)) this.service.deleteMeasurement(item.id);
  }

  private clearMeasurementForm(): void {
    this.editingMeasurement = null; this.metricValue = ''; this.metricSecondary = ''; this.metricNote = '';
    this.metricDate = localDate(); this.metricTime = localTime();
  }

  addHabit(): void {
    const name = this.habitName.trim();
    if (!name || name.length > 50 || !Number.isFinite(this.habitTarget) || this.habitTarget <= 0) return;
    this.service.addHabit({ id: `habit-${Date.now()}`, name, dailyTarget: this.habitTarget, unit: this.habitUnit, checkIns: [], createdAt: new Date().toISOString() });
    this.habitName = ''; this.habitTarget = 8; this.habitUnit = 'vasos'; this.habitFormOpen = false;
  }

  addSuggestedHabit(name: string, target: number, unit: string): void {
    if (this.service.state().habits.some((habit) => habit.name.toLocaleLowerCase() === name.toLocaleLowerCase())) return;
    this.service.addHabit({ id: `habit-${Date.now()}`, name, dailyTarget: target, unit, checkIns: [], createdAt: new Date().toISOString() });
  }

  toggleHabit(habit: WellnessHabit): void {
    const hasToday = habit.checkIns.includes(this.currentDay);
    this.service.updateHabit({ ...habit, checkIns: hasToday ? habit.checkIns.filter((date) => date !== this.currentDay) : [...habit.checkIns, this.currentDay].sort() });
  }

  deleteHabit(habit: WellnessHabit): void {
    if (confirm(`¿Eliminar el hábito «${habit.name}» y sus marcas de seguimiento?`)) this.service.deleteHabit(habit.id);
  }

  addGoal(): void {
    const title = this.goalTitle.trim(); const target = this.goalTarget.trim();
    if (!title || !target || title.length > 60 || target.length > 100 || !this.goalDueDate) return;
    this.service.addGoal({ id: `goal-${Date.now()}`, title, target, dueDate: this.goalDueDate, progress: 0, createdAt: new Date().toISOString() });
    this.goalTitle = ''; this.goalTarget = ''; this.goalDueDate = ''; this.goalFormOpen = false;
  }

  setGoalProgress(goal: WellnessGoal, progress: number): void { this.service.updateGoal({ ...goal, progress: Math.max(0, Math.min(100, progress)) }); }
  deleteGoal(goal: WellnessGoal): void { if (confirm(`¿Eliminar el objetivo «${goal.title}»?`)) this.service.deleteGoal(goal.id); }

  addMood(): void {
    if (this.moodNote.length > 300) return;
    this.service.addMood({ id: `mood-${Date.now()}`, mood: this.mood, stress: this.stress, occurredAt: new Date().toISOString().slice(0, 16), note: this.moodNote.trim() });
    this.moodNote = '';
  }

  deleteMood(entry: MoodEntry): void { if (confirm('¿Eliminar este registro emocional?')) this.service.deleteMood(entry.id); }
  moodLabel(value: number): string { return this.moodOptions.find((option) => option.value === value)?.label ?? ''; }
  stressLabel(value: number): string { return this.stressOptions.find((option) => option.value === value)?.label ?? ''; }

  private periodStart(period: Period | 'mes'): Date | null {
    if (period === 'todo') return null;
    const date = new Date(); date.setHours(0, 0, 0, 0);
    if (period === 'semana') date.setDate(date.getDate() - 6); else date.setDate(date.getDate() - 29);
    return date;
  }

  private makeWeekActivity(): Array<{ date: Date; key: string; label: string; active: boolean }> {
    const result: Array<{ date: Date; key: string; label: string; active: boolean }> = [];
    for (let offset = 6; offset >= 0; offset -= 1) {
      const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - offset);
      const key = dayKey(date);
      const active = this.service.state().measurements.some((item) => item.occurredAt.startsWith(key)) || this.service.state().moods.some((item) => item.occurredAt.startsWith(key)) || this.service.state().habits.some((habit) => habit.checkIns.includes(key));
      result.push({ date, key, label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(date), active });
    }
    return result;
  }

  private makeChart(type: MetricType): { primary: ChartPoint[]; secondary: ChartPoint[] } {
    const entries = this.service.state().measurements.filter((item) => item.type === type).sort((a, b) => a.occurredAt.localeCompare(b.occurredAt)).slice(-10);
    if (!entries.length) return { primary: [], secondary: [] };
    const values = entries.flatMap((item) => item.secondaryValue == null ? [item.value] : [item.value, item.secondaryValue]);
    const minimum = Math.min(...values); const maximum = Math.max(...values); const padding = Math.max((maximum - minimum) * 0.2, maximum * 0.08, 0.5);
    const low = minimum - padding; const range = maximum - minimum + padding * 2;
    const y = (value: number) => 178 - ((value - low) / range) * 150;
    const label = (value: string) => new Intl.DateTimeFormat('es-PE', { day: 'numeric', month: 'short' }).format(new Date(value));
    return {
      primary: entries.map((item, index) => ({ x: entries.length === 1 ? 350 : 20 + index * 660 / (entries.length - 1), y: y(item.value), label: label(item.occurredAt), value: item.value })),
      secondary: entries.some((item) => item.secondaryValue != null) ? entries.map((item, index) => ({ x: entries.length === 1 ? 350 : 20 + index * 660 / (entries.length - 1), y: y(item.secondaryValue ?? item.value), label: label(item.occurredAt), value: item.secondaryValue ?? item.value })) : [],
    };
  }

  linePoints(points: ChartPoint[]): string { return points.map((point) => `${point.x},${point.y}`).join(' '); }
  scrollToMeasurementForm(): void { document.getElementById('wellness-measurement-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

  downloadReport(): void {
    const period = this.reportPeriod();
    const rows = [
      ['RESUMEN DE BIENESTAR — REGISTROS MANUALES, NO VERIFICADOS'],
      [`Periodo: ${period === 'semana' ? 'últimos 7 días' : 'últimos 30 días'}`],
      ['INDICADORES'],
      ['Tipo', 'Valor', 'Valor adicional', 'Unidad', 'Fecha y hora', 'Observaciones'],
      ...this.reportMeasurements().map((item) => [this.labelFor(item.type), String(item.value), item.secondaryValue == null ? '' : String(item.secondaryValue), item.unit, item.occurredAt, item.note]),
      ['HÁBITOS COMPLETADOS'],
      ['Hábito', 'Fecha'],
      ...this.reportHabitChecks().map((item) => [item.name, item.date]),
      ['OBJETIVOS'],
      ['Objetivo', 'Meta', 'Fecha límite', 'Progreso (%)'],
      ...this.service.state().goals.map((goal) => [goal.title, goal.target, goal.dueDate, String(goal.progress)]),
      ['ESTADO DE ÁNIMO (VOLUNTARIO)'],
      ['Fecha y hora', 'Ánimo (1–5)', 'Estrés (1–5)', 'Nota'],
      ...this.reportMoods().map((entry) => [entry.occurredAt, String(entry.mood), String(entry.stress), entry.note]),
      ['Este resumen personal no es un diagnóstico ni reemplaza la orientación de un profesional de salud.'],
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url; link.download = `saludya-bienestar-${period}-${localDate()}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}
