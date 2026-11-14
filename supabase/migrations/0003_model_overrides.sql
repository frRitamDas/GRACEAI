-- Admin overrides for the model catalog.
--
-- The bundled catalog and live discovery describe what providers serve; this
-- table records what the operator decided to do about it: hide a model from the
-- picker, rename it, change its tier or price, or add one the providers do not
-- advertise. Rows are keyed by model id (the same id the picker uses), so an
-- override survives a provider rename and a redeploy.
create table if not exists grace_model_overrides (
  id          text primary key,
  hidden      boolean not null default false,
  name        text,
  tier        smallint,
  credits     integer,
  blurb       text,
  -- Custom models that discovery cannot produce. When `custom` is true the row
  -- also carries what is needed to route it.
  custom      boolean not null default false,
  provider    text,
  upstream    text,
  context_label text,
  free        boolean not null default false,
  updated_at  timestamptz not null default now()
);

alter table grace_model_overrides enable row level security;

comment on table grace_model_overrides is
  'Owner edits to the model catalog: hidden, renamed, repriced, or custom entries.';
