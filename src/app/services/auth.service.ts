import { Injectable, signal, computed } from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseClient, Session, User } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { ProfileRow, UserRole } from '../core/supabase/supabase.types';

export type { UserRole };

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  avatarUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient = getSupabaseClient();

  // Estado reactivo
  readonly session = signal<Session | null>(null);
  readonly profile = signal<ProfileRow | null>(null);
  readonly loading = signal(true);

  readonly isLoggedIn = computed(() => !!this.session());
  readonly token = computed(() => this.session()?.access_token ?? '');
  readonly currentUser = computed<AuthUser | null>(() => {
    const s = this.session();
    const p = this.profile();
    if (!s || !p) return null;
    return {
      id: s.user.id,
      email: s.user.email ?? '',
      fullName: p.full_name,
      role: p.role,
      avatarUrl: p.avatar_url,
    };
  });
  readonly userRole = computed<UserRole | null>(() => this.profile()?.role ?? null);

  constructor() {
    // Inicializar sesión actual
    this.supabase.auth.getSession().then(({ data }) => {
      this.session.set(data.session);
      if (data.session) this.loadProfile(data.session.user.id);
      else this.loading.set(false);
    });

    // Escuchar cambios de sesión en tiempo real
    this.supabase.auth.onAuthStateChange((_event, session) => {
      this.session.set(session);
      if (session) {
        this.loadProfile(session.user.id);
      } else {
        this.profile.set(null);
        this.loading.set(false);
      }
    });
  }

  async signIn(email: string, password: string): Promise<{ error: string | null }> {
    this.loading.set(true);
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) {
      this.loading.set(false);
      return { error: this.mapAuthError(error.message) };
    }
    if (data.user) await this.loadProfile(data.user.id);
    return { error: null };
  }

  async signUp(data: {
    email: string;
    password: string;
    fullName: string;
    phone: string;
    birthDate: string;
    role: UserRole;
    gender?: string;
    city?: string;
  }): Promise<{ error: string | null }> {
    this.loading.set(true);

    const { error, data: authData } = await this.supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: data.fullName,
          phone: data.phone,
          birth_date: data.birthDate,
          role: data.role,
          gender: data.gender ?? null,
          city: data.city ?? null,
        },
      },
    });

    if (error) {
      this.loading.set(false);
      return { error: this.mapAuthError(error.message) };
    }

    // Si el usuario ya tiene sesión (Supabase no requiere confirmación), cargar perfil
    if (authData.user) {
      await this.ensureProfile(authData.user.id, {
        full_name: data.fullName,
        email: data.email,
        phone: data.phone,
        birth_date: data.birthDate,
        role: data.role,
        gender: (data.gender ?? null) as 'femenino' | 'masculino' | null,
        city: data.city ?? null,
        avatar_url: null,
      });
    }

    this.loading.set(false);
    return { error: null };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }

  /** Backwards-compatible alias used by the dashboard shell. */
  async logout(): Promise<void> {
    await this.signOut();
  }

  private async loadProfile(userId: string): Promise<void> {
    const { data } = await this.supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();

    this.profile.set(data ?? null);
    this.loading.set(false);
  }

  private async ensureProfile(
    userId: string,
    profileData: Omit<ProfileRow, 'id' | 'created_at' | 'updated_at'>
  ): Promise<void> {
    await this.supabase.from('profiles').upsert({
      id: userId,
      ...profileData,
    });
  }

  private mapAuthError(message: string): string {
    if (message.includes('Invalid login credentials')) return 'Correo o contraseña incorrectos.';
    if (message.includes('Email not confirmed')) return 'Por favor, confirma tu correo electrónico.';
    if (message.includes('User already registered')) return 'Este correo ya está registrado.';
    if (message.includes('Password should be')) return 'La contraseña debe tener al menos 6 caracteres.';
    if (message.includes('rate limit')) return 'Demasiados intentos. Espera unos minutos.';
    return 'Ocurrió un error. Inténtalo nuevamente.';
  }
}
