import { Component, inject } from '@angular/core';
import { NgIf } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { RegistrationService, RegistrationData } from '../../services/registration.service';

type RegisterField = 'nombre' | 'email' | 'telefono' | 'fechaNacimiento' | 'password' | 'confirmPassword';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class RegisterPage {
  private fb = inject(FormBuilder);
  private registration = inject(RegistrationService);
  private router = inject(Router);
  readonly maxBirthDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date());
  form = this.fb.nonNullable.group({
    nombre: ['', [Validators.required, Validators.pattern(/^\S+(\s+\S+)+$/)]],
    email: ['', [Validators.required, Validators.email]],
    telefono: ['', [Validators.required, Validators.pattern(/^9\d{8}$/)]],
    fechaNacimiento: ['', [Validators.required, this.notFutureDate]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', Validators.required],
  }, { validators: this.passwordsMatch });
  submitted = false;
  loading = false;
  showPassword = false;
  errorMessage = '';

  private notFutureDate(control: AbstractControl): ValidationErrors | null {
    return control.value && control.value > new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' }).format(new Date()) ? { futureDate: true } : null;
  }
  private passwordsMatch(control: AbstractControl): ValidationErrors | null {
    return control.get('password')?.value === control.get('confirmPassword')?.value ? null : { passwordMismatch: true };
  }
  hasError(name: RegisterField): boolean {
    const control=this.form.controls[name];
    return (control.invalid && (control.touched || this.submitted)) || (name==='confirmPassword' && this.form.hasError('passwordMismatch') && (control.touched || this.submitted));
  }
  fieldMessage(name: keyof typeof this.form.controls): string {
    const control=this.form.controls[name];
    if (control.hasError('required')) return 'Este campo es obligatorio.';
    if (control.hasError('email')) return 'Ingresa un correo electrónico válido.';
    if (name==='nombre' && control.hasError('pattern')) return 'Escribe tu nombre y apellido.';
    if (name==='telefono' && control.hasError('pattern')) return 'Ingresa un número de 9 dígitos que empiece con 9.';
    if (name==='fechaNacimiento' && control.hasError('futureDate')) return 'La fecha de nacimiento no puede ser futura.';
    if (name==='password' && control.hasError('minlength')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (name==='confirmPassword' && this.form.hasError('passwordMismatch')) return 'Las contraseñas no coinciden.';
    return 'Revisa este campo.';
  }
  onlyDigits(event: Event): void {
    const input=event.target as HTMLInputElement;
    input.value=input.value.replace(/\D/g,'').slice(0,9);
    this.form.controls.telefono.setValue(input.value);
  }
  submit(): void {
    this.submitted=true; this.errorMessage='';
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    const value=this.form.getRawValue();
    const data: RegistrationData={ nombre:value.nombre.trim(), email:value.email.trim(), telefono:'+51'+value.telefono, fechaNacimiento:value.fechaNacimiento, password:value.password };
    this.loading=true;
    this.registration.register(data).subscribe({
      next:()=>this.router.navigateByUrl('/login'),
      error:(error:HttpErrorResponse)=>{ this.loading=false; this.errorMessage=error.status===409 ? 'Este correo ya está registrado.' : 'No pudimos crear tu cuenta. Inténtalo nuevamente.'; },
    });
  }
}
