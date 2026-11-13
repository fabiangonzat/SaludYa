import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const token = request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!token) throw new Error('Sesión requerida');
    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authClient = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) throw new Error('Sesión inválida');
    const { requestId } = await request.json();
    const admin = createClient(url, serviceKey);
    const { data: verification, error } = await admin
      .from('doctor_verification_requests')
      .select('id, doctor_profile_id, license, specialty_name, created_at, applicant:profiles!doctor_verification_requests_doctor_profile_id_fkey(full_name, email)')
      .eq('id', requestId).single();
    if (error || !verification || verification.doctor_profile_id !== user.id) throw new Error('Solicitud no encontrada');

    const resendKey = Deno.env.get('RESEND_API_KEY');
    const recipient = Deno.env.get('ADMIN_NOTIFICATION_EMAIL') ?? 'rosalesnacho914@gmail.com';
    const sender = Deno.env.get('NOTIFICATION_FROM');
    if (!resendKey || !sender) throw new Error('El correo de notificación aún no está configurado');

    const applicant = verification.applicant as { full_name: string; email: string } | null;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: sender,
        to: [recipient],
        subject: `Nueva verificación médica: ${applicant?.full_name ?? 'Solicitante'}`,
        html: `<h2>Nueva solicitud de acceso médico</h2><p><b>Nombre:</b> ${applicant?.full_name ?? '—'}</p><p><b>Correo:</b> ${applicant?.email ?? '—'}</p><p><b>Licencia:</b> ${verification.license}</p><p><b>Especialidad:</b> ${verification.specialty_name}</p><p>Revísala desde el panel de administración de SaludYA.</p>`,
      }),
    });
    if (!response.ok) throw new Error('No se pudo enviar el correo de notificación');
    await admin.from('doctor_verification_requests').update({ notification_sent_at: new Date().toISOString() }).eq('id', requestId);
    return Response.json({ ok: true }, { headers: corsHeaders });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Error inesperado' }, { status: 400, headers: corsHeaders });
  }
});
