import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MedicalAppointment } from '../../services/appointments.models';
import { AppointmentsService } from '../../services/appointments.service';
import { DoctorsService } from '../medicos/doctors.service';

type AppointmentFilter = 'todas' | 'proximas' | 'pendientes' | 'completadas' | 'canceladas';
@Component({ selector: 'app-appointments-page', standalone: true, imports: [DatePipe, FormsModule, RouterLink], templateUrl: './appointments-page.html', styleUrl: './appointments-page.css' })
export class AppointmentsPage {
  readonly service = inject(AppointmentsService);
  readonly doctors = inject(DoctorsService);
  readonly filter = signal<AppointmentFilter>('todas');
  readonly query = signal('');
  readonly calendarView = signal<'mes'|'semana'>('mes');
  readonly calendarCursor = signal(new Date(new Date().getFullYear(),new Date().getMonth(),1));
  readonly selectedDate = signal('');
  readonly selected = signal<MedicalAppointment | null>(null);
  readonly action = signal<'cancelar'|'reprogramar'|''>('');
  readonly reason = signal('');
  readonly newDate = signal('');
  readonly newTime = signal('');
  readonly message = signal('');
  readonly today = new Date().toISOString().slice(0,10);
  readonly tabs: {id:AppointmentFilter;label:string}[] = [{id:'todas',label:'Todas'},{id:'proximas',label:'Próximas'},{id:'pendientes',label:'Pendientes'},{id:'completadas',label:'Completadas'},{id:'canceladas',label:'Canceladas'}];
  readonly filtered = computed(() => {
    const text = this.query().trim().toLocaleLowerCase('es');
    return this.service.appointments().filter((a) => {
      const statusMatch = this.filter()==='todas' || (this.filter()==='proximas' && ['pendiente','confirmada','reprogramada'].includes(a.status) && this.isFuture(a.date,a.time)) || (this.filter()==='pendientes' && a.status==='pendiente') || (this.filter()==='completadas' && a.status==='completada') || (this.filter()==='canceladas' && a.status==='cancelada');
      return statusMatch && (!text || `${a.doctorName} ${a.specialty} ${a.reason}`.toLocaleLowerCase('es').includes(text));
    }).sort((a,b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`));
  });
  readonly upcoming = computed(() => this.service.appointments().filter((a) => ['pendiente','confirmada','reprogramada'].includes(a.status) && this.isFuture(a.date,a.time)).sort((a,b)=>`${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`))[0] ?? null);
  readonly pendingCount = computed(() => this.service.appointments().filter(a=>a.status==='pendiente').length);
  readonly upcomingCount = computed(() => this.service.appointments().filter(a=>['pendiente','confirmada','reprogramada'].includes(a.status)&&this.isFuture(a.date,a.time)).length);
  readonly completedCount = computed(() => this.service.appointments().filter(a=>a.status==='completada').length);
  readonly cancelledCount = computed(() => this.service.appointments().filter(a=>a.status==='cancelada').length);
  readonly calendarDays = computed(() => {
    const cursor=this.calendarCursor(), dates:Date[]=[];
    if(this.calendarView()==='semana'){
      const start=new Date(cursor);start.setDate(cursor.getDate()-((cursor.getDay()+6)%7));
      for(let i=0;i<7;i++){const d=new Date(start);d.setDate(start.getDate()+i);dates.push(d);}
    }else{
      const first=new Date(cursor.getFullYear(),cursor.getMonth(),1);first.setDate(1-((first.getDay()+6)%7));
      for(let i=0;i<42;i++){const d=new Date(first);d.setDate(first.getDate()+i);dates.push(d);}
    }
    return dates.map(date=>{const key=this.ymd(date);return {date,key,inMonth:date.getMonth()===cursor.getMonth(),appointments:this.service.appointments().filter(a=>a.date===key)};});
  });
  readonly appointmentsOnSelectedDate = computed(() => this.service.appointments().filter(a=>a.date===this.selectedDate()).sort((a,b)=>a.time.localeCompare(b.time)));
  constructor(){this.doctors.load();}
  private ymd(date:Date):string{return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
  calendarTitle():string{return this.calendarView()==='mes'?new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(this.calendarCursor()):new Intl.DateTimeFormat('es-PE',{month:'long',year:'numeric'}).format(this.calendarCursor());}
  moveCalendar(delta:number):void{const cursor=new Date(this.calendarCursor());cursor.setDate(1);if(this.calendarView()==='mes')cursor.setMonth(cursor.getMonth()+delta);else cursor.setDate(cursor.getDate()+delta*7);this.calendarCursor.set(cursor);}
  setCalendarView(view:'mes'|'semana'):void{this.calendarView.set(view);}
  selectCalendarDay(key:string):void{this.selectedDate.set(key);}
  setFilter(value: AppointmentFilter): void { this.filter.set(value); }
  open(appointment: MedicalAppointment): void { this.selected.set(appointment); this.action.set(''); this.message.set(''); }
  close(): void { this.selected.set(null); this.action.set(''); this.message.set(''); }
  statusLabel(status: string): string { return ({pendiente:'Pendiente de confirmación',confirmada:'Confirmada (demo)',reprogramada:'Reprogramada (demo)','en-curso':'En curso',completada:'Completada',cancelada:'Cancelada','no-asistio':'No asistió'} as Record<string,string>)[status] ?? status; }
  canChange(a: MedicalAppointment): boolean { return ['pendiente','confirmada','reprogramada'].includes(a.status) && this.isFuture(a.date,a.time); }
  private isFuture(date:string,time:string):boolean{const [y,m,d]=date.split('-').map(Number);const [h,min]=time.split(':').map(Number);return new Date(y,m-1,d,h,min).getTime()>Date.now();}
  availableSlots(){const a=this.selected(); const doctor=this.doctors.doctors().find((d)=>d.id===a?.doctorId);return doctor?.slots.filter(s=>!s.taken&&this.isFuture(s.date,s.time)&&s.modality===a?.modality&&!this.service.hasSlot(doctor.id,s.date,s.time,a?.id))??[];}
  slotDates():string[]{return [...new Set(this.availableSlots().map(s=>s.date))].sort();}
  slotTimes():string[]{return this.availableSlots().filter(s=>s.date===this.newDate()).map(s=>s.time);}
  beginCancel():void{this.action.set('cancelar');this.reason.set('');this.message.set('');}
  beginReschedule():void{this.action.set('reprogramar');this.newDate.set('');this.newTime.set('');this.message.set('');}
  cancel():void{const a=this.selected();if(!a)return;if(!this.reason().trim()){this.message.set('Escribe el motivo de cancelación.');return;}if(!this.service.cancel(a.id,this.reason())){this.message.set('No se pudo cancelar la cita. Actualiza la lista e inténtalo de nuevo.');return;}this.doctors.releaseSlot(a.doctorId,a.date,a.time).subscribe();this.selected.set(this.service.appointments().find(x=>x.id===a.id)??null);this.action.set('');}
  reschedule():void{const a=this.selected();if(!a)return;if(!this.newDate()||!this.newTime()){this.message.set('Selecciona una fecha y hora disponibles.');return;}const date=this.newDate(),time=this.newTime();this.doctors.occupySlot(a.doctorId,date,time).subscribe({next:()=>{if(!this.service.reschedule(a.id,date,time)){this.doctors.releaseSlot(a.doctorId,date,time).subscribe();this.message.set('El horario dejó de estar disponible. Selecciona otro.');return;}this.doctors.releaseSlot(a.doctorId,a.date,a.time).subscribe();this.selected.set(this.service.appointments().find(x=>x.id===a.id)??null);this.action.set('');},error:()=>this.message.set('El horario dejó de estar disponible. Selecciona otro.')});}
}
