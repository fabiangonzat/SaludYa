import { Component, inject, OnInit, signal } from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../../services/auth.service';
import { AvailabilityService, DoctorAvailabilityRow } from '../../../services/availability.service';
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
  private readonly doctorsService = inject(DoctorsService);
  private readonly fb = inject(FormBuilder);

  readonly days = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
  readonly loading = this.availabilityService.loading;
  readonly currentAvailability = this.availabilityService.availability;

  doctorId = signal<string | null>(null);
  saving = signal(false);
  generating = signal(false);
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
    if (user) {
      const doctor = await this.doctorsService.getByProfileId(user.id);
      if (doctor) {
        this.doctorId.set(doctor.id);
        await this.availabilityService.loadAvailability(doctor.id);
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
      }
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
    if (!id) return;
    this.saving.set(true);
    this.successMsg.set('');
    this.errorMsg.set('');

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
      this.errorMsg.set('Error al guardar: ' + error);
    } else {
      this.successMsg.set('Disponibilidad guardada correctamente.');
    }
    this.saving.set(false);
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
