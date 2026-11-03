import { Routes } from '@angular/router';
import { LandingPage } from './pages/landing-page/landing-page';
import { LoginComponent } from './pages/login/login';
import { RegisterPage } from './pages/register/register';
import { authGuard } from './core/guards/auth.guard';
import { DashboardLayout } from './layout/dashboard-layout/dashboard-layout';
import { PerfilComponent } from './pages/perfil/perfil.component';
import { DashboardPlaceholder } from './pages/placeholder/dashboard-placeholder';

export const routes: Routes = [
  { path: '', pathMatch: 'full', component: LandingPage, title: 'SaludYA' },
  { path: 'login', component: LoginComponent, title: 'Iniciar sesión | SaludYA' },
  { path: 'registro', component: RegisterPage, title: 'Registro | SaludYA' },
  {
    path: '', component: DashboardLayout, canActivate: [authGuard], children: [
      { path: 'inicio', title: 'Menú principal | SaludYA', loadComponent: () => import('./pages/home/home.component').then((m) => m.HomeComponent) },
      { path: 'perfil', title: 'Mi perfil | SaludYA', component: PerfilComponent },
      { path: 'medicos', data: { title: 'Buscar médicos', description: 'La búsqueda de especialistas estará disponible al conectar el catálogo médico.' }, component: DashboardPlaceholder },
      { path: 'especialidades', data: { title: 'Especialidades', description: 'El catálogo de especialidades estará disponible al conectar el servicio médico.' }, component: DashboardPlaceholder },
      { path: 'reservar', data: { title: 'Reservar una cita', description: 'La reserva estará disponible al conectar los horarios de los especialistas.' }, component: DashboardPlaceholder },
      { path: 'mis-citas', data: { title: 'Mis citas', description: 'Tus citas aparecerán aquí cuando el servicio de agenda esté conectado.' }, component: DashboardPlaceholder },
      { path: 'mensajes', data: { title: 'Mensajes', description: 'La mensajería estará disponible cuando se conecte el servicio de comunicación.' }, component: DashboardPlaceholder },
      { path: 'historial', data: { title: 'Historial médico', description: 'Tu historial estará disponible cuando se conecte el servicio autorizado.' }, component: DashboardPlaceholder },
      { path: 'configuracion', data: { title: 'Configuración', description: 'La configuración de cuenta estará disponible próximamente.' }, component: DashboardPlaceholder },
      { path: 'ayuda', data: { title: 'Ayuda y soporte', description: 'El centro de ayuda estará disponible próximamente.' }, component: DashboardPlaceholder },
    ]
  },
];
