import { Injectable, signal } from '@angular/core';
import { SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { getSupabaseClient } from '../core/supabase/supabase.client';
import { MessageRow } from '../core/supabase/supabase.types';

export interface MessageWithSender extends MessageRow {
  sender: { full_name: string; avatar_url: string | null } | null;
}

@Injectable({ providedIn: 'root' })
export class MessagesService {
  private readonly supabase: SupabaseClient = getSupabaseClient();
  private channel: RealtimeChannel | null = null;

  readonly messages = signal<MessageWithSender[]>([]);
  readonly loading = signal(false);

  async loadConversation(userId1: string, userId2: string): Promise<void> {
    this.loading.set(true);
    const { data } = await this.supabase
      .from('messages')
      .select('*, sender:profiles!messages_sender_id_fkey(full_name, avatar_url)')
      .or(
        `and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`
      )
      .order('created_at', { ascending: true });
    this.messages.set((data ?? []) as MessageWithSender[]);
    this.loading.set(false);
  }

  subscribeToConversation(userId1: string, userId2: string): void {
    this.channel = this.supabase
      .channel(`conv-${userId1}-${userId2}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        this.loadConversation(userId1, userId2);
      })
      .subscribe();
  }

  unsubscribe(): void {
    if (this.channel) {
      this.supabase.removeChannel(this.channel);
      this.channel = null;
    }
  }

  async send(senderId: string, receiverId: string, content: string, appointmentId?: string): Promise<{ error: string | null }> {
    const { error } = await this.supabase.from('messages').insert({
      sender_id: senderId,
      receiver_id: receiverId,
      content: content.trim(),
      appointment_id: appointmentId ?? null,
    });
    return { error: error?.message ?? null };
  }

  async markAsRead(senderId: string, receiverId: string): Promise<void> {
    await this.supabase
      .from('messages')
      .update({ is_read: true })
      .eq('sender_id', senderId)
      .eq('receiver_id', receiverId)
      .eq('is_read', false);
  }

  async getUnreadCount(userId: string): Promise<number> {
    const { count } = await this.supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('receiver_id', userId)
      .eq('is_read', false);
    return count ?? 0;
  }
}
