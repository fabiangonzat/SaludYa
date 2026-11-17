-- A booking can only be confirmed or treated as a visit after Culqi has approved its payment.
create policy "doctors read own appointment payments" on public.appointment_payments
for select to authenticated using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_id and public.is_own_doctor(a.doctor_id)
  )
);

create or replace function public.require_paid_appointment_before_service()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.status in ('confirmada', 'reprogramada', 'en-curso', 'completada')
     and not exists (
       select 1 from public.appointment_payments p
       where p.appointment_id = new.id and p.status = 'paid'
     ) then
    raise exception 'La cita requiere un pago aprobado antes de confirmarse o atenderse';
  end if;
  return new;
end; $$;

create trigger appointments_require_payment_before_service
before update of status on public.appointments
for each row execute function public.require_paid_appointment_before_service();

alter publication supabase_realtime add table public.appointment_payments;
