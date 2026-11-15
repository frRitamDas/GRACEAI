-- Projects, memory and upcoming notices.
--
-- The desktop shell adds three surfaces that need a place to live:
--
--   * sharing on a Grace Code project, so "/projects" can filter between what
--     you created and what a teammate shared with you;
--   * saved memories, which the chat route attaches to the system prompt;
--   * per-user dismissals of the Upcoming notices.
--
-- All three are additive. Nothing is backfilled; a user without rows behaves
-- exactly as before.

-- ------------------------------------------------------------------ projects
alter table grace_code_projects add column if not exists created_by uuid references grace_users(id) on delete set null;
alter table grace_code_projects add column if not exists shared_with uuid[] not null default '{}';
alter table grace_code_projects add column if not exists visibility text not null default 'private';

comment on column grace_code_projects.created_by is
  'Author of the project. Null for rows created before sharing existed; the owner id is the fallback.';
comment on column grace_code_projects.shared_with is
  'User ids this project was shared with, read-only for them.';

create index if not exists grace_code_projects_shared_idx
  on grace_code_projects using gin (shared_with);

-- ------------------------------------------------------------------- memory
create table if not exists grace_memories (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references grace_users(id) on delete cascade,
  body       text not null,
  created_at timestamptz not null default now()
);

alter table grace_memories enable row level security;

comment on table grace_memories is
  'Facts the user asked Grace to remember. Read server-side into the chat system prompt; service-role only.';

create index if not exists grace_memories_user_idx
  on grace_memories (user_id, created_at desc);

-- ---------------------------------------------------------------- dismissals
create table if not exists grace_dismissals (
  user_id    uuid not null references grace_users(id) on delete cascade,
  notice_id  text not null,
  dismissed_at timestamptz not null default now(),
  primary key (user_id, notice_id)
);

alter table grace_dismissals enable row level security;

comment on table grace_dismissals is
  'Which Upcoming notices a user has cleared. Service-role only.';
