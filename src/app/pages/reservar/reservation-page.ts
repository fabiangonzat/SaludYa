import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Doctor, Modality, SPECIALTIES, doctorFullName, doctorSpecialtyName, specialtyFilterLabel } from '../medicos/doctors.models';
import { DoctorsService } from '../medicos/doctors.service';
import { AppointmentsService } from '../../services/appointments.service';

@Component({ selector: 'app-reservation-page', standalone: true, imports: [DatePipe, FormsModule, RouterLink], templateUrl: './reservation-page.html', styleUrl: './reservation-page.css' })
export class ReservationPage {
  readonly doctorsService = inject(DoctorsService);
  readonly appointments = inject(AppointmentsService);
  private readonly route = inject(ActivatedRoute);
  readonly specialties = SPECIALTIES;
  readonly step = signal(1);
  readonly selectedSpecialty = signal('');
  readonly specialtyQuery = signal('');
  readonly profile = signal<Doctor|null>(null);
  readonly selectedDoctorId = signal('');
  readonly modality = signal<Modality | ''>('');
  readonly date = signal('');
  readonly time = signal('');
  readonly reason = signal('');
  readonly symptoms = signal('');
  readonly notes = signal('');
  readonly message = signal('');
  readonly busy = signal(false);
  readonly createdId = signal('');
  readonly doctors = computed(() => this.doctorsService.doctors().filter((doctor) => !this.selectedSpecialty() || doctorSpecialtyName(doctor.specialty) === doctorSpecialtyName(this.selectedSpecialty())));
  readonly filteredSpecialties = computed(() => this.specialties.filter(specialty => specialty.toLocaleLowerCase('es').includes(this.specialtyQuery().trim().toLocaleLowerCase('es'))));
  readonly selectedDoctor = computed(() => this.doctorsService.doctors().find((doctor) => doctor.id === this.selectedDoctorId()) ?? null);
  readonly slots = computed(() => {
    const doctor = this.selectedDoctor();
    if (!doctor) return [];
    return doctor.slots.filter((slot) => !slot.taken && (!this.modality() || slot.modality === this.modality()) && this.isFuture(slot.date, slot.time) && !this.appointments.hasSlot(doctor.id, slot.date, slot.time));
  });
  readonly dates = computed(() => [...new Set(this.slots().map((slot) => slot.date))].sort());
  readonly times = computed(() => this.slots().filter((slot) => slot.date === this.date()).map((slot) => slot.time));

  constructor() {
    this.doctorsService.load();
    this.route.queryParamMap.subscribe((params) => {
      const specialty = params.get('especialidad');
      if (specialty) this.selectedSpecialty.set(specialtyFilterLabel(specialty));
      const doctorId = params.get('medico');
      if (doctorId) {
        this.selectedDoctorId.set(doctorId);
        this.step.set(2);
        this.doctorsService.getById(doctorId).subscribe({next: (doctor) => this.selectedSpecialty.set(doctor.specialty), error: () => this.message.set('Ese perfil ya no está en el catálogo de demostración.')});
      }
    });
  }
  fullName(doctor: Doctor): string { return doctorFullName(doctor); }
  selectProfileDoctor():void{const doctor=this.profile();if(!doctor)return;this.selectDoctor(doctor);this.profile.set(null);this.step.set(3);}
  selectSpecialty(value: string): void { this.selectedSpecialty.set(value); this.selectedDoctorId.set(''); this.modality.set(''); this.date.set(''); this.time.set(''); }
  selectDoctor(doctor: Doctor): void { this.selectedDoctorId.set(doctor.id); this.selectedSpecialty.set(doctor.specialty); this.modality.set(''); this.date.set(''); this.time.set(''); }
  selectModality(value: Modality): void { this.modality.set(value); this.date.set(''); this.time.set(''); }
  selectDate(value: string): void { this.date.set(value); this.time.set(''); }
  back(): void { if (this.step() > 1) this.step.update((value) => value - 1); }
  continue(): void {
    this.message.set('');
    const valid = this.step() === 1 ? !!this.selectedSpecialty() : this.step() === 2 ? !!this.selectedDoctorId() : this.step() === 3 ? !!this.modality() && !!this.date() && !!this.time() : this.step() === 4 ? this.reason().trim().length >= 3 : false;
    if (!valid) { this.message.set('Completa los datos requeridos para continuar.'); return; }
    if (this.step() < 5) this.step.update((value) => value + 1);
  }
  confirm(): void {
    const doctor = this.selectedDoctor();
    if (!doctor || this.busy() || !this.reason().trim()) return;
    this.busy.set(true); this.message.set('');
    this.doctorsService.occupySlot(doctor.id, this.date(), this.time()).subscribe({
      next: () => {
        const appointment = this.appointments.create({ doctorId: doctor.id, doctorName: doctorFullName(doctor), doctorInitials: doctor.initials, doctorColor: doctor.color, specialty: doctor.specialty, date: this.date(), time: this.time(), modality: this.modality() as Modality, price: doctor.price, reason: this.reason().trim(), symptoms: this.symptoms().trim(), notes: this.notes().trim(), demo: true });
        this.busy.set(false);
        if (!appointment) { this.message.set('No se pudo guardar: el horario pudo ocuparse o la fecha ya pasó. Vuelve a elegir un horario.'); this.step.set(3); this.date.set(''); this.time.set(''); this.doctorsService.load(); return; }
        this.createdId.set(appointment.id); this.step.set(6);
      },
      error: () => { this.busy.set(false); this.message.set('Ese horario ya no está disponible. Elige otro.'); this.step.set(3); this.date.set(''); this.time.set(''); this.doctorsService.load(); },
    });
  }
  private isFuture(date: string, time: string): boolean {
    const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime() > Date.now();
  }
}
