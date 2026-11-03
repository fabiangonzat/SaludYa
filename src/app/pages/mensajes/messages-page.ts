import { Component, HostListener, computed, signal } from '@angular/core';
import { ConversationItem, ConversationListComponent } from './components/conversation-list.component';
import { ChatWindowComponent } from './components/chat-window.component';
import { ChatMessage } from './message-bubble.component';

type DemoConversation = ConversationItem & { messages: ChatMessage[] };
type Filter = 'all' | 'unread' | 'archived';
const recent = (minutes:number) => new Date(Date.now()-minutes*60_000);
const demoConversations: DemoConversation[] = [
 {id:'demo-cardio',doctorName:'Dra. Elena Vargas',specialty:'Cardiología',initials:'EV',color:'linear-gradient(135deg,#58a6e8,#526bdb)',available:true,unread:2,archived:false,updatedAt:recent(12),lastMessage:'De acuerdo, doctora. Gracias.',messages:[
  {id:'m1',sender:'doctor',text:'Hola. Te escribo para confirmar que recibí tu consulta. ¿En qué puedo ayudarte?',date:recent(180)},
  {id:'m2',sender:'patient',text:'Quería confirmar los detalles de mi próxima cita.',date:recent(170),status:'read'},
  {id:'m3',sender:'doctor',text:'Claro. Podemos revisar eso durante la consulta. Si tienes documentación que quieras comentar, tráela contigo.',date:recent(25)},
  {id:'m4',sender:'doctor',text:'¿Te queda bien el horario que aparece en tu agenda?',date:recent(12)},
  {id:'m5',sender:'patient',text:'De acuerdo, doctora. Gracias.',date:recent(8),status:'sent'},
 ]},
 {id:'demo-derma',doctorName:'Dr. Mateo Salas',specialty:'Dermatología',initials:'MS',color:'linear-gradient(135deg,#46bba3,#258b91)',available:false,unread:0,archived:false,updatedAt:recent(260),lastMessage:'Perfecto, nos vemos en la consulta.',messages:[
  {id:'d1',sender:'patient',text:'Hola doctor, quisiera conversar sobre mi consulta de seguimiento.',date:recent(330),status:'read'},
  {id:'d2',sender:'doctor',text:'Perfecto, nos vemos en la consulta.',date:recent(260)},
 ]},
 {id:'demo-general',doctorName:'Dra. Lucía Paredes',specialty:'Medicina general',initials:'LP',color:'linear-gradient(135deg,#e5a458,#d97862)',available:true,unread:0,archived:true,updatedAt:recent(1440),lastMessage:'Gracias por avisarme.',messages:[{id:'g1',sender:'patient',text:'Gracias por avisarme.',date:recent(1440),status:'delivered'}]},
];
const availableDoctors=[
 {id:'new-pedia',name:'Dra. Ana Ríos',specialty:'Pediatría',initials:'AR',color:'linear-gradient(135deg,#b78bea,#8060cb)'},
 {id:'new-psico',name:'Dr. Diego León',specialty:'Psicología',initials:'DL',color:'linear-gradient(135deg,#64bd9d,#399b82)'},
 {id:'new-neuro',name:'Dra. Sofía Núñez',specialty:'Neurología',initials:'SN',color:'linear-gradient(135deg,#6c9fec,#5366c4)'},
];
@Component({selector:'app-messages-page',standalone:true,imports:[ConversationListComponent,ChatWindowComponent],templateUrl:'./messages-page.html',styleUrl:'./messages-page.css'})
export class MessagesPage {
 readonly conversations=signal<DemoConversation[]>(demoConversations);
 readonly selectedId=signal<string|null>(null);
 readonly filter=signal<Filter>('all');
 readonly query=signal('');
 readonly mobileChatOpen=signal(false);
 readonly draft=signal('');
 readonly pendingAttachment=signal('');
 readonly toast=signal('');
 readonly modalOpen=signal(false);
 readonly doctorQuery=signal('');
 readonly doctorSpecialty=signal('Todas');
 readonly notificationOpen=signal(false);
 readonly specialties=['Todas','Cardiología','Dermatología','Medicina general','Pediatría','Psicología','Neurología'];
 readonly doctors=availableDoctors;
 readonly filteredDoctors=computed(()=>this.doctors.filter(d=>(this.doctorSpecialty()==='Todas'||d.specialty===this.doctorSpecialty())&&(d.name+' '+d.specialty).toLowerCase().includes(this.doctorQuery().toLowerCase())));
 readonly visibleConversations=computed(()=>this.conversations().filter(c=>this.filter()==='archived'?c.archived:!c.archived&&(this.filter()==='all'||c.unread>0)).filter(c=>(c.doctorName+' '+c.specialty+' '+c.lastMessage).toLowerCase().includes(this.query().toLowerCase())).sort((a,b)=>b.updatedAt.getTime()-a.updatedAt.getTime()));
 readonly unreadCount=computed(()=>this.conversations().filter(c=>!c.archived).reduce((n,c)=>n+c.unread,0));
 readonly counts=computed(()=>({all:this.conversations().filter(c=>!c.archived).length,unread:this.unreadCount()}));
 readonly selected=computed(()=>this.conversations().find(c=>c.id===this.selectedId())??null);
 readonly selectedMessages=computed(()=>this.selected()?.messages??[]);
 private toastTimer?:ReturnType<typeof setTimeout>;
 selectConversation(id:string):void{this.selectedId.set(id);this.mobileChatOpen.set(true);this.conversations.update(list=>list.map(c=>c.id===id?{...c,unread:0}:c));}
 sendMessage():void{const text=this.draft().trim();const attachment=this.pendingAttachment();if(!text&&!attachment)return;const c=this.selected();if(!c)return;const now=new Date();const message:ChatMessage={id:crypto.randomUUID(),sender:'patient',text:text||'Archivo adjunto',date:now,status:'sent',attachment:attachment||undefined};this.conversations.update(list=>list.map(item=>item.id===c.id?{...item,messages:[...item.messages,message],lastMessage:message.text,updatedAt:now}:item));this.draft.set('');this.pendingAttachment.set('');this.notify('Mensaje agregado a la demostración; no se envió a un médico.');}
 handleFiles(event:Event):void{const input=event.target as HTMLInputElement;const files=Array.from(input.files??[]);if(!files.length)return;const allowed=['image/jpeg','image/png','image/webp','application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'];const file=files[0];if(!allowed.includes(file.type)){this.notify('Formato no permitido. Usa JPG, PNG, WEBP, PDF o DOC.');input.value='';return;}if(file.size>5*1024*1024){this.notify('El archivo supera el límite de 5 MB.');input.value='';return;}this.pendingAttachment.set(file.name);this.notify('Adjunto local de demostración: aún no se ha subido.');input.value='';}
 archive(id:string):void{this.conversations.update(list=>list.map(c=>c.id===id?{...c,archived:!c.archived,unread:0}:c));this.selectedId.set(null);this.mobileChatOpen.set(false);this.notify('Conversación actualizada en esta demostración.');}
 startConversation(doctor:typeof availableDoctors[number]):void{let c=this.conversations().find(x=>x.id===doctor.id);if(!c){const now=new Date();c={id:doctor.id,doctorName:doctor.name,specialty:doctor.specialty,initials:doctor.initials,color:doctor.color,available:true,unread:0,archived:false,updatedAt:now,lastMessage:'Nueva conversación de demostración',messages:[]};this.conversations.update(list=>[c!,...list]);}this.filter.set('all');this.query.set('');this.modalOpen.set(false);this.selectConversation(c.id);}
 notify(message:string):void{this.toast.set(message);if(this.toastTimer)clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.toast.set(''),3500);}
 @HostListener('document:keydown.escape') closeModal():void{this.modalOpen.set(false);this.notificationOpen.set(false);}
}
