-- Workspaces: a chat that can hold code.
--
-- The old split was two apps — Grace for conversation, Grace Code for files.
-- The work people actually do is one thread that sometimes needs to read a
-- repository, so a conversation now carries a workspace: an optional linked
-- repo and a small set of attached files that only exist locally.
--
-- Nothing is backfilled. A conversation without a workspace behaves exactly as
-- before, which is what every existing row is.

alter table grace_conversations add column if not exists repo_owner  text;
alter table grace_conversations add column if not exists repo_name   text;
alter table grace_conversations add column if not exists repo_branch text;

-- Local files attached to a conversation. Separate from grace_code_files so a
-- chat workspace can never collide with a Grace Code project's paths.
create table if not exists grace_workspace_files (
  conversation_id uuid not null references grace_conversations(id) on delete cascade,
  path            text not null,
  content         text not null default '',
  sha             text,
  updated_at      timestamptz not null default now(),
  primary key (conversation_id, path)
);

alter table grace_workspace_files enable row level security;

comment on table grace_workspace_files is
  'Files attached to a chat workspace. Service-role only, like the rest of the app.';
