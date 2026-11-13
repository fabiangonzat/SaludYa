import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Doctor, Modality, SPECIALTIES, doctorFullName, doctorSpecialtyName, specialtyFilterLabel } from '../medicos/doctors.models';
import { DoctorsService } from '../medicos/doctors.service';
import { AppointmentsService } from '../../services/appointments.service';
import { AuthService } from '../../services/auth.service';
import { CulqiCheckoutService } from '../../services/culqi-checkout.service';
import { PaymentsService } from '../../services/payments.service';
import { environment } from '../../../environments/environment';

@Component({ selector: 'app-reservation-page', standalone: true, imports: [DatePipe, FormsModule, RouterLink], templateUrl: './reservation-page.html', styleUrl: './reservation-page.css' })
export class ReservationPage {
  readonly doctorsService = inject(DoctorsService);
  readonly appointments = inject(AppointmentsService);
  private readonly auth = inject(AuthService);
  private readonly culqi = inject(CulqiCheckoutService);
  private readonly payments = inject(PaymentsService);
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
    return doctor.slots.filter((slot) => !slot.taken && (!this.modality() || slot.modality === this.modality()) && this.isFuture(slot.date, slot.time));
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
        void this.doctorsService.getById(doctorId).then((doctor) => {
          if (doctor) this.selectedSpecialty.set(doctor.specialty);
          else this.message.set('Ese perfil ya no está disponible.');
        });
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
  async confirm(): Promise<void> {
    const doctor = this.selectedDoctor();
    if (!doctor || this.busy() || !this.reason().trim()) return;
    if (!environment.culqiPublicKey) {
      this.message.set('Los pagos aún no están configurados. El administrador debe agregar la llave pública de Culqi para activar esta etapa.');
      return;
    }
    const user = this.auth.currentUser();
    if (!user) { this.message.set('Tu sesión expiró. Ingresa nuevamente para pagar.'); return; }
    this.busy.set(true); this.message.set('');
    let appointmentId = this.createdId();
    if (!appointmentId) {
      const result = await this.appointments.create({
        doctorId: doctor.id,
        specialtyId: doctor.specialty_id,
        date: this.date(),
        time: this.time(),
        modality: this.modality() as Modality,
        price: doctor.price,
        reason: this.reason().trim(),
        symptoms: this.symptoms().trim(),
      });
      if (result.error || !result.data) {
        this.busy.set(false);
        this.message.set(result.error ?? 'Ese horario ya no está disponible. Elige otro.');
        this.step.set(3); this.date.set(''); this.time.set('');
        await this.doctorsService.load();
        return;
      }
      appointmentId = result.data.id;
      this.createdId.set(appointmentId);
    }
    try {
      const paymentToken = await this.culqi.open({ publicKey: environment.culqiPublicKey, amount: Number(doctor.price), email: user.email, fullName: user.fullName });
      const result = await this.payments.chargeWithCulqi(appointmentId, paymentToken);
      if (result.error) throw new Error(result.error);
      this.step.set(6);
    } catch (error) {
      this.message.set(error instanceof Error ? error.message : 'No se pudo completar el pago. Puedes intentarlo nuevamente.');
    } finally {
      this.busy.set(false);
    }
  }
  private isFuture(date: string, time: string): boolean {
    const [year, month, day] = date.split('-').map(Number); const [hour, minute] = time.split(':').map(Number);
    return new Date(year, month - 1, day, hour, minute).getTime() > Date.now();
  }
}
