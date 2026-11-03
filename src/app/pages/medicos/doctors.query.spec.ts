import { Doctor, EMPTY_FILTERS } from './doctors.models';
import { filterDoctors, nextOpenSlot, sortDoctors } from './doctors.query';

function doctor(partial: Partial<Doctor> & Pick<Doctor, 'id' | 'firstName' | 'lastName' | 'specialty'>): Doctor {
  return {
    demo: true,
    license: 'CMP DEMO 1',
    yearsExperience: 5,
    rating: 4,
    reviewCount: 10,
    price: 100,
    modalities: ['presencial'],
    location: 'Miraflores',
    city: 'Lima',
    gender: 'femenino',
    languages: ['Español'],
    university: 'UPCH',
    education: [],
    bio: 'Demo',
    initials: 'AA',
    color: '#087bfa',
    conditions: ['acné'],
    reviews: [],
    slots: [{ date: '2026-11-03', time: '15:00', modality: 'presencial', taken: false }],
    ...partial,
  };
}

const now = new Date(2026, 10, 3, 8, 0, 0);

describe('doctors.query', () => {
  const catalog = [
    doctor({ id: 'a', firstName: 'Ana', lastName: 'Ríos', specialty: 'Dermatología', price: 150, rating: 4.9, reviewCount: 80, yearsExperience: 9 }),
    doctor({
      id: 'b',
      firstName: 'Diego',
      lastName: 'León',
      specialty: 'Cardiología',
      price: 90,
      rating: 4.2,
      reviewCount: 20,
      yearsExperience: 16,
      modalities: ['virtual'],
      location: 'San Isidro',
      gender: 'masculino',
      languages: ['Español', 'Inglés'],
      conditions: ['hipertensión'],
      slots: [{ date: '2026-11-04', time: '09:00', modality: 'virtual', taken: false }],
    }),
  ];

  it('filtra por nombre, especialidad y condición', () => {
    expect(filterDoctors(catalog, { ...EMPTY_FILTERS, query: 'rios' }, now).map((d) => d.id)).toEqual(['a']);
    expect(filterDoctors(catalog, { ...EMPTY_FILTERS, query: 'hipertension' }, now).map((d) => d.id)).toEqual(['b']);
    expect(filterDoctors(catalog, { ...EMPTY_FILTERS, specialty: 'Cardiología' }, now).map((d) => d.id)).toEqual(['b']);
  });

  it('combina modalidad, disponibilidad y precio', () => {
    const result = filterDoctors(
      catalog,
      { ...EMPTY_FILTERS, modality: 'virtual', availability: 'manana', priceMax: 100 },
      now,
    );
    expect(result.map((d) => d.id)).toEqual(['b']);
  });

  it('ordena por menor precio y por experiencia', () => {
    expect(sortDoctors(catalog, 'precio', now).map((d) => d.id)).toEqual(['b', 'a']);
    expect(sortDoctors(catalog, 'experiencia', now).map((d) => d.id)).toEqual(['b', 'a']);
  });

  it('ignora horarios ocupados al calcular la próxima cita', () => {
    const busy = doctor({
      id: 'c',
      firstName: 'Eva',
      lastName: 'Luna',
      specialty: 'Pediatría',
      slots: [
        { date: '2026-11-03', time: '09:00', modality: 'presencial', taken: true },
        { date: '2026-11-03', time: '16:30', modality: 'presencial', taken: false },
      ],
    });
    expect(nextOpenSlot(busy, now)?.time).toBe('16:30');
  });
});
