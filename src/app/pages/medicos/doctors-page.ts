import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Doctor, DoctorFilters, EMPTY_FILTERS, Modality, SortKey, SPECIALTIES, TimeSlot, doctorFullName } from './doctors.models';
import { DoctorsService } from './doctors.service';
import { AppointmentsService } from '../../services/appointments.service';
import { filterDoctors, nextOpenSlot, paginate, sortDoctors, toYmd } from './doctors.query';
import { SpecialtyStripComponent } from './components/specialty-strip.component';

@Component({
  selector: 'app-doctors-page', standalone: true, imports: [DatePipe, SpecialtyStripComponent],
  templateUrl: './doctors-page.html', styleUrl: './doctors-page.css',
})
export class DoctorsPage {
  readonly service = inject(DoctorsService);
  private readonly appointments = inject(AppointmentsService);
  readonly specialties = SPECIALTIES;
  readonly filters = signal<DoctorFilters>({ ...EMPTY_FILTERS });
  readonly draftFilters = signal<DoctorFilters>({ ...EMPTY_FILTERS });
  readonly sort = signal<SortKey>('relevancia');
  readonly page = signal(1);
  readonly pageSize = 6;
  readonly profile = signal<Doctor | null>(null);
  readonly booking = signal<Doctor | null>(null);
  readonly bookingStep = signal(1);
  readonly visitMode = signal<Modality | ''>('');
  readonly visitDate = signal('');
  readonly visitTime = signal('');
  readonly bookingBusy = signal(false);
  readonly bookingMessage = signal('');
  readonly selectedDoctors = computed(() => sortDoctors(filterDoctors(this.service.doctors(), this.filters()), this.sort()));
  readonly visibleDoctors = computed(() => paginate(this.selectedDoctors(), this.page(), this.pageSize));
  readonly canLoadMore = computed(() => this.page() * this.pageSize < this.selectedDoctors().length);
  readonly locations = computed(() => [...new Set(this.service.doctors().map((doctor) => doctor.location))].sort());
  readonly availableSlots = computed(() => {
    const doctor = this.booking();
    if (!doctor) return [];
    return doctor.slots.filter((slot) => !slot.taken && slot.date >= toYmd(new Date()) && (!this.visitMode() || slot.modality === this.visitMode()));
  });
  readonly bookingDates = computed(() => [...new Set(this.availableSlots().map((slot) => slot.date))].sort());
  readonly bookingTimes = computed(() => this.availableSlots().filter((slot) => slot.date === this.visitDate()).map((slot) => slot.time));

  constructor() { this.service.load(); }
  update<K extends keyof DoctorFilters>(key: K, value: DoctorFilters[K]): void {
    this.draftFilters.update((filters) => ({ ...filters, [key]: value }));
  }
  applyFilters(): void { this.filters.set({ ...this.draftFilters() }); this.page.set(1); }
  clearFilters(): void { this.filters.set({ ...EMPTY_FILTERS }); this.draftFilters.set({ ...EMPTY_FILTERS }); this.page.set(1); }
  quickSpecialty(value: string): void { this.update('specialty', this.draftFilters().specialty === value ? '' : value); this.applyFilters(); }
  setSort(value: string): void { this.sort.set(value as SortKey); this.page.set(1); }
  showProfile(doctor: Doctor): void { this.profile.set(doctor); }
  startBooking(doctor: Doctor): void {
    this.profile.set(null); this.bookingMessage.set(''); this.booking.set(doctor); this.bookingStep.set(1);
    this.visitMode.set(''); this.visitDate.set(''); this.visitTime.set('');
  }
  chooseMode(mode: Modality): void { this.visitMode.set(mode); this.visitDate.set(''); this.visitTime.set(''); }
  chooseDate(date: string): void { this.visitDate.set(date); this.visitTime.set(''); }
  nextStep(): void { if (this.bookingStep() < 4) this.bookingStep.update((step) => step + 1); }
  previousStep(): void { if (this.bookingStep() > 1) this.bookingStep.update((step) => step - 1); }
  confirmBooking(): void {
    const doctor = this.booking(); const date = this.visitDate(); const time = this.visitTime(); const modality = this.visitMode();
    if (!doctor || !date || !time || !modality || this.bookingBusy()) return;
    this.bookingBusy.set(true); this.bookingMessage.set('');
    this.service.occupySlot(doctor.id, date, time).subscribe({
      next: () => {
        this.appointments.add({ id: `demo-${Date.now()}`, doctorId: doctor.id, doctorName: doctorFullName(doctor), specialty: doctor.specialty, date, time, modality, price: doctor.price, createdAt: new Date().toISOString(), demo: true, status: 'confirmada' });
        this.bookingBusy.set(false); this.bookingStep.set(5);
      },
      error: () => { this.bookingBusy.set(false); this.bookingMessage.set('Ese horario ya no está disponible. Elige otro horario.'); this.visitTime.set(''); this.service.load(); },
    });
  }
  nextSlot(doctor: Doctor): TimeSlot | null { return nextOpenSlot(doctor); }
  fullName(doctor: Doctor): string { return doctorFullName(doctor); }
  ratingStars(rating: number): string { return '★'.repeat(Math.round(rating)); }
  setPriceRange(value: string): void {
    const ranges: Record<string, [number | null, number | null]> = { '': [null, null], low: [null, 100], mid: [101, 150], high: [151, null] };
    const [priceMin, priceMax] = ranges[value] ?? [null, null];
    this.draftFilters.update((filters) => ({ ...filters, priceMin, priceMax }));
  }
  priceRange(): string {
    const { priceMin, priceMax } = this.draftFilters();
    if (priceMax === 100) return 'low';
    if (priceMin === 101 && priceMax === 150) return 'mid';
    if (priceMin === 151 && priceMax == null) return 'high';
    return '';
  }
}
