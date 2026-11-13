-- Financial audit ledger for the SaludYA marketplace.
-- A 15% platform commission is accrued once an appointment is completed.

create type public.commission_status as enum ('accrued', 'settled', 'void');

create table public.appointment_commissions (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null unique references public.appointments(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  gross_amount numeric(12,2) not null check (gross_amount >= 0),
  commission_rate numeric(5,4) not null default 0.1500 check (commission_rate between 0 and 1),
  platform_fee numeric(12,2) not null check (platform_fee >= 0),
  doctor_payout numeric(12,2) not null check (doctor_payout >= 0),
  status public.commission_status not null default 'accrued',
  settled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (platform_fee + doctor_payout = gross_amount)
);

create index appointment_commissions_doctor_idx on public.appointment_commissions(doctor_id, created_at desc);
create index appointment_commissions_status_idx on public.appointment_commissions(status, created_at desc);
create trigger appointment_commissions_updated_at before update on public.appointment_commissions
for each row execute function public.set_updated_at();

-- Backfill existing completed appointments and keep the financial record in sync.
create or replace function public.sync_appointment_commission()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_rate numeric(5,4) := 0.1500; v_fee numeric(12,2);
begin
  if new.status = 'completada' then
    v_fee := round(new.price * v_rate, 2);
    insert into public.appointment_commissions (
      appointment_id, doctor_id, gross_amount, commission_rate, platform_fee, doctor_payout, status
    ) values (
      new.id, new.doctor_id, new.price, v_rate, v_fee, new.price - v_fee, 'accrued'
    ) on conflict (appointment_id) do update set
      gross_amount = excluded.gross_amount,
      commission_rate = excluded.commission_rate,
      platform_fee = excluded.platform_fee,
      doctor_payout = excluded.doctor_payout,
      status = case when appointment_commissions.status = 'settled' then 'settled'::public.commission_status else 'accrued'::public.commission_status end,
      updated_at = now();
  elsif old.status = 'completada' and new.status <> 'completada' then
    update public.appointment_commissions set status = 'void' where appointment_id = new.id and status <> 'settled';
  end if;
  return new;
end; $$;

create trigger appointments_sync_commission
after insert or update of status, price on public.appointments
for each row execute function public.sync_appointment_commission();

insert into public.appointment_commissions (appointment_id, doctor_id, gross_amount, commission_rate, platform_fee, doctor_payout, status)
select id, doctor_id, price, 0.1500, round(price * 0.1500, 2), price - round(price * 0.1500, 2), 'accrued'
from public.appointments where status = 'completada'
on conflict (appointment_id) do nothing;

alter table public.appointment_commissions enable row level security;
create policy "admins read all commissions" on public.appointment_commissions
for select to authenticated using (public.is_admin());
create policy "admins manage commission settlements" on public.appointment_commissions
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "doctors read own commissions" on public.appointment_commissions
for select to authenticated using (public.is_own_doctor(doctor_id));

alter publication supabase_realtime add table public.appointment_commissions;
