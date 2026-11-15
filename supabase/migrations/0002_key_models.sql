-- Which models a provider key is allowed to serve.
--
-- Null means "every model", which is the default and what an existing key keeps
-- after this migration: a key added before the picker existed must not suddenly
-- lose its models. An empty array is a deliberate "none yet" and is stored as
-- `{}` by Postgres, so the two states stay distinct.
alter table grace_provider_keys
  add column if not exists models text[];

comment on column grace_provider_keys.models is
  'Allow-list of model ids (as returned by the provider). Null = all models.';
