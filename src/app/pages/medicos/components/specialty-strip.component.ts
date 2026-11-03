import { Component, input, output } from '@angular/core';
import { SPECIALTIES } from '../doctors.models';

const ICONS: Record<string, string> = {
  'Medicina general': 'M12 4v16M8 8h8M8 16h3',
  'Cardiología': 'M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12C19 16.4 12 21 12 21z',
  'Dermatología': 'M12 4c4 4 6 7 6 10a6 6 0 1 1-12 0c0-3 2-6 6-10z',
  'Pediatría': 'M12 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM6 21v-2a6 6 0 0 1 12 0v2M8 11l-2 3M16 11l2 3',
  'Ginecología': 'M12 21s-7-4.6-9.5-9A5.5 5.5 0 0 1 12 6.5 5.5 5.5 0 0 1 21.5 12C19 16.4 12 21 12 21zM12 8v5',
  'Neurología': 'M9 8a3 3 0 1 1 6 0c0 2-1.5 3-3 4s-3 2-3 4a3 3 0 0 0 6 0',
  'Oftalmología': 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  'Traumatología': 'M7 4v16M17 4v16M7 8h10M7 16h10',
  'Odontología': 'M8 5c0-2 8-2 8 2 0 6-2 14-4 14S8 13 8 5z',
  'Psicología': 'M12 4a5 5 0 0 1 5 5v2a3 3 0 0 1-3 3h-1v3H11v-4a4 4 0 0 1-4-4V9a5 5 0 0 1 5-5z',
};

@Component({
  selector: 'app-specialty-strip',
  standalone: true,
  template: `
    <section class="specialty-strip" aria-label="Especialidades médicas">
      <div class="strip-head">
        <p class="kicker">ACCESO RÁPIDO</p>
        <h2>Especialidades</h2>
      </div>
      <div class="strip-grid">
        @for (name of specialties; track name) {
          <button type="button" class="specialty-chip" [class.selected]="selected() === name" (click)="select.emit(name)">
            <span class="specialty-ico" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path [attr.d]="icon(name)" /></svg>
            </span>
            <span>{{ name }}</span>
          </button>
        }
      </div>
    </section>
  `,
  styles: [`
    .kicker{font-size:9px;letter-spacing:.13em;font-weight:800;color:#8796aa;margin:0 0 4px}
    h2{margin:0;font-size:16px;letter-spacing:-.03em;color:#0b2a5b}
    .strip-head{margin-bottom:12px}
    .strip-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
    .specialty-chip{display:flex;align-items:center;gap:10px;padding:11px 12px;border:1px solid #e6edf7;background:#fff;border-radius:14px;color:#2b405c;font:inherit;font-size:12px;font-weight:650;text-align:left;cursor:pointer;transition:transform .15s,box-shadow .15s,border-color .15s}
    .specialty-chip:hover,.specialty-chip.selected{border-color:#c5ddfa;background:#f7fbff;color:#0a62d0;box-shadow:0 8px 18px #17345d0c}
    .specialty-chip.selected{transform:translateY(-1px)}
    .specialty-ico{width:32px;height:32px;flex:none;border-radius:10px;display:grid;place-items:center;background:#eaf3ff;color:#087bfa}
    .specialty-ico svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
    @media(max-width:1100px){.strip-grid{grid-template-columns:repeat(3,minmax(0,1fr))}}
    @media(max-width:700px){.strip-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `],
})
export class SpecialtyStripComponent {
  readonly selected = input('');
  readonly select = output<string>();
  readonly specialties = SPECIALTIES;
  icon(name: string): string {
    return ICONS[name] ?? ICONS['Medicina general'];
  }
}
