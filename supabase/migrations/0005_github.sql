-- GitHub connections, plus the repository a Grace Code project came from.
--
-- One row per user. The token is a credential and is readable only by the
-- service role: RLS is enabled with no policies, so the anon and authenticated
-- keys cannot touch this table at all, and the app reaches it server-side only.
create table if not exists grace_github (
  user_id      uuid primary key references grace_users(id) on delete cascade,
  login        text not null,
  name         text,
  avatar_url   text,
  token        text not null,
  scopes       text[] not null default '{}',
  connected_at timestamptz not null default now()
);

alter table grace_github enable row level security;

comment on table grace_github is
  'Per-user GitHub credentials. Service-role only; never exposed to the browser.';

-- A project can be backed by a repository, so an agent turn can be pushed back.
alter table grace_code_projects add column if not exists repo_owner  text;
alter table grace_code_projects add column if not exists repo_name   text;
alter table grace_code_projects add column if not exists repo_branch text;

-- The blob sha an imported file was read at, used to detect a moved remote file
-- before overwriting it.
alter table grace_code_files add column if not exists sha text;
