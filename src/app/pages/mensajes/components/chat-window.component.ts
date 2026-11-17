import { AfterViewChecked, Component, ElementRef, ViewChild, input, output, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ChatMessage, ConversationItem } from '../../../services/messages.service';
import { MessageBubbleComponent } from '../message-bubble.component';

@Component({
  selector: 'app-chat-window',
  standalone: true,
  imports: [DatePipe, MessageBubbleComponent],
  template: `
    @if(conversation();as c){<section class="chat-pane">
      <header class="chat-head"><button class="back-mobile" type="button" (click)="back.emit()" aria-label="Volver a conversaciones">←</button>
        <span class="avatar">@if(c.avatarUrl){<img [src]="c.avatarUrl" alt="">}@else{<span>{{c.initials}}</span>}<i [class.online]="c.online"></i></span>
        <div class="person-heading"><strong>{{c.name}}</strong><small><i [class.online-dot]="c.online"></i>{{c.online?'En línea':'Fuera de línea'}} · {{c.specialty}}</small></div>
        <span class="secure-label" title="Conversación privada entre paciente y médico">⌑ Privado</span>
      </header>
      <div class="chat-scroll" #scrollArea (scroll)="handleScroll($event)">
        @if(hasOlderMessages()&&messages().length){<button type="button" class="older-button" (click)="loadOlder.emit()">Cargar mensajes anteriores</button>}
        @if(messages().length){@for(m of messages();track m.id){@if(isNewDay(m, $index)){<div class="day-divider"><span>{{m.created_at|date:'fullDate':'':'es-PE'}}</span></div>}<app-message-bubble [message]="m" [currentUserId]="currentUserId()"/>}}
        @else if(loading()){<div class="empty-chat"><span class="spinner"></span><p>Cargando mensajes...</p></div>}
        @else{<div class="empty-chat"><span class="empty-icon">✉</span><strong>Inicia la conversación</strong><p>Escribe a {{c.name}}. Los mensajes quedan guardados para ambos.</p></div>}
      </div>
      @if(error()){<p class="chat-error" role="alert">{{error()}}</p>}
      @if(attachmentName()){<div class="attachment-chip">▤ {{attachmentName()}} <button type="button" (click)="clearAttachment()" aria-label="Quitar adjunto">×</button></div>}
      <form class="composer" (submit)="submit($event)"><input #file type="file" hidden accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx" (change)="chooseFile($event)">
        <button class="tool" type="button" (click)="file.click()" aria-label="Adjuntar imagen o documento" title="Adjuntar (máx. 10 MB)">＋</button>
        <textarea [value]="draft()" (input)="draftChange.emit($any($event.target).value)" (keydown)="keyDown($event)" placeholder="Escribe un mensaje..." maxlength="4000" rows="1" aria-label="Escribe un mensaje"></textarea>
        <button class="send" type="submit" [disabled]="sending()||(!draft().trim()&&!attachment())" aria-label="Enviar mensaje">@if(sending()){…}@else{<svg viewBox="0 0 24 24"><path d="m4 4 16 8-16 8 3-8zM7 12h13"/></svg>}</button>
      </form><p class="composer-hint">Enter para enviar · Shift + Enter para nueva línea</p>
    </section>}
    @else{<section class="chat-placeholder"><div class="placeholder-icon">✉</div><h2>Selecciona una conversación</h2><p>Los mensajes de tus pacientes o médicos aparecerán aquí.</p></section>}
  `,
  styles: [`
    .chat-pane{height:100%;min-width:0;min-height:0;display:flex;flex-direction:column;background:#f7f9fc;position:relative}.chat-head{height:65px;padding:0 17px;display:flex;align-items:center;gap:10px;background:white;border-bottom:1px solid #e8eef6;flex:none}.avatar{position:relative;width:39px;height:39px;flex:none;border-radius:50%;display:grid;place-items:center;background:#eaf2ff;color:#3472c5;font-size:11px;font-weight:750}.avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}.avatar i{position:absolute;width:10px;height:10px;right:-1px;bottom:0;border:2px solid white;border-radius:50%;background:#bac4d0}.avatar i.online{background:#21ad76}.person-heading{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}.person-heading strong{font-size:11px;color:#233954}.person-heading small{display:flex;align-items:center;gap:5px;font-size:8px;color:#8290a4}.online-dot{width:6px;height:6px;border-radius:50%;background:#23ae78}.secure-label{padding:6px 8px;border:1px solid #e5edf7;border-radius:8px;color:#7286a0;font-size:8px}.chat-scroll{padding:17px 20px;overflow:auto;flex:1;min-height:0;scroll-behavior:smooth}.older-button{display:block;margin:0 auto 12px;padding:7px 10px;border:1px solid #dce7f5;border-radius:8px;background:#fff;color:#3973b6;font-size:9px;cursor:pointer}.day-divider{text-align:center;margin:14px 0}.day-divider span{background:#eaf0f8;padding:5px 9px;border-radius:8px;color:#8290a4;font-size:8px;text-transform:capitalize}.empty-chat,.chat-placeholder{height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#8492a5;padding:22px}.empty-icon,.placeholder-icon{width:47px;height:47px;border-radius:16px;background:#eaf3ff;color:#3883dd;display:grid;place-items:center;font-size:23px;margin-bottom:10px}.empty-chat strong,.chat-placeholder h2{font-size:12px;color:#4e6079;margin:0}.empty-chat p,.chat-placeholder p{font-size:9px;line-height:1.5;max-width:240px}.chat-placeholder{background:#f7f9fc}.chat-placeholder h2{font-size:14px}.spinner{width:22px;height:22px;border:2px solid #d6e6f8;border-top-color:#2878d0;border-radius:50%;animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}.composer{display:flex;align-items:flex-end;gap:7px;padding:10px 14px 5px;background:white;border-top:1px solid #e7edf5}.composer textarea{resize:none;max-height:100px;min-height:38px;flex:1;border:1px solid #e6edf5;border-radius:11px;padding:9px 11px;font:inherit;font-size:10px;line-height:1.4;outline:none;color:#273c58;background:#f9fbfd}.composer textarea:focus{border-color:#9bc5f5;box-shadow:0 0 0 3px #087bfa16}.tool,.send{width:35px;height:35px;flex:none;border:0;border-radius:10px;background:transparent;color:#8594a8;font-size:21px;cursor:pointer}.tool:hover{background:#eff6ff;color:#087bfa}.send{background:#087bfa;color:white;display:grid;place-items:center;font-size:17px}.send:hover:not(:disabled){background:#0765d2}.send:disabled{opacity:.45;cursor:not-allowed}.send svg{width:16px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}.composer-hint{text-align:right;padding:0 15px 7px;margin:0;background:white;color:#a0adbd;font-size:7px}.attachment-chip{padding:6px 16px 0;background:#fff;color:#59708b;font-size:9px}.attachment-chip button{border:0;background:none;color:#8898aa;font-size:15px;cursor:pointer}.chat-error{margin:0;padding:6px 15px;background:#fff5f4;color:#ab4b45;font-size:9px}.back-mobile{display:none;border:0;background:none;color:#2975c8;font-size:22px;cursor:pointer}@media(max-width:700px){.chat-pane{height:100%;min-height:440px}.back-mobile{display:block}.chat-head{padding:0 11px}.chat-scroll{padding:13px}.chat-placeholder{display:none}.secure-label{font-size:0}.secure-label:first-letter{font-size:10px}}
  `],
})
export class ChatWindowComponent implements AfterViewChecked {
  readonly conversation = input<ConversationItem | null>(null);
  readonly messages = input<ChatMessage[]>([]);
  readonly currentUserId = input.required<string>();
  readonly loading = input(false);
  readonly sending = input(false);
  readonly error = input<string | null>(null);
  readonly hasOlderMessages = input(false);
  readonly draft = input('');
  readonly draftChange = output<string>();
  readonly send = output<void>();
  readonly back = output<void>();
  readonly loadOlder = output<void>();
  readonly fileSelected = output<File>();
  readonly attachment = signal<File | null>(null);
  readonly attachmentName = signal('');
  @ViewChild('scrollArea') private scrollArea?: ElementRef<HTMLElement>;
  private previousFirstId: string | null = null;
  private previousLength = -1;
  private savedScrollHeight = 0;
  private loadingOlder = false;

  ngAfterViewChecked(): void {
    const first = this.messages()[0]?.id ?? null;
    const length = this.messages().length;
    const area = this.scrollArea?.nativeElement;
    if (area && length !== this.previousLength) {
      if (this.loadingOlder && first !== this.previousFirstId) {
        area.scrollTop = area.scrollHeight - this.savedScrollHeight;
        this.loadingOlder = false;
      } else if (first === this.previousFirstId) {
        area.scrollTop = area.scrollHeight;
      }
      this.previousFirstId = first;
      this.previousLength = length;
    }
  }

  isNewDay(message: ChatMessage, index: number): boolean {
    if (index === 0) return true;
    return new Date(message.created_at).toDateString() !== new Date(this.messages()[index - 1].created_at).toDateString();
  }

  handleScroll(event: Event): void {
    const area = event.target as HTMLElement;
    if (area.scrollTop < 35 && this.hasOlderMessages() && !this.loading()) {
      this.savedScrollHeight = area.scrollHeight;
      this.loadingOlder = true;
      this.loadOlder.emit();
    }
  }

  chooseFile(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return;
    this.attachment.set(file);
    this.attachmentName.set(file.name);
  }

  clearAttachment(): void { this.attachment.set(null); this.attachmentName.set(''); }

  submit(event: Event): void {
    event.preventDefault();
    if (this.attachment()) {
      this.fileSelected.emit(this.attachment()!);
      this.clearAttachment();
    }
    else this.send.emit();
  }

  keyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.submit(new Event('submit'));
    }
  }
}
