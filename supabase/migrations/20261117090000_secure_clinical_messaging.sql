-- Persistent, participant-scoped conversations built on the existing messages
-- table and the existing appointments/doctors/profiles relationships.
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_message_at timestamptz,
  unique (patient_id, doctor_id)
);

alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.messages add column if not exists message_type text not null default 'text';
alter table public.messages add column if not exists attachment_path text;
alter table public.messages add column if not exists read_at timestamptz;
alter table public.messages alter column appointment_id drop not null;

alter table public.messages drop constraint if exists messages_message_type_check;
alter table public.messages add constraint messages_message_type_check
  check (message_type in ('text', 'image', 'document'));
alter table public.messages drop constraint if exists messages_attachment_type_check;
alter table public.messages add constraint messages_attachment_type_check
  check ((message_type = 'text' and attachment_path is null) or
         (message_type in ('image', 'document') and attachment_path is not null));

create index if not exists conversations_patient_updated_idx on public.conversations(patient_id, updated_at desc);
create index if not exists conversations_doctor_updated_idx on public.conversations(doctor_id, updated_at desc);
create index if not exists messages_conversation_created_idx on public.messages(conversation_id, created_at desc);
create index if not exists messages_conversation_unread_idx on public.messages(conversation_id, receiver_id, is_read, created_at desc);

-- Backfill existing appointment-linked direct messages into one conversation
-- per patient/doctor relationship, without discarding message history.
insert into public.conversations (patient_id, doctor_id, last_message_at)
select distinct a.patient_id, a.doctor_id, max(m.created_at) over (partition by a.patient_id, a.doctor_id)
from public.appointments a
join public.doctors d on d.id = a.doctor_id
join public.profiles patient_profile on patient_profile.id = a.patient_id and patient_profile.role = 'patient'
join public.profiles doctor_profile on doctor_profile.id = d.profile_id and doctor_profile.role = 'doctor'
join public.messages m on ((m.sender_id = a.patient_id and m.receiver_id = d.profile_id)
                        or (m.sender_id = d.profile_id and m.receiver_id = a.patient_id))
where (m.sender_id = a.patient_id and m.receiver_id = d.profile_id)
   or (m.sender_id = d.profile_id and m.receiver_id = a.patient_id)
on conflict (patient_id, doctor_id) do update
set last_message_at = greatest(public.conversations.last_message_at, excluded.last_message_at);

update public.messages m
set conversation_id = c.id,
    read_at = case when m.is_read then coalesce(m.read_at, m.created_at) else null end
from public.conversations c
join public.doctors d on d.id = c.doctor_id
where ((m.sender_id = c.patient_id and m.receiver_id = d.profile_id)
    or (m.sender_id = d.profile_id and m.receiver_id = c.patient_id))
  and m.conversation_id is null;

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

drop policy if exists "participants read messages" on public.messages;
drop policy if exists "send own messages" on public.messages;
drop policy if exists "recipient marks own messages read" on public.messages;
drop policy if exists "conversation participants read conversations" on public.conversations;
drop policy if exists "conversation participants read messages" on public.messages;

create or replace function public.is_conversation_participant(p_conversation_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.conversations c
    join public.doctors d on d.id = c.doctor_id
    where c.id = p_conversation_id
      and (c.patient_id = auth.uid() or d.profile_id = auth.uid())
  );
$$;

create policy "conversation participants read conversations"
on public.conversations for select to authenticated
using (patient_id = auth.uid() or public.is_own_doctor(doctor_id));

create policy "conversation participants read messages"
on public.messages for select to authenticated
using (conversation_id is not null and public.is_conversation_participant(conversation_id));

-- Conversation creation is limited to an existing care relationship recorded
-- by appointments. The unique patient/doctor key prevents duplicate threads.
create or replace function public.open_care_conversation(p_doctor_id uuid, p_patient_id uuid default null)
returns public.conversations
language plpgsql security definer set search_path = public as $$
declare
  v_patient_id uuid;
  v_conversation public.conversations;
  v_role public.user_role;
begin
  select role into v_role from public.profiles where id = auth.uid();
  if v_role = 'patient' then
    v_patient_id := auth.uid();
    if p_patient_id is not null and p_patient_id <> v_patient_id then raise exception 'No autorizado'; end if;
  elsif v_role = 'doctor' then
    v_patient_id := p_patient_id;
    if not public.is_own_doctor(p_doctor_id) then raise exception 'No autorizado'; end if;
    if v_patient_id is null then raise exception 'Se requiere un paciente relacionado'; end if;
  else
    raise exception 'Solo pacientes y médicos pueden abrir conversaciones';
  end if;

  if not exists (
    select 1 from public.appointments a
    join public.profiles p on p.id = a.patient_id and p.role = 'patient'
    join public.doctors d on d.id = a.doctor_id
    join public.profiles dp on dp.id = d.profile_id and dp.role = 'doctor'
    where a.patient_id = v_patient_id and a.doctor_id = p_doctor_id
  ) then raise exception 'La conversación requiere una relación de atención existente'; end if;

  insert into public.conversations(patient_id, doctor_id)
  values (v_patient_id, p_doctor_id)
  on conflict (patient_id, doctor_id) do nothing;
  select * into v_conversation from public.conversations
  where patient_id = v_patient_id and doctor_id = p_doctor_id;
  return v_conversation;
end; $$;

create or replace function public.send_conversation_message(
  p_conversation_id uuid,
  p_content text,
  p_message_type text default 'text',
  p_attachment_path text default null
) returns public.messages
language plpgsql security definer set search_path = public, storage as $$
declare
  v_conversation public.conversations;
  v_doctor_profile_id uuid;
  v_receiver_id uuid;
  v_message public.messages;
  v_appointment_id uuid;
begin
  select * into v_conversation from public.conversations where id = p_conversation_id;
  if not found then raise exception 'Conversación no encontrada'; end if;
  select profile_id into v_doctor_profile_id from public.doctors where id = v_conversation.doctor_id;
  if auth.uid() = v_conversation.patient_id then v_receiver_id := v_doctor_profile_id;
  elsif auth.uid() = v_doctor_profile_id then v_receiver_id := v_conversation.patient_id;
  else raise exception 'No autorizado'; end if;

  if p_message_type not in ('text', 'image', 'document') then raise exception 'Tipo de mensaje inválido'; end if;
  if p_message_type = 'text' then
    if p_attachment_path is not null or char_length(trim(coalesce(p_content, ''))) not between 1 and 4000 then
      raise exception 'El mensaje debe contener entre 1 y 4000 caracteres';
    end if;
  else
    if p_attachment_path is null or p_attachment_path not like p_conversation_id::text || '/' || auth.uid()::text || '/%' then
      raise exception 'Adjunto no válido para esta conversación';
    end if;
    if not exists (select 1 from storage.objects o where o.bucket_id = 'clinical-messages' and o.name = p_attachment_path) then
      raise exception 'Adjunto no encontrado';
    end if;
    if char_length(trim(coalesce(p_content, ''))) > 1000 then raise exception 'Descripción demasiado extensa'; end if;
  end if;

  select id into v_appointment_id from public.appointments
  where patient_id = v_conversation.patient_id and doctor_id = v_conversation.doctor_id
  order by created_at desc limit 1;

  insert into public.messages(conversation_id, sender_id, receiver_id, appointment_id, content, message_type, attachment_path)
  values (p_conversation_id, auth.uid(), v_receiver_id, v_appointment_id,
    case when p_message_type = 'text' then trim(p_content) else coalesce(nullif(trim(p_content), ''), 'Adjunto') end,
    p_message_type, p_attachment_path)
  returning * into v_message;
  return v_message;
end; $$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if not public.is_conversation_participant(p_conversation_id) then raise exception 'No autorizado'; end if;
  update public.messages set is_read = true, read_at = now()
  where conversation_id = p_conversation_id and receiver_id = auth.uid() and not is_read;
  get diagnostics v_count = row_count;
  return v_count;
end; $$;

create or replace function public.get_my_conversations()
returns table (
  conversation_id uuid,
  counterpart_id uuid,
  counterpart_name text,
  counterpart_avatar text,
  specialty text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql stable security definer set search_path = public as $$
  select c.id,
    case when c.patient_id = auth.uid() then d.profile_id else c.patient_id end,
    case when c.patient_id = auth.uid() then dp.full_name else pp.full_name end,
    case when c.patient_id = auth.uid() then dp.avatar_url else pp.avatar_url end,
    s.name,
    lm.content,
    coalesce(lm.created_at, c.last_message_at, c.created_at),
    (select count(*) from public.messages um where um.conversation_id = c.id and um.receiver_id = auth.uid() and not um.is_read)
  from public.conversations c
  join public.doctors d on d.id = c.doctor_id
  join public.profiles dp on dp.id = d.profile_id
  join public.profiles pp on pp.id = c.patient_id
  left join public.specialties s on s.id = d.specialty_id
  left join lateral (
    select m.content, m.created_at from public.messages m
    where m.conversation_id = c.id order by m.created_at desc limit 1
  ) lm on true
  where c.patient_id = auth.uid() or d.profile_id = auth.uid()
  order by coalesce(lm.created_at, c.last_message_at, c.created_at) desc;
$$;

create or replace function public.touch_conversation_after_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at, updated_at = new.created_at where id = new.conversation_id;
  return new;
end; $$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
for each row when (new.conversation_id is not null) execute function public.touch_conversation_after_message();

revoke all on function public.is_conversation_participant(uuid) from public;
revoke all on function public.open_care_conversation(uuid, uuid) from public;
revoke all on function public.send_conversation_message(uuid, text, text, text) from public;
revoke all on function public.mark_conversation_read(uuid) from public;
revoke all on function public.get_my_conversations() from public;
grant execute on function public.is_conversation_participant(uuid) to authenticated;
grant execute on function public.open_care_conversation(uuid, uuid) to authenticated;
grant execute on function public.send_conversation_message(uuid, text, text, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
grant execute on function public.get_my_conversations() to authenticated;

revoke insert, update, delete on public.messages from authenticated;
revoke insert, update, delete on public.messages from anon;
revoke insert, update, delete on public.conversations from anon, authenticated;
grant select on public.messages to authenticated;
grant select on public.conversations to authenticated;

-- Private files are future-ready for chat attachments; paths are scoped as
-- {conversation_id}/{uploader_profile_id}/{file_name} and signed URLs are used.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('clinical-messages', 'clinical-messages', false, 10485760,
  array['image/jpeg','image/png','image/webp','application/pdf',
        'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "conversation members upload attachments" on storage.objects;
drop policy if exists "conversation members read attachments" on storage.objects;
drop policy if exists "conversation members clean own uploads" on storage.objects;
create policy "conversation members upload attachments" on storage.objects for insert to authenticated
with check (bucket_id = 'clinical-messages'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));
create policy "conversation members read attachments" on storage.objects for select to authenticated
using (bucket_id = 'clinical-messages'
  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));
create policy "conversation members clean own uploads" on storage.objects for delete to authenticated
using (bucket_id = 'clinical-messages'
  and (storage.foldername(name))[2] = auth.uid()::text
  and public.is_conversation_participant(((storage.foldername(name))[1])::uuid));

do $$ begin
  alter publication supabase_realtime add table public.conversations;
exception when duplicate_object then null;
end $$;
