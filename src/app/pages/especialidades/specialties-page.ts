import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { nextOpenSlot } from '../medicos/doctors.query';
import { Doctor } from '../medicos/doctors.models';
import { DoctorsService } from '../medicos/doctors.service';
import { SpecialtyCardComponent } from './specialty-card.component';
import { SPECIALTY_CATALOG, SPECIALTY_CATEGORIES, SpecialtyCategory, SpecialtyInfo } from './specialties.catalog';

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}

@Component({
  selector: 'app-specialties-page', standalone: true, imports: [RouterLink, SpecialtyCardComponent],
  templateUrl: './specialties-page.html', styleUrl: './specialties-page.css',
})
export class SpecialtiesPage {
  readonly service = inject(DoctorsService);
  readonly catalog = SPECIALTY_CATALOG;
  readonly categories = SPECIALTY_CATEGORIES;
  readonly query = signal('');
  readonly category = signal<SpecialtyCategory>('Todas');
  readonly detail = signal<SpecialtyInfo | null>(null);
  readonly featured = this.catalog.filter((specialty) => specialty.featured);
  readonly visibleSpecialties = computed(() => {
    const query = normalize(this.query());
    const category = this.category();
    return this.catalog.filter((specialty) => {
      const categoryMatches = category === 'Todas' || specialty.category === category;
      const searchMatches = !query || normalize(`${specialty.name} ${specialty.description} ${specialty.overview} ${specialty.reasons.join(' ')}`).includes(query);
      return categoryMatches && searchMatches;
    });
  });

  constructor() { this.service.load(); }

  countFor(specialty: SpecialtyInfo): number | null {
    if (this.service.loading()) return null;
    return this.service.doctors().filter((doctor) => doctor.specialty === specialty.doctorSpecialty && this.hasFutureAvailability(doctor)).length;
  }

  private hasFutureAvailability(doctor: Doctor): boolean {
    return !!nextOpenSlot(doctor);
  }

  setCategory(category: SpecialtyCategory): void { this.category.set(category); }
}
