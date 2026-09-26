-- ============================================================
-- Tracto: Formulários + CRM de leads
-- Rode este arquivo inteiro no Supabase: SQL Editor > New query > Run.
-- Pode rodar de novo sem perder dados (é idempotente).
-- ============================================================


-- ============ EQUIPE ============
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  nome        text not null,
  email       text not null,
  ativo       boolean not null default false
);

-- O primeiro usuário criado vira ativo automaticamente. Os próximos entram
-- inativos e precisam ser liberados por alguém da equipe (CRM > Ajustes > Equipe).
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, nome, email, ativo)
  values (
    new.id,
    coalesce(nullif(new.raw_user_meta_data->>'nome', ''), split_part(new.email, '@', 1)),
    new.email,
    not exists (select 1 from public.profiles where ativo)
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

-- usuários que já existiam antes do schema
insert into public.profiles (id, nome, email, ativo)
select u.id, split_part(u.email, '@', 1), u.email, false from auth.users u
on conflict (id) do nothing;
update public.profiles set ativo = true
where id = (select id from public.profiles order by created_at limit 1)
  and not exists (select 1 from public.profiles where ativo);

create or replace function public.is_team() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and ativo);
$$;

-- ============ ESTÁGIOS ============
create table if not exists public.stages (
  id        uuid primary key default gen_random_uuid(),
  name      text not null check (char_length(name) between 1 and 40),
  color     text not null default '#FFAD00',
  position  int  not null default 0,
  kind      text not null default 'open' check (kind in ('open', 'won', 'lost'))
);

insert into public.stages (name, color, position, kind)
select * from (values
  ('Em análise',        '#6AA8FF', 0, 'open'),
  ('Contato realizado', '#B58CFF', 1, 'open'),
  ('Ligação',           '#4FD1C5', 2, 'open'),
  ('Qualificado',       '#FFAD00', 3, 'open'),
  ('Reunião agendada',  '#FF8A3D', 4, 'open'),
  ('Venda realizada',   '#3DDC84', 5, 'won'),
  ('Perdido',           '#6B6B6B', 6, 'lost')
) v(name, color, position, kind)
where not exists (select 1 from public.stages);

-- ============ RÓTULOS ============
create table if not exists public.labels (
  id     uuid primary key default gen_random_uuid(),
  name   text not null unique check (char_length(name) between 1 and 30),
  color  text not null default '#FFAD00'
);

-- ============ LEADS ============
create table if not exists public.leads (
  id               uuid primary key default gen_random_uuid(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_activity_at timestamptz not null default now(),

  form_id          text not null default 'manual',
  form_name        text,
  answers          jsonb not null default '[]'::jsonb,   -- [{id, label, value}] na ordem respondida

  nome             text not null check (char_length(nome) between 2 and 120),
  whatsapp         text check (whatsapp is null or char_length(whatsapp) between 10 and 20),
  email            text check (email is null or char_length(email) <= 160),
  instagram        text check (instagram is null or char_length(instagram) <= 60),
  faturamento      text,

  stage_id         uuid references public.stages(id) on delete set null,
  assigned_to      uuid references public.profiles(id) on delete set null,
  label_ids        uuid[] not null default '{}',
  valor            numeric(12,2),
  reminder_at      timestamptz,
  reminder_note    text,

  source           text not null default 'organico' check (source in ('pago', 'organico', 'manual')),
  utm_source       text,
  utm_medium       text,
  utm_campaign     text,
  utm_content      text,
  utm_term         text,
  fbclid           text,
  referrer         text,
  user_agent       text,
  session_id       text
);

create index if not exists leads_created_idx on public.leads (created_at desc);
create index if not exists leads_stage_idx on public.leads (stage_id);
create index if not exists leads_whatsapp_idx on public.leads (whatsapp);

-- ============ HISTÓRICO / NOTAS ============
create table if not exists public.lead_activity (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  created_at  timestamptz not null default now(),
  author_id   uuid references public.profiles(id) on delete set null,
  author_name text,
  type        text not null check (type in ('created', 'note', 'stage', 'assign', 'label', 'reminder', 'edit')),
  body        text not null check (char_length(body) between 1 and 1000)
);
create index if not exists lead_activity_idx on public.lead_activity (lead_id, created_at desc);

-- ============ EVENTOS DO FORM (analytics / abandono) ============
create table if not exists public.form_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  form_id     text not null check (char_length(form_id) <= 40),
  session_id  text not null check (char_length(session_id) <= 40),
  event       text not null check (event in ('view', 'start', 'step', 'submit')),
  step_id     text check (char_length(step_id) <= 40),
  utm_source  text check (char_length(utm_source) <= 100),
  utm_campaign text check (char_length(utm_campaign) <= 150)
);
create index if not exists form_events_idx on public.form_events (form_id, created_at desc);

-- ============ TRIGGERS DE HISTÓRICO ============
create or replace function public.author_name() returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select nome from public.profiles where id = auth.uid()), 'Sistema');
$$;

create or replace function public.leads_before_update() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  new.last_activity_at = now();
  return new;
end $$;

drop trigger if exists leads_before_update on public.leads;
create trigger leads_before_update before update on public.leads
for each row execute function public.leads_before_update();

create or replace function public.leads_log_changes() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  who text := public.author_name();
begin
  if tg_op = 'INSERT' then
    insert into lead_activity (lead_id, author_id, author_name, type, body)
    values (new.id, auth.uid(), who, 'created',
      case when new.form_id = 'manual' then 'Lead criado manualmente'
           else 'Formulário preenchido: ' || coalesce(new.form_name, new.form_id) end);
    return new;
  end if;

  if new.stage_id is distinct from old.stage_id then
    insert into lead_activity (lead_id, author_id, author_name, type, body)
    values (new.id, auth.uid(), who, 'stage',
      'Estágio: ' || coalesce((select name from stages where id = old.stage_id), 'sem estágio')
      || ' → ' || coalesce((select name from stages where id = new.stage_id), 'sem estágio'));
  end if;

  if new.assigned_to is distinct from old.assigned_to then
    insert into lead_activity (lead_id, author_id, author_name, type, body)
    values (new.id, auth.uid(), who, 'assign',
      'Atribuído a ' || coalesce((select nome from profiles where id = new.assigned_to), 'ninguém'));
  end if;

  if new.reminder_at is distinct from old.reminder_at then
    insert into lead_activity (lead_id, author_id, author_name, type, body)
    values (new.id, auth.uid(), who, 'reminder',
      case when new.reminder_at is null then 'Lembrete removido'
           else 'Lembrete para ' || to_char(new.reminder_at at time zone 'America/Sao_Paulo', 'DD/MM/YYYY HH24:MI') end);
  end if;
  return new;
end $$;

drop trigger if exists leads_log_changes on public.leads;
create trigger leads_log_changes after insert or update on public.leads
for each row execute function public.leads_log_changes();

create or replace function public.activity_touch_lead() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'note' then
    update leads set last_activity_at = now() where id = new.lead_id;
  end if;
  return new;
end $$;

drop trigger if exists activity_touch_lead on public.lead_activity;
create trigger activity_touch_lead after insert on public.lead_activity
for each row execute function public.activity_touch_lead();

create or replace function public.labels_cleanup() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update leads set label_ids = array_remove(label_ids, old.id) where old.id = any(label_ids);
  return old;
end $$;

drop trigger if exists labels_cleanup on public.labels;
create trigger labels_cleanup after delete on public.labels
for each row execute function public.labels_cleanup();

-- ============ RPC PÚBLICA: envio do formulário ============
-- Único jeito do visitante (anon) gravar um lead. Valida e normaliza no servidor.
create or replace function public.submit_lead(p jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_nome   text := left(btrim(p->>'nome'), 120);
  v_wpp    text := regexp_replace(coalesce(p->>'whatsapp', ''), '\D', '', 'g');
  v_email  text := nullif(lower(btrim(p->>'email')), '');
  v_insta  text := nullif(lower(regexp_replace(coalesce(p->>'instagram', ''), '[@\s]', '', 'g')), '');
  v_medium text := lower(coalesce(p->>'utm_medium', ''));
  v_id     uuid;
begin
  if v_nome is null or char_length(v_nome) < 2 then raise exception 'nome obrigatório'; end if;
  if char_length(v_wpp) < 10 or char_length(v_wpp) > 15 then raise exception 'whatsapp inválido'; end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then v_email := null; end if;
  if jsonb_typeof(p->'answers') <> 'array' or pg_column_size(p->'answers') > 20000 then raise exception 'respostas inválidas'; end if;

  -- reenvio do mesmo WhatsApp no mesmo form em 10 min: atualiza em vez de duplicar
  select id into v_id from leads
  where whatsapp = v_wpp and form_id = p->>'form_id' and created_at > now() - interval '10 minutes'
  order by created_at desc limit 1;

  if v_id is not null then
    update leads set answers = p->'answers', nome = v_nome, email = coalesce(v_email, email),
      instagram = coalesce(v_insta, instagram), faturamento = coalesce(p->>'faturamento', faturamento)
    where id = v_id;
    return v_id;
  end if;

  insert into leads (form_id, form_name, answers, nome, whatsapp, email, instagram, faturamento,
    stage_id, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, referrer, user_agent, session_id)
  values (
    left(coalesce(p->>'form_id', 'desconhecido'), 40), left(p->>'form_name', 120), p->'answers',
    v_nome, v_wpp, v_email, left(v_insta, 60), left(p->>'faturamento', 60),
    (select id from stages where kind = 'open' order by position limit 1),
    case when nullif(p->>'fbclid', '') is not null or nullif(p->>'gclid', '') is not null
           or v_medium in ('cpc', 'ppc', 'paid', 'paid_social', 'ads', 'ad', 'pago') then 'pago' else 'organico' end,
    left(p->>'utm_source', 100), left(p->>'utm_medium', 100), left(p->>'utm_campaign', 150),
    left(p->>'utm_content', 150), left(p->>'utm_term', 150), left(p->>'fbclid', 300),
    left(p->>'referrer', 300), left(p->>'user_agent', 300), left(p->>'session_id', 40)
  )
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.submit_lead(jsonb) from public;
grant execute on function public.submit_lead(jsonb) to anon, authenticated;

-- ============ RLS ============
alter table public.profiles      enable row level security;
alter table public.stages        enable row level security;
alter table public.labels        enable row level security;
alter table public.leads         enable row level security;
alter table public.lead_activity enable row level security;
alter table public.form_events   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['stages', 'labels', 'leads', 'lead_activity'] loop
    execute format('drop policy if exists "equipe" on public.%I', t);
    execute format('create policy "equipe" on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
  end loop;
end $$;

drop policy if exists "equipe le perfis" on public.profiles;
create policy "equipe le perfis" on public.profiles
  for select to authenticated using (public.is_team() or id = auth.uid());
drop policy if exists "equipe edita perfis" on public.profiles;
create policy "equipe edita perfis" on public.profiles
  for update to authenticated using (public.is_team()) with check (public.is_team());

-- visitante só registra eventos do form; equipe lê
drop policy if exists "anon registra evento" on public.form_events;
create policy "anon registra evento" on public.form_events
  for insert to anon, authenticated with check (true);
drop policy if exists "equipe le eventos" on public.form_events;
create policy "equipe le eventos" on public.form_events
  for select to authenticated using (public.is_team());

-- ============ REALTIME ============
do $$
begin
  alter publication supabase_realtime add table public.leads;
exception when duplicate_object then null;
end $$;
