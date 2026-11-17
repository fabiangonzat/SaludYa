-- Store the clinic address entered by a doctor and copy it to the public doctor profile on approval.
alter table public.doctor_verification_requests
  add column if not exists clinic_address text;

create or replace function public.review_doctor_verification(
  p_request_id uuid,
  p_decision text,
  p_review_note text default null
) returns public.doctor_verification_requests
language plpgsql security definer set search_path = public as $$
declare
  v_request public.doctor_verification_requests;
  v_specialty_id bigint;
  v_result public.doctor_verification_requests;
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
    insert into public.doctors(profile_id, specialty_id, license, bio, price, years_experience, university, location, is_active)
    values (v_request.doctor_profile_id, v_specialty_id, v_request.license, v_request.bio,
      v_request.consultation_price, v_request.years_experience, v_request.university, nullif(trim(v_request.clinic_address), ''), true)
    on conflict (profile_id) do update set
      specialty_id = excluded.specialty_id, license = excluded.license, bio = excluded.bio,
      price = excluded.price, years_experience = excluded.years_experience,
      university = excluded.university, location = excluded.location, is_active = true;
  end if;

  update public.doctor_verification_requests
  set status = p_decision, review_note = nullif(trim(p_review_note), ''),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id returning * into v_result;
  return v_result;
end; $$;

grant execute on function public.review_doctor_verification(uuid, text, text) to authenticated;
