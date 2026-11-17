import { DatePipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { ConversationItem } from '../../../services/messages.service';

@Component({
  selector: 'app-conversation-list',
  standalone: true,
  imports: [DatePipe],
  template: `
    <section class="conversation-pane" [class.conversation-pane--hidden-mobile]="mobileChatOpen()">
      <header class="list-heading"><div><p class="eyebrow">COMUNICACIÓN MÉDICA</p><h1>Mensajes</h1><p>{{isDoctor() ? 'Conversaciones con tus pacientes' : 'Conversaciones con tus médicos'}}</p></div>
        <button class="new-button" type="button" (click)="newConversation.emit()" [attr.aria-label]="isDoctor() ? 'Contactar a un paciente' : 'Contactar a un médico'">＋</button>
      </header>
      <label class="search"><span aria-hidden="true">⌕</span><input type="search" placeholder="Buscar conversación..." [value]="query()" (input)="queryChange.emit($any($event.target).value)" aria-label="Buscar conversaciones"></label>
      <div class="filters" role="tablist" aria-label="Filtrar conversaciones"><button type="button" [class.selected]="filter()==='all'" (click)="filterChange.emit('all')">Todas <span>{{counts().all}}</span></button><button type="button" [class.selected]="filter()==='unread'" (click)="filterChange.emit('unread')">No leídos <span>{{counts().unread}}</span></button></div>
      @if(loading()){<div class="loading-list"><i></i><i></i><i></i><i></i></div>}
      @else if(items().length){<div class="conversation-list">@for(c of items();track c.id){<button class="conversation" type="button" [class.active]="selectedId()===c.id" (click)="select.emit(c.id)">
        <span class="avatar">@if(c.avatarUrl){<img [src]="c.avatarUrl" alt="" loading="lazy">}@else{<span>{{c.initials}}</span>}<i [class.online]="c.online"></i></span>
        <span class="conversation-copy"><span class="conversation-top"><strong>{{c.name}}</strong><time>{{c.updatedAt|date:'shortTime'}}</time></span><small>{{c.specialty}}</small><span class="conversation-last">{{c.lastMessage}}</span></span>
        @if(c.unread){<span class="unread">{{c.unread}}</span>}
      </button>}</div>}
      @else{<div class="list-empty"><span aria-hidden="true">✉</span><strong>{{query()?'Sin resultados':'Aún no tienes conversaciones'}}</strong><p>{{query()?'Prueba con otro nombre.':isDoctor()?'Podrás escribir a pacientes que tengan una cita vinculada contigo.':'Podrás escribir a médicos con quienes tengas una cita.'}}</p>@if(!query()){<button type="button" (click)="newConversation.emit()">{{isDoctor()?'Buscar pacientes':'Buscar médicos vinculados'}}</button>}</div>}
    </section>
  `,
  styles: [`
    :host{display:flex;min-width:0;min-height:0}.conversation-pane{display:flex;flex:1;flex-direction:column;min-width:0;min-height:0;border-right:1px solid #e8eef6;background:#fff}.list-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:21px 19px 14px}.eyebrow{font-size:9px;letter-spacing:.13em;font-weight:800;color:#8494aa;margin:0 0 5px}.list-heading h1{font-size:20px;letter-spacing:-.03em;margin:0;color:#0b2a5b}.list-heading p:last-child{font-size:10px;color:#8190a4;margin:5px 0 0}.new-button{width:36px;height:36px;flex:none;border:0;border-radius:12px;background:#087bfa;color:white;font-size:23px;line-height:1;cursor:pointer;box-shadow:0 5px 12px #087bfa33}.search{height:38px;margin:0 16px 12px;padding:0 10px;border:1px solid #e5ebf4;background:#f8fafd;border-radius:10px;display:flex;align-items:center;gap:8px;color:#8c9aae}.search span{font-size:20px}.search input{border:0;outline:0;background:transparent;min-width:0;width:100%;font:inherit;font-size:10px;color:#0b2a5b}.filters{display:flex;gap:5px;padding:0 15px 10px;border-bottom:1px solid #eef2f7}.filters button{background:transparent;border:0;border-radius:8px;padding:7px 9px;color:#7d8ba0;font:inherit;font-size:10px;cursor:pointer}.filters button.selected{background:#eaf3ff;color:#096ce0;font-weight:700}.filters span{margin-left:3px}.conversation-list{overflow:auto;flex:1;min-height:0}.conversation{width:100%;display:flex;align-items:center;gap:10px;text-align:left;padding:12px 15px;border:0;border-bottom:1px solid #f0f3f8;background:#fff;cursor:pointer;color:inherit}.conversation:hover{background:#f9fbfe}.conversation.active{background:#eef6ff;box-shadow:inset 3px 0 #087bfa}.avatar{position:relative;width:41px;height:41px;flex:none;border-radius:50%;display:grid;place-items:center;background:#eaf2ff;color:#3472c5;font-weight:750;font-size:11px}.avatar img{width:100%;height:100%;border-radius:50%;object-fit:cover}.avatar i{position:absolute;width:10px;height:10px;right:-1px;bottom:0;border-radius:50%;background:#b8c2cf;border:2px solid white}.avatar i.online{background:#21ad76}.conversation-copy{flex:1;min-width:0}.conversation-top{display:flex;justify-content:space-between;gap:5px;align-items:center}.conversation-top strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px;color:#243954}.conversation-top time,.conversation-copy small{font-size:8px;color:#9aa6b6}.conversation-copy small{display:block;margin:3px 0}.conversation-last{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:9px;color:#8491a3}.unread{min-width:18px;height:18px;border-radius:9px;background:#087bfa;color:white;font-size:9px;display:grid;place-items:center;padding:0 4px}.list-empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:20px;color:#8997aa}.list-empty>span{font-size:28px;color:#a7c9f4}.list-empty strong{font-size:11px;color:#50627b;margin-top:8px}.list-empty p{font-size:9px;line-height:1.5;max-width:205px}.list-empty button{margin-top:8px;background:white;border:1px solid #cfe0f5;border-radius:9px;color:#096ce0;padding:8px 10px;font-size:9px;font-weight:700;cursor:pointer}.loading-list{display:grid;gap:8px;padding:14px}.loading-list i{height:58px;border-radius:11px;background:linear-gradient(90deg,#f4f6fa,#eaf0f8,#f4f6fa);background-size:200% 100%;animation:shine 1.3s infinite}@keyframes shine{to{background-position:-200% 0}}@media(max-width:700px){.conversation-pane{border:0}.conversation-pane--hidden-mobile{display:none}}
  `],
})
export class ConversationListComponent {
  readonly items = input<ConversationItem[]>([]);
  readonly selectedId = input<string | null>(null);
  readonly counts = input({ all: 0, unread: 0 });
  readonly filter = input<'all' | 'unread'>('all');
  readonly query = input('');
  readonly loading = input(false);
  readonly isDoctor = input(false);
  readonly mobileChatOpen = input(false);
  readonly select = output<string>();
  readonly newConversation = output<void>();
  readonly filterChange = output<'all' | 'unread'>();
  readonly queryChange = output<string>();
}
