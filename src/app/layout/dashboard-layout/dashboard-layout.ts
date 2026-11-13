import { Component, computed, signal, ViewEncapsulation, inject } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
  encapsulation: ViewEncapsulation.None,
})
export class DashboardLayout {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly sidebarOpen = signal(false);
  readonly user = this.auth.currentUser;
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly accountName = computed(() => this.user()?.fullName || 'Usuario');
  readonly roleLabel = computed(() => ({
    admin: 'Administrador',
    doctor: 'Médico',
    patient: 'Paciente',
  }[this.user()?.role ?? 'patient']));
  readonly accountInitial = computed(() => this.accountName().trim().charAt(0).toUpperCase() || 'U');
  readonly notificationsOpen = signal(false);
  readonly accountOpen = signal(false);
  logout(): void { this.auth.logout(); void this.router.navigateByUrl('/login'); }
  closeMenus(): void { this.sidebarOpen.set(false); this.accountOpen.set(false); }
}
