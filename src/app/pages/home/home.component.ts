import { Component, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly sidebarOpen = signal(false);
  readonly notificationsOpen = signal(false);
  readonly accountOpen = signal(false);
  readonly patientName = signal('');
  readonly today = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  readonly metrics = [
    { title: 'Próximas citas', value: '—', hint: 'Conecta tus citas para verlas aquí', icon: 'calendar' },
    { title: 'Consultas realizadas', value: '—', hint: 'Tu historial de atención', icon: 'check' },
    { title: 'Mensajes pendientes', value: '—', hint: 'Mensajes de tus especialistas', icon: 'message' },
    { title: 'Médicos disponibles', value: '—', hint: 'Especialistas de SaludYA', icon: 'users' },
  ];
  logout(): void {
    this.auth.logout();
    void this.router.navigateByUrl('/login');
  }
  closeMenus(): void {
    this.sidebarOpen.set(false);
    this.accountOpen.set(false);
  }
}
