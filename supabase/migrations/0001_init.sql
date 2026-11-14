-- Grace AI — initial schema (Supabase / Postgres)
-- Apply with: npm run db:push   (uses POSTGRES_URL)
-- Everything is written through the server; RLS denies direct client access.

-- gen_random_uuid() is built into Postgres 13+; pgcrypto is only needed on
-- older clusters, and Supabase always has it available.
do $$
begin
  begin
    create extension if not exists pgcrypto;
  exception when others then null;
  end;
end $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table if not exists grace_users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique,
  name          text not null default '',
  password_hash text,
  is_admin      boolean not null default false,
  -- Owner accounts skip credit checks and charging entirely.
  unlimited     boolean not null default false,
  plan          text not null default 'free',
  credits       integer not null default 250,
  effort        integer not null default 0,
  provider      text not null default 'openrouter',
  model         text,
  show_credit_percentage boolean not null default true,
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now()
);

create table if not exists grace_sessions (
  token_hash text primary key,
  user_id    uuid not null references grace_users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists grace_sessions_user_idx on grace_sessions(user_id);

-- ---------------------------------------------------------------------------
-- Conversations
-- ---------------------------------------------------------------------------
create table if not exists grace_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references grace_users(id) on delete cascade,
  title      text not null default 'New chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists grace_conversations_user_idx
  on grace_conversations(user_id, updated_at desc);

create table if not exists grace_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references grace_conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null default '',
  model_id        text,
  model_name      text,
  provider        text,
  effort          integer,
  credits         integer not null default 0,
  attachments     jsonb not null default '[]'::jsonb,
  error           boolean not null default false,
  created_at      timestamptz not null default now()
);
create index if not exists grace_messages_conversation_idx
  on grace_messages(conversation_id, created_at);

-- ---------------------------------------------------------------------------
-- Usage and credits
-- ---------------------------------------------------------------------------
create table if not exists grace_usage (
  user_id      uuid not null references grace_users(id) on delete cascade,
  period_start date not null,
  credits_used integer not null default 0,
  requests     integer not null default 0,
  primary key (user_id, period_start)
);

-- Monthly allowance per plan, in credits. Apex is the paid tier.
-- Owners are marked unlimited in grace_users and ignore these allowances.
create table if not exists grace_plans (
  id            text primary key,
  name          text not null,
  monthly_credits integer not null,
  price_label   text not null default '',
  perks         jsonb not null default '[]'::jsonb
);

insert into grace_plans (id, name, monthly_credits, price_label, perks) values
  ('free', 'Free', 250, '$0', '["250 credits each month", "All effort levels", "Every connected model"]'),
  ('apex', 'Apex', 3000, '$20 / month', '["3,000 credits each month", "Priority routing", "Deep Research included"]'),
  ('apex-pro', 'Apex Pro', 12000, '$60 / month', '["12,000 credits each month", "Highest effort by default", "Priority support"]')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Attachments (files, photos, extracted documents)
-- ---------------------------------------------------------------------------
create table if not exists grace_files (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references grace_users(id) on delete cascade,
  conversation_id uuid references grace_conversations(id) on delete cascade,
  name            text not null,
  mime            text not null default 'text/plain',
  size            integer not null default 0,
  data_url        text,
  extracted_text  text,
  created_at      timestamptz not null default now()
);
create index if not exists grace_files_user_idx on grace_files(user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Provider keys added from the admin console (env vars still win)
-- ---------------------------------------------------------------------------
create table if not exists grace_provider_keys (
  provider   text primary key,
  api_key    text not null,
  enabled    boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lock it down. The app talks to Postgres with the service role / direct
-- connection; the anon and authenticated roles get nothing.
-- ---------------------------------------------------------------------------
alter table grace_users            enable row level security;
alter table grace_sessions         enable row level security;
alter table grace_conversations    enable row level security;
alter table grace_messages         enable row level security;
alter table grace_usage            enable row level security;
alter table grace_plans            enable row level security;
alter table grace_files            enable row level security;
alter table grace_provider_keys    enable row level security;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on all tables in schema public from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke all on all tables in schema public from authenticated;
  end if;
end $$;
