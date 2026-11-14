-- Grace Code: projects, their files, and the conversation with the agent.
--
-- A project is the boundary the coding agent may touch. Files are stored as
-- text rather than on a filesystem because the agent has to read them all into
-- a prompt anyway, and because a serverless function has no durable disk.
create table if not exists grace_code_projects (
  id           uuid primary key,
  user_id      uuid not null references grace_users(id) on delete cascade,
  name         text not null,
  language     text not null default 'javascript',
  instructions text not null default '',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists grace_code_projects_user_idx
  on grace_code_projects (user_id, updated_at desc);

create table if not exists grace_code_files (
  project_id uuid not null references grace_code_projects(id) on delete cascade,
  path       text not null,
  content    text not null default '',
  updated_at timestamptz not null default now(),
  primary key (project_id, path)
);

create table if not exists grace_code_messages (
  id         uuid primary key,
  project_id uuid not null references grace_code_projects(id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  -- Paths the agent changed in this turn, so the transcript can show them.
  touched    text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists grace_code_messages_project_idx
  on grace_code_messages (project_id, created_at);

alter table grace_code_projects enable row level security;
alter table grace_code_files enable row level security;
alter table grace_code_messages enable row level security;

comment on table grace_code_projects is
  'Grace Code projects. The agent reads and writes only inside one project.';
