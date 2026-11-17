import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { ChatMessage } from '../../services/messages.service';

@Component({
  selector: 'app-message-bubble',
  standalone: true,
  imports: [DatePipe],
  template: `
    <article class="bubble-row" [class.bubble-row--mine]="message().sender_id === currentUserId()">
      <div class="bubble" [class.bubble--mine]="message().sender_id === currentUserId()">
        @if(message().message_type === 'text'){<p>{{message().content}}</p>}
        @else if(message().attachmentUrl){<a class="attachment" [href]="message().attachmentUrl" target="_blank" rel="noopener noreferrer">{{message().message_type === 'image' ? '▧' : '▤'}} {{message().content}} <span>↗</span></a>}
        @else{<p>{{message().content}}</p>}
        <footer><time>{{message().created_at|date:'shortTime':'':'es-PE'}}</time>@if(message().sender_id===currentUserId()){<span class="receipt" [class.receipt--read]="!!message().read_at" [attr.aria-label]="message().read_at?'Leído':'Enviado'">{{message().read_at?'✓✓':'✓'}}</span>}</footer>
      </div>
    </article>
  `,
  styles: [`
    .bubble-row{display:flex;justify-content:flex-start;margin:8px 0}.bubble-row--mine{justify-content:flex-end}.bubble{max-width:min(78%,520px);padding:10px 12px 7px;border:1px solid #e7edf5;background:white;border-radius:15px 15px 15px 4px;box-shadow:0 2px 6px #16385c08}.bubble--mine{background:#087bfa;color:white;border-color:#087bfa;border-radius:15px 15px 4px 15px}.bubble p{margin:0;white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;line-height:1.5}.bubble footer{display:flex;justify-content:flex-end;align-items:center;gap:5px;margin-top:5px;font-size:8px;color:#9aa7b6}.bubble--mine footer{color:#d9eaff}.receipt{font-weight:800;letter-spacing:-2px}.receipt--read{color:#9be8ff}.attachment{display:flex;gap:7px;align-items:center;color:#2368ba;font-size:11px;font-weight:650;text-decoration:none;overflow-wrap:anywhere}.bubble--mine .attachment{color:white}.attachment span{opacity:.7}
  `],
})
export class MessageBubbleComponent {
  readonly message = input.required<ChatMessage>();
  readonly currentUserId = input.required<string>();
}
