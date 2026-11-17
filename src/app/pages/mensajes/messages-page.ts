import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../services/auth.service';
import { AppointmentsService } from '../../services/appointments.service';
import { MessagesService, ConversationItem } from '../../services/messages.service';
import { DoctorsService } from '../medicos/doctors.service';
import { ConversationListComponent } from './components/conversation-list.component';
import { ChatWindowComponent } from './components/chat-window.component';

interface ContactChoice { id: string; doctorId: string; patientId?: string; name: string; specialty: string; avatarUrl: string | null; initials: string; }
type Filter = 'all' | 'unread';

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [ConversationListComponent, ChatWindowComponent],
  templateUrl: './messages-page.html',
  styleUrl: './messages-page.css',
})
export class MessagesPage implements OnInit, OnDestroy {
  private readonly auth = inject(AuthService);
  private readonly appointments = inject(AppointmentsService);
  private readonly doctors = inject(DoctorsService);
  readonly service = inject(MessagesService);
  readonly user = this.auth.currentUser;
  readonly isDoctor = computed(() => this.user()?.role === 'doctor');
  readonly selectedId = signal<string | null>(null);
  readonly filter = signal<Filter>('all');
  readonly query = signal('');
  readonly mobileChatOpen = signal(false);
  readonly draft = signal('');
  readonly contacts = signal<ContactChoice[]>([]);
  readonly contactQuery = signal('');
  readonly contactsLoading = signal(false);
  readonly contactPickerOpen = signal(false);
  readonly selected = computed(() => this.service.conversations().find((c) => c.id === this.selectedId()) ?? null);
  readonly visibleConversations = computed(() => this.service.conversations()
    .filter((conversation) => this.filter() === 'all' || conversation.unread > 0)
    .filter((conversation) => `${conversation.name} ${conversation.specialty} ${conversation.lastMessage}`.toLocaleLowerCase('es').includes(this.query().toLocaleLowerCase('es'))));
  readonly filteredContacts = computed(() => this.contacts().filter((contact) =>
    `${contact.name} ${contact.specialty}`.toLocaleLowerCase('es').includes(this.contactQuery().trim().toLocaleLowerCase('es'))));
  readonly unreadCount = computed(() => this.service.conversations().reduce((count, conversation) => count + conversation.unread, 0));
  readonly counts = computed(() => ({
    all: this.service.conversations().length,
    unread: this.unreadCount(),
  }));

  async ngOnInit(): Promise<void> {
    await Promise.all([this.service.loadConversations(), this.loadContacts()]);
  }

  ngOnDestroy(): void {
    this.service.closeConversation();
  }

  async loadContacts(): Promise<void> {
    this.contactsLoading.set(true);
    const user = this.user();
    if (!user) { this.contactsLoading.set(false); return; }
    await this.appointments.load();
    if (this.isDoctor()) {
      const doctor = await this.doctors.getByProfileId(user.id);
      const uniquePatients = new Map<string, ContactChoice>();
      for (const appointment of this.appointments.appointments()) {
        const patient = appointment.patient;
        if (patient && !uniquePatients.has(appointment.patient_id) && doctor) {
          uniquePatients.set(appointment.patient_id, {
            id: appointment.patient_id,
            doctorId: doctor.id,
            patientId: appointment.patient_id,
            name: patient.full_name,
            specialty: appointment.specialty,
            avatarUrl: patient.avatar_url,
            initials: patient.full_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
          });
        }
      }
      this.contacts.set([...uniquePatients.values()]);
    } else {
      await this.doctors.load();
      const relatedDoctorIds = new Set(this.appointments.appointments().map((appointment) => appointment.doctor_id));
      this.contacts.set(this.doctors.doctors().filter((doctor) => relatedDoctorIds.has(doctor.id)).map((doctor) => ({
        id: doctor.id,
        doctorId: doctor.id,
        name: doctor.profile?.full_name ?? `${doctor.firstName} ${doctor.lastName}`.trim(),
        specialty: doctor.specialty,
        avatarUrl: doctor.profile?.avatar_url ?? null,
        initials: doctor.initials,
      })));
    }
    this.contactsLoading.set(false);
  }

  async selectConversation(id: string): Promise<void> {
    this.selectedId.set(id);
    this.mobileChatOpen.set(true);
    this.draft.set('');
    await this.service.openConversation(id);
  }

  async startConversation(contact: ContactChoice): Promise<void> {
    const conversationId = await this.service.openCareConversation(contact.doctorId, contact.patientId);
    if (!conversationId) return;
    this.contactPickerOpen.set(false);
    this.contactQuery.set('');
    await this.selectConversation(conversationId);
  }

  async sendMessage(): Promise<void> {
    const conversation = this.selected();
    const text = this.draft();
    if (!conversation || !text.trim()) return;
    if (await this.service.sendText(conversation.id, text)) this.draft.set('');
  }

  async sendAttachment(file: File): Promise<void> {
    const conversation = this.selected();
    if (conversation && await this.service.sendAttachment(conversation.id, file, this.draft())) this.draft.set('');
  }

  async openContactPicker(): Promise<void> {
    this.contactPickerOpen.set(true);
    if (!this.contacts().length && !this.contactsLoading()) await this.loadContacts();
  }

  closeMobileChat(): void {
    this.mobileChatOpen.set(false);
    this.selectedId.set(null);
    this.service.closeConversation();
  }

  @HostListener('document:keydown.escape') closePicker(): void { this.contactPickerOpen.set(false); }
}
