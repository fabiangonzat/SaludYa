-- Verification gate for doctor accounts. A doctor profile is created only after
-- an administrator approves the submitted credentials and supporting images.

create table public.doctor_verification_requests (
  id uuid primary key default gen_random_uuid(),
  doctor_profile_id uuid not null unique references public.profiles(id) on delete cascade,
  license text not null,
  specialty_name text not null,
  university text,
  years_experience integer not null default 0 check (years_experience between 0 and 60),
  consultation_price numeric(12,2) not null default 0 check (consultation_price >= 0),
  bio text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  notification_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctor_verification_documents (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.doctor_verification_requests(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  created_at timestamptz not null default now()
);

create trigger doctor_verification_requests_updated_at
before update on public.doctor_verification_requests
for each row execute function public.set_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'doctor-verification-documents',
  'doctor-verification-documents',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp']
) on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.doctor_verification_requests enable row level security;
alter table public.doctor_verification_documents enable row level security;

create policy "doctors create their own verification request"
on public.doctor_verification_requests for insert to authenticated
with check (doctor_profile_id = auth.uid() and exists (
  select 1 from public.profiles where id = auth.uid() and role = 'doctor'
));
create policy "doctors read their own verification request"
on public.doctor_verification_requests for select to authenticated
using (doctor_profile_id = auth.uid());
create policy "admins manage verification requests"
on public.doctor_verification_requests for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "doctors add documents to own request"
on public.doctor_verification_documents for insert to authenticated
with check (exists (
  select 1 from public.doctor_verification_requests r
  where r.id = request_id and r.doctor_profile_id = auth.uid()
));
create policy "doctors read own verification documents"
on public.doctor_verification_documents for select to authenticated
using (exists (
  select 1 from public.doctor_verification_requests r
  where r.id = request_id and r.doctor_profile_id = auth.uid()
));
create policy "admins manage verification documents"
on public.doctor_verification_documents for all to authenticated
using (public.is_admin()) with check (public.is_admin());

create policy "doctors upload own verification images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'doctor-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);
create policy "doctors see own verification images"
on storage.objects for select to authenticated
using (
  bucket_id = 'doctor-verification-documents'
  and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin())
);
create policy "doctors delete own verification images"
on storage.objects for delete to authenticated
using (
  bucket_id = 'doctor-verification-documents'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create or replace function public.review_doctor_verification(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
) returns public.doctor_verification_requests
language plpgsql security definer set search_path = public as $$
declare v_request public.doctor_verification_requests; v_specialty_id bigint; v_result public.doctor_verification_requests;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede revisar solicitudes'; end if;
  if p_decision not in ('approved', 'rejected') then raise exception 'Decisión inválida'; end if;
  select * into v_request from public.doctor_verification_requests where id = p_request_id for update;
  if not found then raise exception 'Solicitud no encontrada'; end if;
  if v_request.status <> 'pending' then raise exception 'Esta solicitud ya fue revisada'; end if;

  if p_decision = 'approved' then
    select id into v_specialty_id from public.specialties where lower(name) = lower(trim(v_request.specialty_name)) limit 1;
    if v_specialty_id is null then
      insert into public.specialties(name) values (trim(v_request.specialty_name)) returning id into v_specialty_id;
    end if;
    insert into public.doctors(profile_id, specialty_id, license, bio, price, years_experience, university, is_active)
    values (v_request.doctor_profile_id, v_specialty_id, v_request.license, v_request.bio,
      v_request.consultation_price, v_request.years_experience, v_request.university, true)
    on conflict (profile_id) do update set
      specialty_id = excluded.specialty_id, license = excluded.license, bio = excluded.bio,
      price = excluded.price, years_experience = excluded.years_experience,
      university = excluded.university, is_active = true;
  end if;

  update public.doctor_verification_requests
  set status = p_decision, review_note = nullif(trim(p_review_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id returning * into v_result;
  return v_result;
end; $$;

grant execute on function public.review_doctor_verification(uuid, text, text) to authenticated;
alter publication supabase_realtime add table public.doctor_verification_requests;
