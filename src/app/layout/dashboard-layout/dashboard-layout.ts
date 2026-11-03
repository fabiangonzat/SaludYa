import { Component, signal, ViewEncapsulation, inject } from '@angular/core';
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
  readonly patientName = signal('');
  readonly notificationsOpen = signal(false);
  readonly accountOpen = signal(false);
  logout(): void { this.auth.logout(); void this.router.navigateByUrl('/login'); }
  closeMenus(): void { this.sidebarOpen.set(false); this.accountOpen.set(false); }
}
