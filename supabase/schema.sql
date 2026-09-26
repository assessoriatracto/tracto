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

  source           text not null default 'organico',
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

-- colunas de rastreamento (Meta Pixel / Conversions API) e origem via API
alter table public.leads add column if not exists fbp text;
alter table public.leads add column if not exists fbc text;
alter table public.leads add column if not exists client_ip text;
alter table public.leads add column if not exists event_source_url text;
alter table public.leads add column if not exists lead_event_id text;
alter table public.leads add column if not exists estado text;
alter table public.leads add column if not exists cidade text;
alter table public.leads add column if not exists meta_lead_id text;
alter table public.leads drop constraint if exists leads_source_check;
alter table public.leads add constraint leads_source_check check (source in ('pago', 'organico', 'manual', 'api'));

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
  v_hdrs   json;
  v_ip     text;
  v_id     uuid;
begin
  if v_nome is null or char_length(v_nome) < 2 then raise exception 'nome obrigatório'; end if;
  if char_length(v_wpp) < 10 or char_length(v_wpp) > 15 then raise exception 'whatsapp inválido'; end if;
  if v_email is not null and v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then v_email := null; end if;
  if jsonb_typeof(coalesce(p->'answers', '[]'::jsonb)) <> 'array' or pg_column_size(p->'answers') > 20000 then raise exception 'respostas inválidas'; end if;

  -- IP do visitante (Supabase repassa os headers da requisição)
  begin v_hdrs := nullif(current_setting('request.headers', true), '')::json; exception when others then v_hdrs := null; end;
  v_ip := btrim(split_part(coalesce(v_hdrs->>'cf-connecting-ip', v_hdrs->>'x-real-ip', v_hdrs->>'x-forwarded-for', ''), ',', 1));

  -- reenvio do mesmo WhatsApp no mesmo form em 10 min: atualiza em vez de duplicar
  select id into v_id from leads
  where whatsapp = v_wpp and form_id = p->>'form_id' and created_at > now() - interval '10 minutes'
  order by created_at desc limit 1;

  if v_id is not null then
    update leads set answers = coalesce(p->'answers', answers), nome = v_nome, email = coalesce(v_email, email),
      instagram = coalesce(v_insta, instagram), faturamento = coalesce(p->>'faturamento', faturamento)
    where id = v_id;
    return v_id;
  end if;

  insert into leads (form_id, form_name, answers, nome, whatsapp, email, instagram, faturamento, estado, cidade,
    stage_id, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, fbclid, referrer, user_agent, session_id,
    fbp, fbc, client_ip, event_source_url, lead_event_id, meta_lead_id)
  values (
    left(coalesce(p->>'form_id', 'desconhecido'), 40), left(p->>'form_name', 120), coalesce(p->'answers', '[]'::jsonb),
    v_nome, v_wpp, v_email, left(v_insta, 60), left(p->>'faturamento', 60), left(upper(p->>'estado'), 2), left(p->>'cidade', 80),
    (select id from stages where kind = 'open' order by position limit 1),
    case when nullif(p->>'fbclid', '') is not null or nullif(p->>'fbc', '') is not null or nullif(p->>'gclid', '') is not null
           or v_medium in ('cpc', 'ppc', 'paid', 'paid_social', 'ads', 'ad', 'pago') then 'pago' else 'organico' end,
    left(p->>'utm_source', 100), left(p->>'utm_medium', 100), left(p->>'utm_campaign', 150),
    left(p->>'utm_content', 150), left(p->>'utm_term', 150), left(p->>'fbclid', 300),
    left(p->>'referrer', 300), left(p->>'user_agent', 300), left(p->>'session_id', 40),
    left(p->>'fbp', 120), left(p->>'fbc', 400), nullif(left(v_ip, 60), ''), left(p->>'event_source_url', 500),
    left(coalesce(nullif(p->>'lead_event_id', ''), gen_random_uuid()::text), 60), left(p->>'meta_lead_id', 40)
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

-- ============================================================
-- INTEGRAÇÕES: API, webhooks e Meta Conversions API
-- Os envios saem do próprio banco via pg_net (assíncrono, não atrasa o form).
-- ============================================================
do $$ begin create extension if not exists pg_net; exception when others then raise notice 'pg_net indisponível: %', sqlerrm; end $$;

-- HMAC-SHA256 com funções nativas (assinatura dos webhooks)
create or replace function public.hmac_sha256(msg text, key text) returns text
language plpgsql immutable as $$
declare
  k bytea := convert_to(key, 'UTF8');
  ipad bytea; opad bytea; i int;
begin
  if length(k) > 64 then k := sha256(k); end if;
  k := k || decode(repeat('00', 64 - length(k)), 'hex');
  ipad := k; opad := k;
  for i in 0..63 loop
    ipad := set_byte(ipad, i, get_byte(k, i) # 54);
    opad := set_byte(opad, i, get_byte(k, i) # 92);
  end loop;
  return encode(sha256(opad || sha256(ipad || convert_to(msg, 'UTF8'))), 'hex');
end $$;

-- normaliza e faz hash SHA-256 (padrão Meta: minúsculo, sem espaços nas pontas)
create or replace function public.meta_hash(v text) returns text
language sql immutable as $$
  select case when nullif(btrim(v), '') is null then null
    else encode(sha256(convert_to(lower(btrim(v)), 'UTF8')), 'hex') end;
$$;

-- ---------- estágios → eventos da Meta ----------
alter table public.stages add column if not exists meta_event text;
alter table public.stages add column if not exists meta_value text not null default 'none';
alter table public.stages drop constraint if exists stages_meta_value_check;
alter table public.stages add constraint stages_meta_value_check check (meta_value in ('none', 'lead', 'contract'));

-- ---------- configuração do pixel / CAPI (linha única) ----------
create table if not exists public.tracking_settings (
  id              int primary key default 1 check (id = 1),
  enabled         boolean not null default false,
  pixel_ids       text[] not null default '{1357841419671798,2142406153298000}',
  access_token    text,
  test_event_code text,
  api_version     text not null default 'v21.0',
  send_lead       boolean not null default true,
  currency        text not null default 'BRL',
  contract_months int not null default 12 check (contract_months between 1 and 60),
  lead_values     jsonb not null default '{"Menos de R$15.000": 50, "De R$15.000 a R$30.000": 100, "De R$30.000 a R$50.000": 200, "De R$50.000 a R$100.000": 400, "Acima de R$100.000": 800}',
  updated_at      timestamptz not null default now()
);

-- mapeamento padrão só na primeira instalação
do $$ begin
  if not exists (select 1 from public.tracking_settings) then
    update public.stages set meta_event = 'Contact' where name = 'Contato realizado';
    update public.stages set meta_event = 'LeadQualificado', meta_value = 'lead' where name = 'Qualificado';
    update public.stages set meta_event = 'Schedule', meta_value = 'lead' where name = 'Reunião agendada';
    update public.stages set meta_event = 'Purchase', meta_value = 'contract' where name = 'Venda realizada';
    insert into public.tracking_settings (id) values (1);
  end if;
end $$;

create table if not exists public.capi_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  lead_id     uuid references public.leads(id) on delete set null,
  pixel_id    text,
  event_name  text,
  event_id    text,
  test        boolean not null default false,
  request_id  bigint,
  status_code int,
  response    text,
  payload     jsonb
);
create index if not exists capi_events_idx on public.capi_events (created_at desc);
create index if not exists capi_events_lead_idx on public.capi_events (lead_id);

-- ---------- chaves de API ----------
create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  name         text not null check (char_length(name) between 1 and 60),
  prefix       text not null,
  key_hash     text not null unique,
  last_used_at timestamptz,
  revoked      boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null
);

-- ---------- webhooks de saída ----------
create table if not exists public.webhooks (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name       text not null check (char_length(name) between 1 and 60),
  url        text not null check (url ~ '^https?://'),
  events     text[] not null default '{lead.created}',
  secret     text not null default 'whsec_' || replace(gen_random_uuid()::text, '-', ''),
  active     boolean not null default true
);

create table if not exists public.webhook_deliveries (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  webhook_id  uuid references public.webhooks(id) on delete cascade,
  event       text not null,
  lead_id     uuid,
  payload     jsonb,
  request_id  bigint,
  status_code int,
  response    text
);
create index if not exists webhook_deliveries_idx on public.webhook_deliveries (created_at desc);

-- ---------- envio HTTP (pg_net) ----------
create or replace function public.http_post_json(p_url text, p_body jsonb, p_headers jsonb default '{}'::jsonb, p_params jsonb default '{}'::jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  execute 'select net.http_post(url := $1, body := $2, params := $3, headers := $4, timeout_milliseconds := 8000)'
    into v_id using p_url, p_body, p_params, jsonb_build_object('Content-Type', 'application/json') || p_headers;
  return v_id;
exception when others then
  raise warning 'http_post_json falhou: %', sqlerrm;
  return null;
end $$;

-- ---------- representação do lead para webhooks/API ----------
create or replace function public.lead_json(l public.leads) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_strip_nulls(jsonb_build_object(
    'id', l.id, 'criado_em', l.created_at, 'atualizado_em', l.updated_at,
    'nome', l.nome, 'whatsapp', l.whatsapp, 'email', l.email, 'instagram', l.instagram,
    'faturamento', l.faturamento, 'estado', l.estado, 'cidade', l.cidade, 'valor', l.valor,
    'estagio', (select jsonb_build_object('id', s.id, 'nome', s.name, 'tipo', s.kind) from stages s where s.id = l.stage_id),
    'responsavel', (select jsonb_build_object('id', p.id, 'nome', p.nome, 'email', p.email) from profiles p where p.id = l.assigned_to),
    'rotulos', (select jsonb_agg(x.name) from labels x where x.id = any(l.label_ids)),
    'formulario', jsonb_build_object('id', l.form_id, 'nome', l.form_name),
    'respostas', l.answers, 'fonte', l.source,
    'utm', jsonb_strip_nulls(jsonb_build_object('source', l.utm_source, 'medium', l.utm_medium, 'campaign', l.utm_campaign, 'content', l.utm_content, 'term', l.utm_term)),
    'lembrete', l.reminder_at
  ));
$$;

create or replace function public.webhook_fire(p_event text, p_lead_id uuid, p_data jsonb, p_only uuid default null) returns int
language plpgsql security definer set search_path = public as $$
declare
  w record; v_body jsonb; v_del bigint; v_req bigint; n int := 0;
begin
  for w in select * from webhooks where active and (p_only is not null and id = p_only or p_only is null and p_event = any(events)) loop
    insert into webhook_deliveries (webhook_id, event, lead_id) values (w.id, p_event, p_lead_id) returning id into v_del;
    v_body := jsonb_build_object('id', v_del, 'evento', p_event, 'enviado_em', now(), 'dados', p_data);
    v_req := http_post_json(w.url, v_body, jsonb_build_object(
      'X-Tracto-Event', p_event,
      'X-Tracto-Delivery', v_del::text,
      'X-Tracto-Signature', 'sha256=' || hmac_sha256(v_body::text, w.secret),
      'User-Agent', 'Tracto-Webhooks/1.0'));
    update webhook_deliveries set payload = v_body, request_id = v_req, response = case when v_req is null then 'pg_net indisponível' end where id = v_del;
    n := n + 1;
  end loop;
  return n;
end $$;

-- ---------- Meta Conversions API ----------
create or replace function public.capi_send(p_lead_id uuid, p_event text, p_event_id text, p_value numeric default null,
  p_action_source text default 'system_generated', p_test boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare
  cfg tracking_settings; l leads; st stages; v_px text; v_event jsonb; v_user jsonb; v_custom jsonb;
  v_body jsonb; v_req bigint; v_first text; v_last text; n int := 0; v_time bigint;
begin
  select * into cfg from tracking_settings where id = 1;
  if cfg is null or cfg.access_token is null or coalesce(array_length(cfg.pixel_ids, 1), 0) = 0 then return 0; end if;
  if not cfg.enabled and not p_test then return 0; end if;
  select * into l from leads where id = p_lead_id;
  if l is null then return 0; end if;
  select * into st from stages where id = l.stage_id;

  v_first := split_part(btrim(l.nome), ' ', 1);
  v_last := nullif(regexp_replace(btrim(l.nome), '^\S+\s*', ''), '');
  v_user := jsonb_strip_nulls(jsonb_build_object(
    'em', case when l.email is not null then jsonb_build_array(meta_hash(l.email)) end,
    'ph', case when l.whatsapp is not null then jsonb_build_array(meta_hash(regexp_replace(l.whatsapp, '\D', '', 'g'))) end,
    'fn', case when v_first <> '' then jsonb_build_array(meta_hash(v_first)) end,
    'ln', case when v_last is not null then jsonb_build_array(meta_hash(split_part(v_last, ' ', -1))) end,
    'st', case when l.estado is not null then jsonb_build_array(meta_hash(l.estado)) end,
    'ct', case when l.cidade is not null then jsonb_build_array(meta_hash(regexp_replace(l.cidade, '\s', '', 'g'))) end,
    'country', jsonb_build_array(meta_hash('br')),
    'external_id', jsonb_build_array(meta_hash(l.id::text)),
    'client_ip_address', l.client_ip,
    'client_user_agent', l.user_agent,
    'fbc', l.fbc,
    'fbp', l.fbp,
    'lead_id', case when l.meta_lead_id ~ '^\d+$' then l.meta_lead_id::numeric end
  ));
  v_custom := jsonb_strip_nulls(jsonb_build_object(
    'currency', cfg.currency,
    'value', p_value,
    'content_name', coalesce(l.form_name, l.form_id),
    'content_category', 'lead',
    'event_source', 'crm',
    'lead_event_source', 'Tracto CRM',
    'lead_stage', st.name,
    'faturamento', l.faturamento,
    'lead_score', (cfg.lead_values->>l.faturamento)::numeric,
    'fonte', l.source,
    'utm_source', l.utm_source, 'utm_medium', l.utm_medium, 'utm_campaign', l.utm_campaign, 'utm_content', l.utm_content
  ));
  -- Lead usa o horário real do envio do form; eventos do funil usam o horário da mudança
  v_time := floor(extract(epoch from case when p_event = 'Lead' then l.created_at else now() end))::bigint;
  v_event := jsonb_strip_nulls(jsonb_build_object(
    'event_name', p_event,
    'event_time', v_time,
    'event_id', p_event_id,
    'action_source', p_action_source,
    'event_source_url', case when p_action_source = 'website' then coalesce(l.event_source_url, 'https://assessoriatracto.com.br/aplicar/') end,
    'user_data', v_user,
    'custom_data', v_custom
  ));
  v_body := jsonb_strip_nulls(jsonb_build_object('data', jsonb_build_array(v_event),
    'test_event_code', case when p_test or cfg.test_event_code is not null then cfg.test_event_code end));

  foreach v_px in array cfg.pixel_ids loop
    -- não reenvia o mesmo evento pro mesmo pixel (dedup também acontece na Meta por event_id)
    if not p_test and exists (select 1 from capi_events where event_id = p_event_id and pixel_id = v_px and not test
                              and coalesce(status_code, 200) between 200 and 299) then continue; end if;
    v_req := http_post_json('https://graph.facebook.com/' || cfg.api_version || '/' || v_px || '/events', v_body, '{}'::jsonb,
                            jsonb_build_object('access_token', cfg.access_token));
    insert into capi_events (lead_id, pixel_id, event_name, event_id, test, request_id, payload, response)
    values (l.id, v_px, p_event, p_event_id, p_test, v_req, v_body, case when v_req is null then 'pg_net indisponível' end);
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.lead_value(l public.leads, p_mode text) returns numeric
language sql stable security definer set search_path = public as $$
  select case p_mode
    when 'lead' then (select (lead_values->>l.faturamento)::numeric from tracking_settings where id = 1)
    when 'contract' then l.valor * (select contract_months from tracking_settings where id = 1)
  end;
$$;

-- ---------- gatilho único: webhooks + CAPI ----------
create or replace function public.leads_integrations() returns trigger
language plpgsql security definer set search_path = public as $$
declare st stages; old_st stages; v_data jsonb;
begin
  begin
    if tg_op = 'DELETE' then
      perform webhook_fire('lead.deleted', old.id, jsonb_build_object('lead', lead_json(old)));
      return old;
    end if;
    v_data := jsonb_build_object('lead', lead_json(new));

    if tg_op = 'INSERT' then
      perform webhook_fire('lead.created', new.id, v_data);
      if new.form_id <> 'manual' and (select send_lead from tracking_settings where id = 1) then
        perform capi_send(new.id, 'Lead', coalesce(new.lead_event_id, new.id::text), lead_value(new, 'lead'),
          case when new.event_source_url is not null then 'website' else 'system_generated' end);
      end if;
      return new;
    end if;

    if new.stage_id is distinct from old.stage_id then
      select * into st from stages where id = new.stage_id;
      select * into old_st from stages where id = old.stage_id;
      v_data := v_data || jsonb_build_object('estagio_anterior', case when old_st.id is not null then jsonb_build_object('id', old_st.id, 'nome', old_st.name) end);
      perform webhook_fire('lead.stage_changed', new.id, v_data);
      if st.kind = 'won' then perform webhook_fire('lead.won', new.id, v_data); end if;
      if st.kind = 'lost' then perform webhook_fire('lead.lost', new.id, v_data); end if;
      if st.meta_event is not null then
        perform capi_send(new.id, st.meta_event, new.id::text || ':' || st.id::text, lead_value(new, st.meta_value));
      end if;
    end if;
    if new.assigned_to is distinct from old.assigned_to then perform webhook_fire('lead.assigned', new.id, v_data); end if;
    if (new.nome, new.whatsapp, new.email, new.instagram, new.faturamento, new.valor, new.label_ids)
       is distinct from (old.nome, old.whatsapp, old.email, old.instagram, old.faturamento, old.valor, old.label_ids) then
      perform webhook_fire('lead.updated', new.id, v_data);
    end if;
  exception when others then
    raise warning 'integrações falharam: %', sqlerrm;
  end;
  return null;
end $$;

drop trigger if exists leads_integrations on public.leads;
create trigger leads_integrations after insert or update or delete on public.leads
for each row execute function public.leads_integrations();

create or replace function public.activity_integrations() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.type = 'note' then
    begin
      perform webhook_fire('note.created', new.lead_id, jsonb_build_object('nota', jsonb_build_object('texto', new.body, 'autor', new.author_name, 'criada_em', new.created_at),
        'lead', (select lead_json(l) from leads l where l.id = new.lead_id)));
    exception when others then raise warning 'webhook de nota falhou: %', sqlerrm; end;
  end if;
  return new;
end $$;

drop trigger if exists activity_integrations on public.lead_activity;
create trigger activity_integrations after insert on public.lead_activity
for each row execute function public.activity_integrations();

-- ---------- RPCs da equipe ----------
create or replace function public.create_api_key(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare v_key text := 'trk_' || replace(gen_random_uuid()::text, '-', '') || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16);
begin
  if not is_team() then raise exception 'sem permissão'; end if;
  insert into api_keys (name, prefix, key_hash, created_by)
  values (left(btrim(p_name), 60), left(v_key, 12), encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), auth.uid());
  return v_key; -- mostrado uma única vez
end $$;

create or replace function public.webhook_test(p_id uuid) returns int
language plpgsql security definer set search_path = public as $$
declare l leads;
begin
  if not is_team() then raise exception 'sem permissão'; end if;
  select * into l from leads order by created_at desc limit 1;
  return webhook_fire('webhook.test', l.id, jsonb_build_object('teste', true, 'lead', case when l.id is not null then lead_json(l) end), p_id);
end $$;

create or replace function public.capi_test() returns int
language plpgsql security definer set search_path = public as $$
declare l leads;
begin
  if not is_team() then raise exception 'sem permissão'; end if;
  select * into l from leads where form_id <> 'manual' order by created_at desc limit 1;
  if l.id is null then raise exception 'crie ou receba ao menos um lead pra testar'; end if;
  return capi_send(l.id, 'Lead', 'teste-' || gen_random_uuid()::text, lead_value(l, 'lead'), 'website', true);
end $$;

-- lê as respostas HTTP que o pg_net recebeu e grava nos logs
create or replace function public.integrations_refresh() returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_team() then raise exception 'sem permissão'; end if;
  execute $q$
    update public.webhook_deliveries d set status_code = coalesce(r.status_code, 0), response = left(coalesce(r.error_msg, r.content::text), 500)
    from net._http_response r where r.id = d.request_id and d.status_code is null;
    update public.capi_events e set status_code = coalesce(r.status_code, 0), response = left(coalesce(r.error_msg, r.content::text), 800)
    from net._http_response r where r.id = e.request_id and e.status_code is null;
  $q$;
exception when undefined_table or invalid_schema_name then null;
end $$;

-- ---------- API pública (autenticada por chave trk_...) ----------
create or replace function public.api_key_check(p_key text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  update api_keys set last_used_at = now()
  where key_hash = encode(sha256(convert_to(coalesce(p_key, ''), 'UTF8')), 'hex') and not revoked
  returning id into v_id;
  if v_id is null then raise exception 'chave de API inválida' using errcode = '28000'; end if;
  return v_id;
end $$;

create or replace function public.api_create_lead(api_key text, lead jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_stage uuid; v_answers jsonb;
begin
  perform api_key_check(api_key);
  v_answers := coalesce(lead->'respostas', lead->'answers', '[]'::jsonb);
  v_id := submit_lead(lead || jsonb_build_object(
    'form_id', coalesce(lead->>'form_id', 'api'),
    'form_name', coalesce(lead->>'form_name', 'API'),
    'answers', v_answers));
  select id into v_stage from stages where lower(name) = lower(lead->>'estagio');
  update leads set source = case when source = 'organico' then 'api' else source end,
    stage_id = coalesce(v_stage, stage_id),
    valor = coalesce((lead->>'valor')::numeric, valor)
  where id = v_id;
  return jsonb_build_object('ok', true, 'id', v_id);
end $$;

create or replace function public.api_list_leads(api_key text, desde timestamptz default null, limite int default 100) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  perform api_key_check(api_key);
  return coalesce((select jsonb_agg(lead_json(l) order by l.created_at desc)
    from (select * from leads where desde is null or created_at >= desde order by created_at desc limit least(greatest(limite, 1), 500)) l), '[]'::jsonb);
end $$;

create or replace function public.api_update_lead(api_key text, lead_id uuid, dados jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_stage uuid; v_user uuid; l leads;
begin
  perform api_key_check(api_key);
  if not exists (select 1 from leads where id = lead_id) then raise exception 'lead não encontrado'; end if;
  if dados ? 'estagio' then
    select id into v_stage from stages where lower(name) = lower(dados->>'estagio');
    if v_stage is null then raise exception 'estágio "%" não existe', dados->>'estagio'; end if;
  end if;
  if dados ? 'responsavel_email' then select id into v_user from profiles where lower(email) = lower(dados->>'responsavel_email'); end if;
  update leads set
    stage_id = coalesce(v_stage, stage_id),
    assigned_to = case when dados ? 'responsavel_email' then v_user else assigned_to end,
    valor = case when dados ? 'valor' then (dados->>'valor')::numeric else valor end
  where id = lead_id
  returning * into l;
  if nullif(btrim(dados->>'nota'), '') is not null then
    insert into lead_activity (lead_id, type, body, author_name) values (lead_id, 'note', left(dados->>'nota', 1000), 'API');
  end if;
  return jsonb_build_object('ok', true, 'lead', lead_json(l));
end $$;

revoke all on function public.api_create_lead(text, jsonb) from public;
revoke all on function public.api_list_leads(text, timestamptz, int) from public;
revoke all on function public.api_update_lead(text, uuid, jsonb) from public;
grant execute on function public.api_create_lead(text, jsonb) to anon, authenticated;
grant execute on function public.api_list_leads(text, timestamptz, int) to anon, authenticated;
grant execute on function public.api_update_lead(text, uuid, jsonb) to anon, authenticated;
-- funções internas não ficam expostas como RPC
revoke all on function public.capi_send(uuid, text, text, numeric, text, boolean) from public, anon, authenticated;
revoke all on function public.webhook_fire(text, uuid, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.http_post_json(text, jsonb, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.api_key_check(text) from public, anon, authenticated;
revoke all on function public.lead_json(public.leads) from public, anon, authenticated;
revoke all on function public.lead_value(public.leads, text) from public, anon, authenticated;

-- ---------- RLS ----------
alter table public.tracking_settings  enable row level security;
alter table public.capi_events        enable row level security;
alter table public.api_keys           enable row level security;
alter table public.webhooks           enable row level security;
alter table public.webhook_deliveries enable row level security;
do $$
declare t text;
begin
  foreach t in array array['tracking_settings', 'capi_events', 'api_keys', 'webhooks', 'webhook_deliveries'] loop
    execute format('drop policy if exists "equipe" on public.%I', t);
    execute format('create policy "equipe" on public.%I for all to authenticated using (public.is_team()) with check (public.is_team())', t);
  end loop;
end $$;
