import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Doctor, DoctorFilters, EMPTY_FILTERS, SortKey, SPECIALTIES, TimeSlot, doctorFullName, specialtyFilterLabel } from './doctors.models';
import { DoctorsService } from './doctors.service';
import { filterDoctors, nextOpenSlot, paginate, sortDoctors, toYmd } from './doctors.query';
import { SpecialtyStripComponent } from './components/specialty-strip.component';

@Component({
  selector: 'app-doctors-page', standalone: true, imports: [DatePipe, SpecialtyStripComponent],
  templateUrl: './doctors-page.html', styleUrl: './doctors-page.css',
})
export class DoctorsPage {
  readonly service = inject(DoctorsService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly specialties = SPECIALTIES;
  readonly filters = signal<DoctorFilters>({ ...EMPTY_FILTERS });
  readonly draftFilters = signal<DoctorFilters>({ ...EMPTY_FILTERS });
  readonly sort = signal<SortKey>('relevancia');
  readonly page = signal(1);
  readonly pageSize = 6;
  readonly profile = signal<Doctor | null>(null);
  readonly selectedDoctors = computed(() => sortDoctors(filterDoctors(this.service.doctors(), this.filters()), this.sort()));
  readonly visibleDoctors = computed(() => paginate(this.selectedDoctors(), this.page(), this.pageSize));
  readonly canLoadMore = computed(() => this.page() * this.pageSize < this.selectedDoctors().length);
  readonly locations = computed(() => [...new Set(this.service.doctors().map((doctor) => doctor.location))].sort());

  constructor() {
    this.service.load();
    this.route.queryParamMap.subscribe((params) => {
      const specialty = params.get('especialidad');
      if (!specialty) return;
      const value = specialtyFilterLabel(specialty);
      const filters = { ...this.draftFilters(), specialty: value };
      this.draftFilters.set(filters);
      this.filters.set(filters);
    });
  }
  update<K extends keyof DoctorFilters>(key: K, value: DoctorFilters[K]): void {
    this.draftFilters.update((filters) => ({ ...filters, [key]: value }));
  }
  applyFilters(): void { this.filters.set({ ...this.draftFilters() }); this.page.set(1); }
  clearFilters(): void { this.filters.set({ ...EMPTY_FILTERS }); this.draftFilters.set({ ...EMPTY_FILTERS }); this.page.set(1); }
  quickSpecialty(value: string): void { this.update('specialty', this.draftFilters().specialty === value ? '' : value); this.applyFilters(); }
  setSort(value: string): void { this.sort.set(value as SortKey); this.page.set(1); }
  showProfile(doctor: Doctor): void { this.profile.set(doctor); }
  startBooking(doctor: Doctor): void { this.profile.set(null); void this.router.navigate(['/reservar'], { queryParams: { medico: doctor.id } }); }
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
