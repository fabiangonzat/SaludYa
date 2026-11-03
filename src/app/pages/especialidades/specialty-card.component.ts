import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SpecialtyInfo } from './specialties.catalog';

@Component({
  selector: 'app-specialty-card', standalone: true, imports: [RouterLink],
  template: `
    <article class="specialty-card" [class.editorial]="specialty().featured">
      <div class="card-top"><span class="icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path [attr.d]="specialty().icon" /></svg></span>@if(specialty().featured){<span class="editorial-tag">Selección editorial</span>}</div>
      <h3>{{specialty().name}}</h3><p class="description">{{specialty().description}}</p>
      <div class="availability"><i [class.has-doctors]="(doctorCount() ?? 0)>0"></i><strong>{{doctorCount() ?? '—'}}</strong><span>{{doctorCount()===1?'médico':'médicos'}} en el catálogo demo</span></div>
      <div class="card-actions"><button class="details" type="button" (click)="details.emit(specialty())">Ver información</button><a class="explore" [routerLink]="['/medicos']" [queryParams]="{especialidad:specialty().name}">Explorar especialidad <span aria-hidden="true">→</span></a></div>
    </article>
  `,
  styles: [`
    :host{display:block;min-width:0}.specialty-card{height:100%;min-height:235px;display:flex;flex-direction:column;padding:18px;background:#fff;border:1px solid #e4ebf4;border-radius:16px;box-shadow:0 5px 18px #15385c08;transition:transform .16s,box-shadow .16s,border-color .16s}.specialty-card:hover{transform:translateY(-2px);border-color:#c8def6;box-shadow:0 11px 24px #15385c12}.specialty-card.editorial{border-top:3px solid #087bfa}.card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.icon{width:42px;height:42px;display:grid;place-items:center;background:#eaf3ff;color:#087bfa;border-radius:12px}.icon svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}.editorial-tag{padding:5px 7px;border-radius:6px;background:#f0f6ff;color:#5379a5;font-size:8px;font-weight:700}.specialty-card h3{margin:15px 0 6px;color:#193858;font-size:15px;line-height:1.35;letter-spacing:-.02em}.description{min-height:48px;margin:0;color:#77879c;font-size:11px;line-height:1.55}.availability{display:flex;align-items:center;gap:6px;margin:12px 0;color:#8090a5;font-size:9px}.availability i{width:7px;height:7px;border-radius:50%;background:#b9c3d0}.availability i.has-doctors{background:#20a575}.availability strong{color:#405977;font-size:10px}.card-actions{display:flex;align-items:center;gap:9px;margin-top:auto;padding-top:10px;border-top:1px solid #edf1f6}.details{flex:none;padding:6px 0;border:0;background:none;color:#71839a;font:inherit;font-size:9px;font-weight:650;cursor:pointer}.details:hover{color:#0874e8}.explore{display:flex;align-items:center;justify-content:space-between;gap:5px;margin-left:auto;color:#0874e8;text-decoration:none;font-size:10px;font-weight:750}.explore span{font-size:15px;transition:transform .15s}.explore:hover span{transform:translateX(3px)}
  `],
})
export class SpecialtyCardComponent {
  readonly specialty = input.required<SpecialtyInfo>();
  readonly doctorCount = input<number | null>(0);
  readonly details = output<SpecialtyInfo>();
}
