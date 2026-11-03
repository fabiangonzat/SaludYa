import { DatePipe, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HistoryCategory, MedicalHistoryRecord, PatientDeclaredAntecedent } from './history.models';
import { MedicalHistoryService } from './history.service';

type HistoryView = 'resumen' | 'linea-tiempo' | HistoryCategory;
type AntecedentKind = 'Enfermedad previa o crónica' | 'Alergia' | 'Cirugía' | 'Antecedente familiar' | 'Hospitalización';

const CATEGORY_LABELS: Record<HistoryCategory, string> = {
  consultas: 'Consultas', diagnosticos: 'Diagnósticos', recetas: 'Recetas',
  examenes: 'Exámenes', antecedentes: 'Antecedentes', documentos: 'Documentos',
};
const CATEGORY_ICONS: Record<HistoryCategory, string> = {
  consultas: 'M8 3h8v18H5V6h3m-1 0V3m8 0v3M8 11h8m-8 4h8m-8 4h5',
  diagnosticos: 'M12 3v18M3 12h18',
  recetas: 'M7 3h10v18H7zM10 7h4m-4 4h4m-4 4h4',
  examenes: 'M4 5h16v14H4zM7 15l3-3 2 2 4-5 2 3',
  antecedentes: 'M12 20s-7-4-9-9a5 5 0 0 1 9-4 5 5 0 0 1 9 4c-2 5-9 9-9 9z',
  documentos: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7m-7 4h7',
};
const QUICK_CATEGORIES: HistoryCategory[] = ['consultas', 'diagnosticos', 'recetas', 'examenes', 'antecedentes', 'documentos'];

function localDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

@Component({
  selector: 'app-medical-history-page', standalone: true, imports: [DatePipe, KeyValuePipe, NgTemplateOutlet, FormsModule, RouterLink],
  templateUrl: './medical-history-page.html', styleUrl: './medical-history-page.css',
})
export class MedicalHistoryPage {
  readonly history = inject(MedicalHistoryService);
  readonly categories = QUICK_CATEGORIES;
  readonly view = signal<HistoryView>('resumen');
  readonly query = signal('');
  readonly dateFrom = signal('');
  readonly dateTo = signal('');
  readonly sortOrder = signal<'newest' | 'oldest'>('newest');
  readonly selectedRecord = signal<MedicalHistoryRecord | PatientDeclaredAntecedent | null>(null);
  readonly entryFormOpen = signal(false);
  readonly editingEntry = signal<string | null>(null);
  readonly entryKind = signal<AntecedentKind>('Enfermedad previa o crónica');
  readonly entryTitle = signal('');
  readonly entrySummary = signal('');
  readonly entryDate = signal(localDate());
  readonly entryError = signal('');
  readonly today = localDate();
  readonly categoryCounts = computed(() => Object.fromEntries(QUICK_CATEGORIES.map((category) => [category, this.history.allRecords().filter((record) => record.category === category).length])) as Record<HistoryCategory, number>);
  readonly visibleRecords = computed(() => {
    const query = normalize(this.query()); const view = this.view();
    const from = this.dateFrom(); const to = this.dateTo();
    const order = this.sortOrder();
    return [...this.history.allRecords()].filter((record) => {
      if (QUICK_CATEGORIES.includes(view as HistoryCategory) && record.category !== view) return false;
      if (from && record.occurredAt.slice(0, 10) < from) return false;
      if (to && record.occurredAt.slice(0, 10) > to) return false;
      if (query && !normalize([record.title, record.summary, record.professional ?? '', record.specialty ?? '', record.institution ?? '', record.status ?? '', ...Object.values(record.details ?? {})].join(' ')).includes(query)) return false;
      return true;
    }).sort((a, b) => order === 'newest' ? b.occurredAt.localeCompare(a.occurredAt) : a.occurredAt.localeCompare(b.occurredAt));
  });
  readonly timelineRecords = computed(() => this.visibleRecords());
  readonly lastUpdated = computed(() => this.history.lastUpdated());

  constructor() { this.history.load(); }

  setView(view: HistoryView): void { this.view.set(view); this.selectedRecord.set(null); }
  label(category: HistoryCategory): string { return CATEGORY_LABELS[category]; }
  icon(category: HistoryCategory): string { return CATEGORY_ICONS[category]; }
  viewLabel(): string { const view = this.view(); return QUICK_CATEGORIES.includes(view as HistoryCategory) ? CATEGORY_LABELS[view as HistoryCategory] : view === 'linea-tiempo' ? 'Línea de tiempo' : 'Resumen'; }
  viewCategory(): HistoryCategory { const view = this.view(); return QUICK_CATEGORIES.includes(view as HistoryCategory) ? view as HistoryCategory : 'consultas'; }
  recordsFor(category: HistoryCategory): number { return this.categoryCounts()[category]; }
  isPatientEntry(record: MedicalHistoryRecord | PatientDeclaredAntecedent): record is PatientDeclaredAntecedent {
    return record.category === 'antecedentes' && record.source === 'paciente' && !('details' in record);
  }
  openRecord(record: MedicalHistoryRecord | PatientDeclaredAntecedent): void { this.selectedRecord.set(record); }

  beginEntry(): void {
    this.entryFormOpen.set(true); this.editingEntry.set(null); this.entryKind.set('Enfermedad previa o crónica');
    this.entryTitle.set(''); this.entrySummary.set(''); this.entryDate.set(localDate()); this.entryError.set('');
  }

  editEntry(entry: PatientDeclaredAntecedent): void {
    const [kind, ...parts] = entry.title.split(': ');
    const allowedKinds: AntecedentKind[] = ['Enfermedad previa o crónica', 'Alergia', 'Cirugía', 'Antecedente familiar', 'Hospitalización'];
    this.entryKind.set(allowedKinds.includes(kind as AntecedentKind) ? kind as AntecedentKind : 'Enfermedad previa o crónica');
    this.entryFormOpen.set(true); this.editingEntry.set(entry.id); this.entryTitle.set(parts.length ? parts.join(': ') : entry.title);
    this.entrySummary.set(entry.summary); this.entryDate.set(entry.occurredAt.slice(0, 10)); this.entryError.set('');
    this.view.set('antecedentes');
    document.getElementById('history-antecedent-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  saveEntry(): void {
    const title = this.entryTitle().trim(); const summary = this.entrySummary().trim();
    if (!title || !summary || !this.entryDate()) { this.entryError.set('Completa el tipo, el dato, la descripción y la fecha.'); return; }
    if (title.length > 80 || summary.length > 400 || this.entryDate() > localDate()) { this.entryError.set('Revisa el texto (máximo 80/400 caracteres) y la fecha.'); return; }
    const entry: PatientDeclaredAntecedent = {
      id: this.editingEntry() ?? `antecedent-${Date.now()}`,
      title: `${this.entryKind()}: ${title}`, summary, occurredAt: `${this.entryDate()}T12:00:00`,
      category: 'antecedentes', source: 'paciente', status: 'Declarado por el paciente',
    };
    this.history.savePatientAntecedent(entry); this.entryFormOpen.set(false); this.editingEntry.set(null); this.entryError.set('');
  }

  cancelEntry(): void { this.entryFormOpen.set(false); this.editingEntry.set(null); this.entryError.set(''); }
  deleteEntry(entry: PatientDeclaredAntecedent): void {
    if (confirm(`¿Eliminar el antecedente declarado «${entry.title}»?`)) {
      this.history.deletePatientAntecedent(entry.id);
      if (this.selectedRecord()?.id === entry.id) this.selectedRecord.set(null);
    }
  }

  clearFilters(): void { this.query.set(''); this.dateFrom.set(''); this.dateTo.set(''); this.sortOrder.set('newest'); }
}
