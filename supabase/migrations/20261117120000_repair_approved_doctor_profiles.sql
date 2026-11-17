-- Restore doctor profiles that are missing even though their verification
-- request was approved. Only approved requests are eligible for this repair.

insert into public.specialties (name)
select distinct trim(r.specialty_name)
from public.doctor_verification_requests r
where r.status = 'approved'
  and nullif(trim(r.specialty_name), '') is not null
  and not exists (
    select 1
    from public.specialties s
    where lower(trim(s.name)) = lower(trim(r.specialty_name))
  )
on conflict (name) do nothing;

insert into public.doctors (
  profile_id,
  specialty_id,
  license,
  bio,
  price,
  years_experience,
  university,
  is_active
)
select
  r.doctor_profile_id,
  s.id,
  r.license,
  r.bio,
  r.consultation_price,
  r.years_experience,
  r.university,
  true
from public.doctor_verification_requests r
join lateral (
  select id
  from public.specialties
  where lower(trim(name)) = lower(trim(r.specialty_name))
  order by id
  limit 1
) s on true
where r.status = 'approved'
  and not exists (
    select 1 from public.doctors d where d.profile_id = r.doctor_profile_id
  )
  and not exists (
    select 1 from public.doctors d where d.license = r.license
  )
on conflict (profile_id) do nothing;
