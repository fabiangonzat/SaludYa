import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type CulqiCharge = {
  id?: string;
  response_code?: string;
  user_message?: string;
  merchant_message?: string;
  source?: { type?: string };
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('Sesión requerida');

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const culqiSecretKey = Deno.env.get('CULQI_SECRET_KEY');
    if (!culqiSecretKey) throw new Error('Culqi aún no está configurado en el servidor');

    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error('Sesión inválida');

    const { appointmentId, tokenId, deviceFingerprintId, installments } = await request.json();
    if (typeof appointmentId !== 'string' || typeof tokenId !== 'string' || !/^(tkn|ype)_(test|live)_/.test(tokenId)) {
      throw new Error('Datos de pago inválidos');
    }

    const admin = createClient(url, serviceKey);
    const { data: appointment, error: appointmentError } = await admin
      .from('appointments')
      .select('id, patient_id, price, status, patient:profiles!appointments_patient_id_fkey(full_name, email, phone)')
      .eq('id', appointmentId)
      .single();
    if (appointmentError || !appointment || appointment.patient_id !== user.id) throw new Error('No puedes pagar esta cita');
    if (appointment.status !== 'pendiente') throw new Error('Esta cita ya no está disponible para pago');

    const { data: payment, error: paymentError } = await admin
      .from('appointment_payments')
      .update({ status: 'processing', failure_reason: null })
      .eq('appointment_id', appointmentId)
      .eq('patient_id', user.id)
      .in('status', ['pending', 'failed'])
      .select('id, amount')
      .maybeSingle();
    if (paymentError || !payment) throw new Error('El pago ya está siendo procesado o no está disponible');

    const patient = appointment.patient as { full_name: string; email: string; phone: string | null } | null;
    const [firstName = 'Paciente', ...lastName] = (patient?.full_name ?? '').trim().split(/\s+/);
    const response = await fetch('https://api.culqi.com/v2/charges', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${culqiSecretKey}`,
        'Content-Type': 'application/json',
        'x-culqi-product': 'online',
      },
      body: JSON.stringify({
        amount: Math.round(Number(payment.amount) * 100),
        currency_code: 'PEN',
        email: patient?.email ?? user.email,
        source_id: tokenId,
        capture: true,
        description: `Consulta SaludYA ${appointmentId.slice(0, 8)}`,
        installments: typeof installments === 'number' && installments > 1 ? installments : undefined,
        metadata: { appointment_id: appointmentId, patient_id: user.id },
        antifraud_details: {
          first_name: firstName,
          last_name: lastName.join(' ') || undefined,
          phone_number: patient?.phone ?? undefined,
          device_finger_print_id: typeof deviceFingerprintId === 'string' ? deviceFingerprintId : undefined,
        },
      }),
    });

    const charge = await response.json() as CulqiCharge;
    const paid = response.ok && charge.response_code === 'venta_exitosa' && Boolean(charge.id);
    if (!paid) {
      const reason = charge.user_message ?? charge.merchant_message ?? 'Culqi no pudo aprobar el pago';
      await admin.from('appointment_payments').update({ status: 'failed', failure_reason: reason, provider_response: charge }).eq('id', payment.id);
      return Response.json({ error: reason }, { status: 402, headers: corsHeaders });
    }

    const now = new Date().toISOString();
    await admin.from('appointment_payments').update({
      status: 'paid', provider_payment_id: charge.id, payment_method: charge.source?.type ?? 'culqi',
      provider_response: charge, paid_at: now,
    }).eq('id', payment.id);
    const { error: confirmationError } = await admin.from('appointments').update({ status: 'confirmada' }).eq('id', appointmentId);
    if (confirmationError) throw new Error('El pago se registró, pero la cita requiere validación administrativa');

    return Response.json({ ok: true, paymentId: charge.id }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Error inesperado al procesar el pago' }, { status: 400, headers: corsHeaders });
  }
});
