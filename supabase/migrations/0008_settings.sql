-- Deployment settings.
--
-- One row for the installation, written only by the owner in the admin console.
-- It holds no secrets: provider keys stay in grace_provider_keys, which is
-- service-role only. This table is what makes the console able to change copy,
-- announcements, feature switches and model routing without a redeploy.

create table if not exists grace_settings (
  id         text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table grace_settings enable row level security;

comment on table grace_settings is
  'Owner-written deployment settings (brand copy, announcements, feature switches, model allowlist). Service-role only.';

-- Which account approved a membership, so the console has an audit line and a
-- revoked membership cannot be silently re-granted.
alter table grace_users add column if not exists membership_source text;
alter table grace_users add column if not exists membership_granted_at timestamptz;
