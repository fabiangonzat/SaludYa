import { Component, inject, OnInit, signal } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { AvailabilityService, DoctorAvailabilityRow } from '../../../services/availability.service';
import { DoctorVerificationService } from '../../../services/doctor-verification.service';
import { DoctorsService } from '../../medicos/doctors.service';

type Modality = 'presencial' | 'virtual';

interface AvailabilityEntry {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotDurationMinutes: number;
  modality: Modality;
}

@Component({
  selector: 'app-doctor-availability',
  standalone: true,
  imports: [NgIf, NgFor, NgClass, ReactiveFormsModule],
  templateUrl: './doctor-availability.html',
  styleUrl: './doctor-availability.css',
})
export class DoctorAvailabilityComponent implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly availabilityService = inject(AvailabilityService);
  private readonly verificationService = inject(DoctorVerificationService);
  private readonly doctorsService = inject(DoctorsService);
  private readonly fb = inject(FormBuilder);

  readonly days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  readonly loading = this.availabilityService.loading;
  readonly currentAvailability = this.availabilityService.availability;

  doctorId = signal<string | null>(null);
  saving = signal(false);
  generating = signal(false);
  saveMessage = signal('');
  saveMessageKind = signal<'info' | 'success' | 'error'>('info');
  successMsg = signal('');
  errorMsg = signal('');

  entries = signal<AvailabilityEntry[]>([]);

  addForm = this.fb.nonNullable.group({
    dayOfWeek: [1, Validators.required],
    startTime: ['08:00', Validators.required],
    endTime: ['17:00', Validators.required],
    slotDurationMinutes: [30, [Validators.required, Validators.min(10)]],
    modality: ['presencial' as Modality, Validators.required],
  });

  async ngOnInit(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user) {
      this.saveMessageKind.set('error');
      this.saveMessage.set('No se pudo cargar tu sesión. Cierra sesión y vuelve a ingresar.');
      return;
    }

    try {
      const { id, error: doctorLookupError } = await this.doctorsService.getIdByProfileId(user.id);
      if (doctorLookupError) {
        this.saveMessageKind.set('error');
        this.saveMessage.set('No pudimos consultar tu ficha médica en Supabase: ' + doctorLookupError);
        return;
      }

      if (!id) {
        const { request, error } = await this.verificationService.getOwnRequestStatus();
        this.saveMessageKind.set(error ? 'error' : 'info');
        if (error) {
          this.saveMessage.set('No pudimos consultar el estado de tu verificación médica. ' + error);
        } else if (request?.status === 'pending') {
          this.saveMessage.set('Tu documentación está pendiente de aprobación. La disponibilidad se habilitará cuando Administración apruebe tu perfil.');
        } else if (request?.status === 'rejected') {
          this.saveMessage.set(request.review_note
            ? `Tu solicitud fue rechazada: ${request.review_note}`
            : 'Tu solicitud médica fue rechazada. Contacta a Administración para conocer los pasos siguientes.');
        } else if (request?.status === 'approved') {
          this.saveMessageKind.set('error');
          this.saveMessage.set('Tu solicitud figura aprobada, pero falta crear tu perfil profesional. Administración debe reparar ese registro.');
        } else {
          this.saveMessageKind.set('error');
          this.saveMessage.set('Esta cuenta no tiene un perfil profesional ni una solicitud de verificación. Administración debe revisar la cuenta antes de habilitar horarios.');
        }
        return;
      }

      this.doctorId.set(id);
      await this.availabilityService.loadAvailability(id);
      // Mapear disponibilidad existente a entries
      this.entries.set(
        this.currentAvailability().map((a) => ({
          dayOfWeek: a.day_of_week,
          startTime: a.start_time,
          endTime: a.end_time,
          slotDurationMinutes: a.slot_duration_minutes,
          modality: a.modality,
        }))
      );
    } catch (error) {
      this.saveMessageKind.set('error');
      this.saveMessage.set('No pudimos cargar tu perfil médico. Revisa tu conexión e inténtalo de nuevo.');
      console.error('Error al cargar el perfil médico:', error);
    }
  }

  addEntry(): void {
    if (this.addForm.invalid) return;
    const v = this.addForm.getRawValue();
    if (v.startTime >= v.endTime) {
      this.errorMsg.set('La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }
    this.errorMsg.set('');
    this.entries.update((list) => [
      ...list,
      {
        dayOfWeek: +v.dayOfWeek,
        startTime: v.startTime,
        endTime: v.endTime,
        slotDurationMinutes: +v.slotDurationMinutes,
        modality: v.modality,
      },
    ]);
  }

  removeEntry(index: number): void {
    this.entries.update((list) => list.filter((_, i) => i !== index));
  }

  async save(): Promise<void> {
    const id = this.doctorId();
    if (!id) {
      if (!this.saveMessage()) {
        this.saveMessageKind.set('error');
        this.saveMessage.set('No se puede guardar porque esta cuenta todavía no tiene un perfil médico habilitado.');
      }
      return;
    }
    this.saving.set(true);
    this.saveMessageKind.set('info');
    this.saveMessage.set('Guardando disponibilidad…');

    try {
      const { error } = await this.availabilityService.saveAvailability(
        id,
        this.entries().map((e) => ({
          day_of_week: e.dayOfWeek,
          start_time: e.startTime,
          end_time: e.endTime,
          slot_duration_minutes: e.slotDurationMinutes,
          modality: e.modality,
          is_active: true,
        }))
      );

      if (error) {
        this.saveMessageKind.set('error');
        this.saveMessage.set('No se pudo guardar la disponibilidad: ' + error);
      } else {
        this.saveMessageKind.set('success');
        this.saveMessage.set('Disponibilidad guardada correctamente.');
      }
    } catch (error) {
      this.saveMessageKind.set('error');
      this.saveMessage.set('No se pudo guardar la disponibilidad. Revisa tu conexión e inténtalo otra vez.');
      console.error('Error al guardar disponibilidad:', error);
    } finally {
      this.saving.set(false);
    }
  }

  async generateSlots(): Promise<void> {
    const id = this.doctorId();
    if (!id) return;
    this.generating.set(true);
    this.successMsg.set('');

    const today = new Date().toISOString().slice(0, 10);
    const { generated, error } = await this.availabilityService.generateSlots(id, today, 60);

    if (error) {
      this.errorMsg.set('Error generando slots: ' + error);
    } else {
      this.successMsg.set(`Se generaron ${generated} slots disponibles para los próximos 60 días.`);
    }
    this.generating.set(false);
  }

  dayName(d: number): string { return this.days[d] ?? ''; }

  slotCount(e: AvailabilityEntry): number {
    const [sh, sm] = e.startTime.split(':').map(Number);
    const [eh, em] = e.endTime.split(':').map(Number);
    const total = (eh * 60 + em) - (sh * 60 + sm);
    return Math.max(0, Math.floor(total / e.slotDurationMinutes));
  }
}
