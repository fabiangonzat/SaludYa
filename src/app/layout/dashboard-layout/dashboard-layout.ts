import { Component, computed, signal, ViewEncapsulation, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { MessagesService } from '../../services/messages.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './dashboard-layout.html',
  styleUrl: './dashboard-layout.css',
  encapsulation: ViewEncapsulation.None,
})
export class DashboardLayout implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly messages = inject(MessagesService);
  readonly sidebarOpen = signal(false);
  readonly user = this.auth.currentUser;
  readonly isAdmin = computed(() => this.user()?.role === 'admin');
  readonly isDoctor = computed(() => this.user()?.role === 'doctor');
  readonly unreadMessages = computed(() => this.messages.conversations().reduce((total, conversation) => total + conversation.unread, 0));
  readonly homeRoute = computed(() => this.isAdmin() ? '/admin' : this.isDoctor() ? '/doctor' : '/inicio');
  readonly accountName = computed(() => this.user()?.fullName || 'Usuario');
  readonly roleLabel = computed(() => ({
    admin: 'Administrador',
    doctor: 'Médico',
    patient: 'Paciente',
  }[this.user()?.role ?? 'patient']));
  readonly accountInitial = computed(() => this.accountName().trim().charAt(0).toUpperCase() || 'U');
  readonly notificationsOpen = signal(false);
  readonly accountOpen = signal(false);
  ngOnInit(): void { void this.messages.loadConversations(); this.messages.subscribeInbox(); this.messages.startPresence(); }
  ngOnDestroy(): void { this.messages.unsubscribeInbox(); this.messages.stopPresence(); }
  logout(): void { this.auth.logout(); void this.router.navigateByUrl('/login'); }
  closeMenus(): void { this.sidebarOpen.set(false); this.accountOpen.set(false); }
}
