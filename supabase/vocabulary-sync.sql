create table if not exists public.vocabulary_progress (
  user_id uuid not null,
  profile_id text not null,
  deck_id text not null,
  lemma text not null,
  status text not null default '',
  recognition text not null default '',
  level integer not null default 0,
  seen_count integer not null default 0,
  correct_count integer not null default 0,
  mistake_count integer not null default 0,
  first_seen bigint not null default 0,
  last_reviewed bigint not null default 0,
  next_review bigint not null default 0,
  screen_repeats integer not null default 1,
  screen_class text not null default 'new',
  client_updated_at bigint not null,
  device_id text not null,
  mutation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, profile_id, deck_id, lemma)
);

create table if not exists public.vocabulary_resume (
  user_id uuid not null,
  profile_id text not null,
  deck_id text not null,
  cursor integer not null default 0,
  quick_cursor integer not null default 0,
  version integer not null default 1,
  client_updated_at bigint not null,
  device_id text not null,
  mutation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, profile_id, deck_id)
);

create table if not exists public.vocabulary_settings (
  user_id uuid not null,
  profile_id text not null,
  setting_key text not null check (setting_key in ('vocabBatchSize','vocabShowRelationsAfterAnswer')),
  setting_value jsonb not null,
  client_updated_at bigint not null,
  device_id text not null,
  mutation_id text not null,
  server_updated_at timestamptz not null default clock_timestamp(),
  primary key (user_id, profile_id, setting_key)
);

alter table public.vocabulary_progress enable row level security;
alter table public.vocabulary_resume enable row level security;
alter table public.vocabulary_settings enable row level security;

revoke all on table public.vocabulary_progress from public, anon, authenticated;
revoke all on table public.vocabulary_resume from public, anon, authenticated;
revoke all on table public.vocabulary_settings from public, anon, authenticated;
grant select, insert, update on table public.vocabulary_progress to authenticated;
grant select, insert, update on table public.vocabulary_resume to authenticated;
grant select, insert, update on table public.vocabulary_settings to authenticated;

drop policy if exists vocabulary_progress_select_own on public.vocabulary_progress;
drop policy if exists vocabulary_progress_insert_own on public.vocabulary_progress;
drop policy if exists vocabulary_progress_update_own on public.vocabulary_progress;
create policy vocabulary_progress_select_own on public.vocabulary_progress for select to authenticated using ((select auth.uid()) = user_id);
create policy vocabulary_progress_insert_own on public.vocabulary_progress for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vocabulary_progress_update_own on public.vocabulary_progress for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists vocabulary_resume_select_own on public.vocabulary_resume;
drop policy if exists vocabulary_resume_insert_own on public.vocabulary_resume;
drop policy if exists vocabulary_resume_update_own on public.vocabulary_resume;
create policy vocabulary_resume_select_own on public.vocabulary_resume for select to authenticated using ((select auth.uid()) = user_id);
create policy vocabulary_resume_insert_own on public.vocabulary_resume for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vocabulary_resume_update_own on public.vocabulary_resume for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

drop policy if exists vocabulary_settings_select_own on public.vocabulary_settings;
drop policy if exists vocabulary_settings_insert_own on public.vocabulary_settings;
drop policy if exists vocabulary_settings_update_own on public.vocabulary_settings;
create policy vocabulary_settings_select_own on public.vocabulary_settings for select to authenticated using ((select auth.uid()) = user_id);
create policy vocabulary_settings_insert_own on public.vocabulary_settings for insert to authenticated with check ((select auth.uid()) = user_id);
create policy vocabulary_settings_update_own on public.vocabulary_settings for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create or replace function public.merge_vocabulary_progress(p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.vocabulary_progress (
    user_id, profile_id, deck_id, lemma, status, recognition, level,
    seen_count, correct_count, mistake_count, first_seen, last_reviewed,
    next_review, screen_repeats, screen_class, client_updated_at,
    device_id, mutation_id, server_updated_at
  )
  select auth.uid(), x.profile_id, x.deck_id, lower(trim(x.lemma)),
    coalesce(x.status,''), coalesce(x.recognition,''), coalesce(x.level,0),
    coalesce(x.seen_count,0), coalesce(x.correct_count,0), coalesce(x.mistake_count,0),
    coalesce(x.first_seen,0), coalesce(x.last_reviewed,0), coalesce(x.next_review,0),
    coalesce(x.screen_repeats,1), coalesce(x.screen_class,'new'),
    x.client_updated_at, x.device_id, x.mutation_id, clock_timestamp()
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    profile_id text, deck_id text, lemma text, status text, recognition text,
    level integer, seen_count integer, correct_count integer, mistake_count integer,
    first_seen bigint, last_reviewed bigint, next_review bigint,
    screen_repeats integer, screen_class text, client_updated_at bigint,
    device_id text, mutation_id text
  )
  where nullif(trim(x.profile_id),'') is not null
    and nullif(trim(x.deck_id),'') is not null
    and nullif(trim(x.lemma),'') is not null
    and x.client_updated_at is not null
    and nullif(x.device_id,'') is not null
    and nullif(x.mutation_id,'') is not null
  on conflict (user_id, profile_id, deck_id, lemma) do update set
    status=excluded.status, recognition=excluded.recognition, level=excluded.level,
    seen_count=excluded.seen_count, correct_count=excluded.correct_count,
    mistake_count=excluded.mistake_count, first_seen=excluded.first_seen,
    last_reviewed=excluded.last_reviewed, next_review=excluded.next_review,
    screen_repeats=excluded.screen_repeats, screen_class=excluded.screen_class,
    client_updated_at=excluded.client_updated_at, device_id=excluded.device_id,
    mutation_id=excluded.mutation_id, server_updated_at=clock_timestamp()
  where (excluded.client_updated_at, excluded.mutation_id) >
        (vocabulary_progress.client_updated_at, vocabulary_progress.mutation_id);
end;
$$;

create or replace function public.merge_vocabulary_resume(p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.vocabulary_resume (
    user_id, profile_id, deck_id, cursor, quick_cursor, version,
    client_updated_at, device_id, mutation_id, server_updated_at
  )
  select auth.uid(), x.profile_id, x.deck_id, greatest(coalesce(x.cursor,0),0),
    greatest(coalesce(x.quick_cursor,0),0), greatest(coalesce(x.version,1),1),
    x.client_updated_at, x.device_id, x.mutation_id, clock_timestamp()
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    profile_id text, deck_id text, cursor integer, quick_cursor integer,
    version integer, client_updated_at bigint, device_id text, mutation_id text
  )
  where nullif(trim(x.profile_id),'') is not null
    and nullif(trim(x.deck_id),'') is not null
    and x.client_updated_at is not null
    and nullif(x.device_id,'') is not null
    and nullif(x.mutation_id,'') is not null
  on conflict (user_id, profile_id, deck_id) do update set
    cursor=excluded.cursor, quick_cursor=excluded.quick_cursor, version=excluded.version,
    client_updated_at=excluded.client_updated_at, device_id=excluded.device_id,
    mutation_id=excluded.mutation_id, server_updated_at=clock_timestamp()
  where (excluded.client_updated_at, excluded.mutation_id) >
        (vocabulary_resume.client_updated_at, vocabulary_resume.mutation_id);
end;
$$;

create or replace function public.merge_vocabulary_settings(p_rows jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.vocabulary_settings (
    user_id, profile_id, setting_key, setting_value,
    client_updated_at, device_id, mutation_id, server_updated_at
  )
  select auth.uid(), x.profile_id, x.setting_key, x.setting_value,
    x.client_updated_at, x.device_id, x.mutation_id, clock_timestamp()
  from jsonb_to_recordset(coalesce(p_rows,'[]'::jsonb)) as x(
    profile_id text, setting_key text, setting_value jsonb,
    client_updated_at bigint, device_id text, mutation_id text
  )
  where nullif(trim(x.profile_id),'') is not null
    and x.setting_key in ('vocabBatchSize','vocabShowRelationsAfterAnswer')
    and x.setting_value is not null
    and x.client_updated_at is not null
    and nullif(x.device_id,'') is not null
    and nullif(x.mutation_id,'') is not null
  on conflict (user_id, profile_id, setting_key) do update set
    setting_value=excluded.setting_value, client_updated_at=excluded.client_updated_at,
    device_id=excluded.device_id, mutation_id=excluded.mutation_id,
    server_updated_at=clock_timestamp()
  where (excluded.client_updated_at, excluded.mutation_id) >
        (vocabulary_settings.client_updated_at, vocabulary_settings.mutation_id);
end;
$$;

revoke all on function public.merge_vocabulary_progress(jsonb) from public, anon;
revoke all on function public.merge_vocabulary_resume(jsonb) from public, anon;
revoke all on function public.merge_vocabulary_settings(jsonb) from public, anon;
grant execute on function public.merge_vocabulary_progress(jsonb) to authenticated;
grant execute on function public.merge_vocabulary_resume(jsonb) to authenticated;
grant execute on function public.merge_vocabulary_settings(jsonb) to authenticated;

create index if not exists vocabulary_progress_pull_idx
  on public.vocabulary_progress(user_id, profile_id, server_updated_at);
create index if not exists vocabulary_resume_pull_idx
  on public.vocabulary_resume(user_id, profile_id, server_updated_at);
create index if not exists vocabulary_settings_pull_idx
  on public.vocabulary_settings(user_id, profile_id, server_updated_at);
