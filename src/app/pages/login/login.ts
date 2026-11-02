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
  private fb = inject(FormBuilder);
  private auth = inject(AuthService);
  private router = inject(Router);

  form = this.fb.nonNullable.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
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

  submit(): void {
    this.errorMessage.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { email, remember } = this.form.getRawValue();
    this.loading.set(true);
    this.auth.loginDemo(email.trim(), remember);
    this.router.navigateByUrl('/inicio').finally(() => this.loading.set(false));
  }
}
