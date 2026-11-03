import { Component, inject, signal } from '@angular/core';
import { NgIf } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [NgIf, ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    remember: [false],
  });

  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal<string | null>(null);

  get email() { return this.form.controls.email; }
  get password() { return this.form.controls.password; }

  togglePassword(): void {
    this.showPassword.update((v) => !v);
  }

  async submit(): Promise<void> {
    this.errorMessage.set(null);
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }

    this.loading.set(true);
    const { email, password } = this.form.getRawValue();
    const { error } = await this.auth.signIn(email.trim(), password);

    if (error) {
      this.errorMessage.set(error);
      this.loading.set(false);
      return;
    }

    // Redirigir según rol
    const role = this.auth.userRole();
    if (role === 'doctor') {
      this.router.navigateByUrl('/doctor');
    } else if (role === 'admin') {
      this.router.navigateByUrl('/admin');
    } else {
      this.router.navigateByUrl('/inicio');
    }
    this.loading.set(false);
  }
}
