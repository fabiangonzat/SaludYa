import { Component, inject, signal } from '@angular/core';
import { NgIf, NgClass } from '@angular/common';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService, UserRole } from '../../services/auth.service';
import { DoctorVerificationService } from '../../services/doctor-verification.service';

type RegisterField = 'nombre' | 'email' | 'telefono' | 'fechaNacimiento' | 'password' | 'confirmPassword';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [NgIf, NgClass, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private verification = inject(DoctorVerificationService);
  private router = inject(Router);

  readonly maxBirthDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date());

  selectedRole = signal<UserRole>('patient');

  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/^\S+(\s+\S+)+$/)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^\d{7,15}$/)]],
    fechaNacimiento: ['', [Validators.required, this.notFutureDate]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
    // Campos adicionales para médico
    licencia: [''],
    especialidad: [''],
    universidad: [''],
    experiencia: [''],
    bio: [''],
    precio: [''],
  }, { validators: this.passwordsMatch });

  submitted = false;
  loading = signal(false);
  showPassword = false;
  errorMessage = signal('');
  successMessage = signal('');
  doctorDocuments = signal<File[]>([]);

  selectRole(role: UserRole): void {
    this.selectedRole.set(role);
    // Actualizar validaciones dinámicamente
    if (role === 'doctor') {
      this.form.controls.licencia.setValidators([Validators.required]);
      this.form.controls.especialidad.setValidators([Validators.required]);
      this.form.controls.precio.setValidators([Validators.required, Validators.min(1)]);
    } else {
      this.form.controls.licencia.clearValidators();
      this.form.controls.especialidad.clearValidators();
      this.form.controls.precio.clearValidators();
    }
    this.form.controls.licencia.updateValueAndValidity();
    this.form.controls.especialidad.updateValueAndValidity();
    this.form.controls.precio.updateValueAndValidity();
  }

  private notFutureDate(control: AbstractControl): ValidationErrors | null {
    return control.value && control.value > new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Bogota' }).format(new Date())
      ? { futureDate: true } : null;
  }
  private passwordsMatch(control: AbstractControl): ValidationErrors | null {
    return control.get('password')?.value === control.get('confirmPassword')?.value ? null : { passwordMismatch: true };
  }

  hasError(name: RegisterField): boolean {
    const control = this.form.controls[name];
    return (control.invalid && (control.touched || this.submitted))
      || (name === 'confirmPassword' && this.form.hasError('passwordMismatch') && (control.touched || this.submitted));
  }

  fieldMessage(name: keyof typeof this.form.controls): string {
    const control = this.form.controls[name];
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('email')) return 'Ingresa un correo electrónico válido.';
    if (name === 'nombre' && control.hasError('pattern')) return 'Escribe tu nombre y apellido.';
    if (name === 'telefono' && control.hasError('pattern')) return 'Ingresa un número de teléfono válido.';
    if (name === 'fechaNacimiento' && control.hasError('futureDate')) return 'La fecha de nacimiento no puede ser futura.';
    if (name === 'password' && control.hasError('minlength')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (name === 'confirmPassword' && this.form.hasError('passwordMismatch')) return 'Las contraseñas no coinciden.';
    return 'Revisa este campo.';
  }

  onlyDigits(event: Event): void {
    const input = event.target as HTMLInputElement;
    input.value = input.value.replace(/\D/g, '').slice(0, 15);
    this.form.controls.telefono.setValue(input.value);
  }

  onDocumentsSelected(event: Event): void {
    const files = Array.from((event.target as HTMLInputElement).files ?? []);
    this.doctorDocuments.set(files);
  }

  async submit(): Promise<void> {
    this.submitted = true;
    this.errorMessage.set('');
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.selectedRole() === 'doctor') {
      const documentError = this.verification.validateFiles(this.doctorDocuments());
      if (documentError) { this.errorMessage.set(documentError); return; }
    }

    const value = this.form.getRawValue();
    this.loading.set(true);

    const { error } = await this.auth.signUp({
      email: value.email.trim(),
      password: value.password,
      fullName: value.nombre.trim(),
      phone: value.telefono,
      birthDate: value.fechaNacimiento,
      role: this.selectedRole(),
    });

    if (error) {
      this.errorMessage.set(error);
      this.loading.set(false);
      return;
    }

    // Un médico no entra al directorio hasta que Administración apruebe sus documentos.
    if (this.selectedRole() === 'doctor') {
      const verification = await this.verification.submit({
          license: value.licencia,
          specialtyName: value.especialidad,
          university: value.universidad,
          yearsExperience: Number(value.experiencia) || 0,
          consultationPrice: Number(value.precio) || 0,
          bio: value.bio,
        }, this.doctorDocuments());
      if (verification.error) {
        this.errorMessage.set(`Tu cuenta se creó, pero no se pudo enviar la solicitud: ${verification.error}`);
        this.loading.set(false);
        return;
      }
      this.successMessage.set(verification.notificationSent
        ? 'Solicitud enviada. Administración recibió los documentos y revisará tu acceso.'
        : 'Solicitud guardada. Administración podrá revisarla desde el panel.');
    } else {
      this.successMessage.set('¡Cuenta creada! Revisa tu correo para confirmarla.');
    }

    this.loading.set(false);
    setTimeout(() => this.router.navigateByUrl('/login'), 2500);
  }
}
