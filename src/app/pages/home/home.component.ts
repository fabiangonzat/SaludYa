import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent {
  readonly patientName = signal('');
  readonly today = new Intl.DateTimeFormat('es-PE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
  readonly metrics = [
    { title: 'Próximas citas', value: '—', hint: 'Conecta tus citas para verlas aquí', icon: 'calendar' },
    { title: 'Consultas realizadas', value: '—', hint: 'Tu historial de atención', icon: 'check' },
    { title: 'Mensajes pendientes', value: '—', hint: 'Mensajes de tus especialistas', icon: 'message' },
    { title: 'Médicos disponibles', value: '—', hint: 'Especialistas de SaludYA', icon: 'users' },
  ];
}
