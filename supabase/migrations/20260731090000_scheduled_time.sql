-- Phase 5: optional start time on docs
alter table public.docs add column if not exists scheduled_time text;
