import {
  AvailabilityWindow,
  Doctor,
  DoctorFilters,
  SortKey,
  TimeSlot,
  doctorSpecialtyName,
} from './doctors.models';

export function toYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDays(base: Date, days: number): Date {
  const next = new Date(base);
  next.setDate(next.getDate() + days);
  next.setHours(0, 0, 0, 0);
  return next;
}

export function slotDateTime(slot: TimeSlot): Date {
  const [h, min] = slot.time.split(':').map(Number);
  const [y, m, d] = slot.date.split('-').map(Number);
  return new Date(y, m - 1, d, h, min, 0, 0);
}

export function isFutureSlot(slot: TimeSlot, now = new Date()): boolean {
  return !slot.taken && slotDateTime(slot).getTime() >= now.getTime();
}

export function nextOpenSlot(doctor: Doctor, now = new Date()): TimeSlot | null {
  return doctor.slots
    .filter((slot) => isFutureSlot(slot, now))
    .sort((a, b) => slotDateTime(a).getTime() - slotDateTime(b).getTime())[0] ?? null;
}

export function matchesAvailability(
  doctor: Doctor,
  window: AvailabilityWindow,
  now = new Date(),
): boolean {
  const today = toYmd(now);
  const tomorrow = toYmd(addDays(now, 1));
  const weekEnd = toYmd(addDays(now, 6));
  return doctor.slots.some((slot) => {
    if (!isFutureSlot(slot, now)) return false;
    if (window === 'hoy') return slot.date === today;
    if (window === 'manana') return slot.date === tomorrow;
    return slot.date >= today && slot.date <= weekEnd;
  });
}

function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function filterDoctors(doctors: Doctor[], filters: DoctorFilters, now = new Date()): Doctor[] {
  const query = normalize(filters.query);
  return doctors.filter((doctor) => {
    if (filters.specialty && doctor.specialty !== doctorSpecialtyName(filters.specialty)) return false;
    if (filters.location && doctor.location !== filters.location) return false;
    if (filters.modality && !doctor.modalities.includes(filters.modality)) return false;
    if (filters.gender && doctor.gender !== filters.gender) return false;
    if (filters.language && !doctor.languages.includes(filters.language)) return false;
    if (filters.priceMin != null && doctor.price < filters.priceMin) return false;
    if (filters.priceMax != null && doctor.price > filters.priceMax) return false;
    if (filters.minRating != null && doctor.rating < filters.minRating) return false;
    if (filters.availability && !matchesAvailability(doctor, filters.availability, now)) return false;
    if (!query) return true;
    const haystack = normalize(
      [
        doctor.firstName,
        doctor.lastName,
        doctor.specialty,
        doctor.location,
        ...doctor.conditions,
      ].join(' '),
    );
    return haystack.includes(query);
  });
}

export function sortDoctors(doctors: Doctor[], sort: SortKey, now = new Date()): Doctor[] {
  return [...doctors].sort((a, b) => {
    if (sort === 'calificacion') return b.rating - a.rating || b.reviewCount - a.reviewCount;
    if (sort === 'precio') return a.price - b.price;
    if (sort === 'experiencia') return b.yearsExperience - a.yearsExperience;
    if (sort === 'disponibilidad') {
      const nextA = nextOpenSlot(a, now);
      const nextB = nextOpenSlot(b, now);
      if (!nextA) return 1;
      if (!nextB) return -1;
      return slotDateTime(nextA).getTime() - slotDateTime(nextB).getTime();
    }
    const score = (doctor: Doctor) => doctor.rating * Math.log10(doctor.reviewCount + 1);
    return score(b) - score(a);
  });
}

export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * pageSize;
  return items.slice(start, start + pageSize);
}
