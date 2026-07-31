-- Phase 7: intermediate route stops on docs
alter table public.docs add column if not exists stops jsonb not null default '[]'::jsonb;
