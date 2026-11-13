import { Injectable } from '@angular/core';

type CulqiInstance = {
  token?: { id: string };
  error?: { user_message?: string; message?: string };
  culqi?: () => void;
  open: () => void;
  close?: () => void;
};

declare global {
  interface Window {
    CulqiCheckout?: new (publicKey: string, configuration: unknown) => CulqiInstance;
  }
}

@Injectable({ providedIn: 'root' })
export class CulqiCheckoutService {
  private loader?: Promise<void>;

  async open(input: { publicKey: string; amount: number; email: string; fullName: string }): Promise<string> {
    if (!input.publicKey) throw new Error('Los pagos con Culqi todavía no están configurados.');
    await this.loadScript();
    if (!window.CulqiCheckout) throw new Error('No se pudo abrir el checkout de Culqi.');

    const [firstName = 'Paciente', ...lastName] = input.fullName.trim().split(/\s+/);
    return new Promise<string>((resolve, reject) => {
      const checkout = new window.CulqiCheckout!(input.publicKey, {
        settings: { title: 'SaludYA', currency: 'PEN', amount: Math.round(input.amount * 100) },
        client: { email: input.email, firstName, lastName: lastName.join(' ') },
        options: {
          lang: 'es', modal: true, installments: false,
          paymentMethods: { tarjeta: true, yape: true, billetera: false, bancaMovil: false, agente: false, cuotealo: false },
          paymentMethodsSort: ['tarjeta', 'yape'],
        },
        appearance: {
          theme: 'default', menuType: 'sidebar', buttonCardPayText: `Pagar S/ ${input.amount.toFixed(2)}`,
          defaultStyle: { bannerColor: '#0d5fd7', buttonBackground: '#0d72e8', menuColor: '#0d5fd7', linksColor: '#0d5fd7', buttonTextColor: '#ffffff', priceColor: '#0d5fd7' },
        },
      });
      checkout.culqi = () => {
        if (checkout.token?.id) { checkout.close?.(); resolve(checkout.token.id); return; }
        checkout.close?.();
        reject(new Error(checkout.error?.user_message ?? checkout.error?.message ?? 'No se pudo generar el token de pago.'));
      };
      checkout.open();
    });
  }

  private loadScript(): Promise<void> {
    if (window.CulqiCheckout) return Promise.resolve();
    if (this.loader) return this.loader;
    this.loader = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://js.culqi.com/checkout-js';
      script.async = true;
      script.onload = () => window.CulqiCheckout ? resolve() : reject(new Error('Culqi no se cargó correctamente.'));
      script.onerror = () => reject(new Error('No se pudo conectar con Culqi. Revisa tu conexión.'));
      document.body.appendChild(script);
    });
    return this.loader;
  }
}
