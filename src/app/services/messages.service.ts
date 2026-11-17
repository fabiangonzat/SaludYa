import { Injectable, inject, signal } from '@angular/core';
import { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { AuthService } from './auth.service';
import { ConversationSummaryRow, MessageRow } from '../core/supabase/supabase.types';

export interface ConversationItem {
  id: string;
  counterpartId: string;
  name: string;
  specialty: string;
  avatarUrl: string | null;
  initials: string;
  unread: number;
  updatedAt: Date;
  lastMessage: string;
  online: boolean;
}

export interface ChatMessage extends MessageRow {
  attachmentUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly supabase: SupabaseClient = getSupabaseClient();
  private readonly auth = inject(AuthService);
  private inboxChannel: RealtimeChannel | null = null;
  private conversationChannel: RealtimeChannel | null = null;
  private presenceChannel: RealtimeChannel | null = null;
  private currentConversationId: string | null = null;
  private readonly attachmentUrlCache = new Map<string, { url: string; expiresAt: number }>();

  readonly conversations = signal<ConversationItem[]>([]);
  readonly messages = signal<ChatMessage[]>([]);
  readonly loadingConversations = signal(false);
  readonly loadingMessages = signal(false);
  readonly sending = signal(false);
  readonly error = signal<string | null>(null);
  readonly onlineUserIds = signal<Set<string>>(new Set());
  readonly hasOlderMessages = signal(false);

  async loadConversations(): Promise<void> {
    this.loadingConversations.set(true);
    const { data, error } = await this.supabase.rpc('get_my_conversations');
    if (error) {
      this.error.set('No se pudieron cargar los mensajes. Verifica que esté aplicada la migración de mensajería.');
      this.conversations.set([]);
    } else {
      this.error.set(null);
      this.conversations.set(((data ?? []) as ConversationSummaryRow[]).map((row) => ({
        id: row.conversation_id,
        counterpartId: row.counterpart_id,
        name: row.counterpart_name,
        specialty: row.specialty ?? 'Atención médica',
        avatarUrl: row.counterpart_avatar,
        initials: row.counterpart_name.split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase(),
        unread: Number(row.unread_count ?? 0),
        updatedAt: new Date(row.last_message_at),
        lastMessage: row.last_message ?? 'Inicia la conversación',
        online: this.onlineUserIds().has(row.counterpart_id),
      })));
    }
    this.loadingConversations.set(false);
  }

  subscribeInbox(): void {
    this.unsubscribeInbox();
    this.inboxChannel = this.supabase.channel(`messages-inbox-${this.auth.currentUser()?.id ?? 'user'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<MessageRow>;
        void this.loadConversations();
        if (row.conversation_id && row.conversation_id === this.currentConversationId) {
          void this.loadMessages(row.conversation_id);
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => void this.loadConversations())
      .subscribe();
  }

  unsubscribeInbox(): void {
    if (this.inboxChannel) void this.supabase.removeChannel(this.inboxChannel);
    this.inboxChannel = null;
  }

  async openConversation(conversationId: string): Promise<void> {
    if (this.currentConversationId !== conversationId) {
      if (this.conversationChannel) void this.supabase.removeChannel(this.conversationChannel);
      this.conversationChannel = null;
      this.currentConversationId = conversationId;
      this.messages.set([]);
      this.hasOlderMessages.set(false);
      this.conversationChannel = this.supabase.channel(`conversation-${conversationId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}`,
        }, () => {
          void this.loadMessages(conversationId);
          void this.markRead(conversationId);
        })
        .subscribe();
    }
    await this.loadMessages(conversationId);
    await this.markRead(conversationId);
    await this.loadConversations();
  }

  closeConversation(): void {
    this.currentConversationId = null;
    if (this.conversationChannel) void this.supabase.removeChannel(this.conversationChannel);
    this.conversationChannel = null;
    this.messages.set([]);
  }

  private async loadMessages(conversationId: string, before?: string): Promise<void> {
    this.loadingMessages.set(true);
    let query = this.supabase.from('messages').select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: false }).limit(50);
    if (before) query = query.lt('created_at', before);
    const { data, error } = await query;
    if (error) {
      this.error.set('No se pudo cargar el historial de esta conversación.');
    } else {
      const rows = [...((data ?? []) as MessageRow[])].reverse();
      const hydrated = await Promise.all(rows.map((row) => this.withAttachmentUrl(row)));
      if (before) this.messages.update((current) => [...hydrated, ...current]);
      else {
        this.messages.set(hydrated);
        this.hasOlderMessages.set(rows.length === 50);
      }
    }
    this.loadingMessages.set(false);
  }

  async loadOlderMessages(): Promise<void> {
    const conversationId = this.currentConversationId;
    const oldest = this.messages()[0]?.created_at;
    if (!conversationId || !oldest || !this.hasOlderMessages() || this.loadingMessages()) return;
    await this.loadMessages(conversationId, oldest);
  }

  private async withAttachmentUrl(row: MessageRow): Promise<ChatMessage> {
    if (!row.attachment_path) return { ...row, attachmentUrl: null };
    const cached = this.attachmentUrlCache.get(row.attachment_path);
    if (cached && cached.expiresAt > Date.now()) return { ...row, attachmentUrl: cached.url };
    const { data } = await this.supabase.storage.from('clinical-messages').createSignedUrl(row.attachment_path, 3600);
    if (data?.signedUrl) this.attachmentUrlCache.set(row.attachment_path, { url: data.signedUrl, expiresAt: Date.now() + 50 * 60_000 });
    return { ...row, attachmentUrl: data?.signedUrl ?? null };
  }

  async openCareConversation(doctorId: string, patientId?: string): Promise<string | null> {
    const { data, error } = await this.supabase.rpc('open_care_conversation', {
      p_doctor_id: doctorId,
      p_patient_id: patientId ?? null,
    });
    if (error || !data) {
      this.error.set(error?.message ?? 'No se pudo abrir la conversación.');
      return null;
    }
    this.error.set(null);
    await this.loadConversations();
    return (data as unknown as { id: string }).id;
  }

  async sendText(conversationId: string, content: string): Promise<boolean> {
    const text = content.trim();
    if (!text || text.length > 4000) return false;
    this.sending.set(true);
    const { error } = await this.supabase.rpc('send_conversation_message', {
      p_conversation_id: conversationId, p_content: text, p_message_type: 'text', p_attachment_path: null,
    });
    this.sending.set(false);
    if (error) this.error.set(error.message || 'No se pudo enviar el mensaje.');
    else {
      this.error.set(null);
      await Promise.all([this.loadMessages(conversationId), this.loadConversations()]);
    }
    return !error;
  }

  async sendAttachment(conversationId: string, file: File, caption = ''): Promise<boolean> {
    const userId = this.auth.currentUser()?.id;
    if (!userId || file.size > 10 * 1024 * 1024) {
      this.error.set('El archivo debe pesar menos de 10 MB.');
      return false;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      this.error.set('Formato no permitido. Usa JPG, PNG, WEBP, PDF o DOC.');
      return false;
    }
    this.sending.set(true);
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-100);
    const path = `${conversationId}/${userId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await this.supabase.storage.from('clinical-messages').upload(path, file, {
      contentType: file.type, upsert: false,
    });
    if (uploadError) {
      this.error.set(uploadError.message);
      this.sending.set(false);
      return false;
    }
    const messageType = file.type.startsWith('image/') ? 'image' : 'document';
    const { error } = await this.supabase.rpc('send_conversation_message', {
      p_conversation_id: conversationId,
      p_content: caption.trim() || file.name,
      p_message_type: messageType,
      p_attachment_path: path,
    });
    this.sending.set(false);
    if (error) {
      await this.supabase.storage.from('clinical-messages').remove([path]);
      this.error.set(error.message);
      return false;
    }
    this.error.set(null);
    await Promise.all([this.loadMessages(conversationId), this.loadConversations()]);
    return true;
  }

  private async markRead(conversationId: string): Promise<void> {
    await this.supabase.rpc('mark_conversation_read', { p_conversation_id: conversationId });
  }

  startPresence(): void {
    const currentUser = this.auth.currentUser();
    const userId = currentUser?.id;
    if (!currentUser || !['patient', 'doctor'].includes(currentUser.role)) return;
    if (!userId || this.presenceChannel) return;
    this.presenceChannel = this.supabase.channel('saludya-chat-presence', { config: { presence: { key: userId } } });
    this.presenceChannel.on('presence', { event: 'sync' }, () => {
      const ids = new Set(Object.keys(this.presenceChannel?.presenceState() ?? {}));
      this.onlineUserIds.set(ids);
      this.conversations.update((items) => items.map((item) => ({ ...item, online: ids.has(item.counterpartId) })));
    }).subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await this.presenceChannel?.track({ profile_id: userId, online_at: new Date().toISOString() });
    });
  }

  stopPresence(): void {
    if (this.presenceChannel) void this.supabase.removeChannel(this.presenceChannel);
    this.presenceChannel = null;
    this.onlineUserIds.set(new Set());
    this.conversations.update((items) => items.map((item) => ({ ...item, online: false })));
  }
}
