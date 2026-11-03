import { Routes } from '@angular/router';
import { LandingPage } from './pages/landing-page/landing-page';
import { LoginComponent } from './pages/login/login';
import { RegisterPage } from './pages/register/register';
import { authGuard } from './core/guards/auth.guard';
import { DashboardLayout } from './layout/dashboard-layout/dashboard-layout';
import { DashboardPlaceholder } from './pages/placeholder/dashboard-placeholder';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPage, title: 'SaludYA' },
  { path: 'login', component: LoginComponent, title: 'Iniciar sesión | SaludYA' },
  { path: 'registro', component: RegisterPage, title: 'Registro | SaludYA' },
  {
    path: '', component: DashboardLayout, canActivate: [authGuard], children: [
      { path: 'inicio', title: 'Menú principal | SaludYA', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
      { path: 'perfil', title: 'Mi perfil | SaludYA', loadComponent: () => import('./pages/perfil/perfil.component').then((m) => m.PerfilComponent) },
      { path: 'medicos', title: 'Buscar médicos | SaludYA', loadComponent: () => import('./pages/medicos/doctors-page').then((m) => m.DoctorsPage) },
      { path: 'especialidades', title: 'Especialidades | SaludYA', loadComponent: () => import('./pages/especialidades/specialties-page').then((m) => m.SpecialtiesPage) },
      { path: 'reservar', title: 'Reservar una cita | SaludYA', loadComponent: () => import('./pages/reservar/reservation-page').then((m) => m.ReservationPage) },
      { path: 'mis-citas', title: 'Mis citas | SaludYA', loadComponent: () => import('./pages/mis-citas/appointments-page').then((m) => m.AppointmentsPage) },
      { path: 'mensajes', title: 'Mensajes | SaludYA', loadComponent: () => import('./pages/mensajes/messages-page').then((m) => m.MessagesPage) },
      { path: 'historial', title: 'Historial médico | SaludYA', loadComponent: () => import('./pages/historial/medical-history-page').then((m) => m.MedicalHistoryPage) },
      { path: 'bienestar', title: 'Mi bienestar | SaludYA', loadComponent: () => import('./pages/bienestar/wellness-page').then((m) => m.WellnessPage) },
      { path: 'doctor', title: 'Panel del médico | SaludYA', canActivate: [roleGuard('doctor')], loadComponent: () => import('./pages/doctor/dashboard/doctor-dashboard').then((m) => m.DoctorDashboardComponent) },
      { path: 'doctor/disponibilidad', title: 'Disponibilidad | SaludYA', canActivate: [roleGuard('doctor')], loadComponent: () => import('./pages/doctor/disponibilidad/doctor-availability').then((m) => m.DoctorAvailabilityComponent) },
      { path: 'doctor/citas', title: 'Citas del médico | SaludYA', canActivate: [roleGuard('doctor')], loadComponent: () => import('./pages/mis-citas/appointments-page').then((m) => m.AppointmentsPage) },
      { path: 'admin', title: 'Administración | SaludYA', canActivate: [roleGuard('admin')], loadComponent: () => import('./pages/admin/dashboard/admin-dashboard').then((m) => m.AdminDashboardComponent) },
      { path: 'configuracion', data: { title: 'Configuración', description: 'La configuración de cuenta estará disponible próximamente.' }, component: DashboardPlaceholder },
      { path: 'ayuda', data: { title: 'Ayuda y soporte', description: 'El centro de ayuda estará disponible próximamente.' }, component: DashboardPlaceholder },
    ]
  },
];
