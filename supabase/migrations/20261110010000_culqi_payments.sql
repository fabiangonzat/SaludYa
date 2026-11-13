-- Payments are owned by SaludYA. A patient makes one payment; the 15/85 split
-- remains in the commission ledger and is settled to the doctor after care.

create type public.payment_status as enum ('pending', 'processing', 'paid', 'failed', 'refunded');

create table public.appointment_payments (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.profiles(id) on delete restrict,
  provider text not null default 'culqi' check (provider = 'culqi'),
  provider_payment_id text unique,
  amount numeric(12,2) not null check (amount > 0),
  currency text not null default 'PEN' check (currency = 'PEN'),
  payment_method text,
  status public.payment_status not null default 'pending',
  provider_response jsonb,
  failure_reason text,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointment_payments_patient_idx on public.appointment_payments(patient_id, created_at desc);
create index appointment_payments_status_idx on public.appointment_payments(status, created_at desc);
create trigger appointment_payments_updated_at before update on public.appointment_payments for each row execute function public.set_updated_at();

alter table public.appointment_payments enable row level security;
create policy "patients read own payments" on public.appointment_payments for select to authenticated using (patient_id = auth.uid());
create policy "admins read payments" on public.appointment_payments for select to authenticated using (public.is_admin());

-- Every booked slot begins as pending payment. The Edge Function is the only
-- component allowed to set paid/failed and to confirm the appointment.
create or replace function public.book_appointment(
  p_doctor_id uuid, p_date date, p_time time, p_modality public.modality,
  p_reason text, p_symptoms text default null, p_price numeric default 0,
  p_duration_minutes smallint default 30
) returns public.appointments
language plpgsql security definer set search_path = public as $$
declare v_slot public.doctor_slots; v_appointment public.appointments; v_specialty_id bigint; v_price numeric(12,2);
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'patient') then raise exception 'Solo un paciente puede reservar una cita'; end if;
  select * into v_slot from public.doctor_slots where doctor_id = p_doctor_id and date = p_date and time = p_time for update;
  if not found or v_slot.is_taken or v_slot.modality <> p_modality then raise exception 'El horario ya no está disponible'; end if;
  if p_date + p_time <= now() then raise exception 'No se puede reservar un horario pasado'; end if;
  select specialty_id, price into v_specialty_id, v_price from public.doctors where id = p_doctor_id and is_active;
  if not found then raise exception 'El médico no está disponible'; end if;
  if v_price <= 0 then raise exception 'El médico debe configurar un precio de consulta válido'; end if;
  insert into public.appointments (patient_id, doctor_id, specialty_id, date, time, modality, reason, symptoms, price, duration_minutes)
  values (auth.uid(), p_doctor_id, v_specialty_id, p_date, p_time, p_modality, p_reason, nullif(p_symptoms, ''), v_price, p_duration_minutes)
  returning * into v_appointment;
  update public.doctor_slots set is_taken = true, appointment_id = v_appointment.id where id = v_slot.id;
  insert into public.appointment_payments (appointment_id, patient_id, amount)
  values (v_appointment.id, auth.uid(), v_price);
  insert into public.appointment_changes (appointment_id, action, to_date, to_time, created_by) values (v_appointment.id, 'creada', p_date, p_time, auth.uid());
  return v_appointment;
end; $$;
