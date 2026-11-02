import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-landing-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './landing-page.html',
  styleUrl: './landing-page.css',
})
export class LandingPage {
  menuOpen = false;

  doctors = [
    { name: 'Dra. Valeria Rojas', spec: 'Cardiología', avail: 'Disponible hoy' },
    { name: 'Dr. Miguel Torres', spec: 'Medicina general', avail: 'Disponible mañana' },
    { name: 'Dra. Camila Vega', spec: 'Dermatología', avail: 'Disponible hoy' },
  ];
}
