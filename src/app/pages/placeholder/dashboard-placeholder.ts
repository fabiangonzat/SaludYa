import { Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
@Component({ selector: 'app-dashboard-placeholder', standalone: true, imports: [RouterLink], template: `<main class="placeholder"><a routerLink="/inicio">← Volver al menú principal</a><span class="badge">SaludYA</span><h1>{{ title }}</h1><p>{{ description }}</p><div class="note">Esta sección se habilitará al conectar el servicio correspondiente.</div></main>`, styles: [`.placeholder{max-width:680px;margin:10vh auto;padding:32px;font-family:Inter,system-ui,sans-serif;color:#0b2a5b;background:#fff;border:1px solid #e6edf7;border-radius:24px;box-shadow:0 18px 50px #17345d12}.placeholder a{color:#087bfa;text-decoration:none;font-weight:700;font-size:13px}.badge{display:block;margin-top:56px;color:#087bfa;font-size:11px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}.placeholder h1{font-size:30px;margin:10px 0}.placeholder p{color:#66758e;line-height:1.6}.note{margin-top:24px;padding:16px;border-radius:12px;background:#f1f6ff;color:#56708d;font-size:13px}`] })
export class DashboardPlaceholder {
  private readonly route = inject(ActivatedRoute);
  readonly title = this.route.snapshot.data['title'] as string;
  readonly description = this.route.snapshot.data['description'] as string;
}
