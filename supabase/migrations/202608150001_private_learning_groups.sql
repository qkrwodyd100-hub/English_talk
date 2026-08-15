begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_json_integer_between(value jsonb, minimum numeric, maximum numeric)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(value) = 'number'
      and value::text ~ '^-?(0|[1-9][0-9]*)$'
      and value::text::numeric between minimum and maximum,
    false
  );
$$;

create or replace function private.is_json_nonnegative_integer(value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(
    jsonb_typeof(value) = 'number'
      and value::text ~ '^(0|[1-9][0-9]*)$',
    false
  );
$$;

create or replace function private.is_canonical_timestamp(value text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
begin
  if value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$' then
    return false;
  end if;
  perform value::timestamptz;
  return true;
exception when others then
  return false;
end;
$$;

create or replace function private.is_valid_learning_state(state_value jsonb)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_typeof(state_value) = 'object'
    and octet_length(state_value::text) <= 1048576
    and jsonb_typeof(state_value -> 'masteredIds') = 'array'
    and jsonb_typeof(state_value -> 'customSentences') = 'array'
    and jsonb_typeof(state_value -> 'completedChallengeDates') = 'array'
    and jsonb_typeof(state_value -> 'completedSentenceIds') = 'array'
    and jsonb_typeof(state_value -> 'reviewQueueIds') = 'array'
    and jsonb_typeof(state_value -> 'favoriteIds') = 'array'
    and jsonb_typeof(state_value -> 'studyActivities') = 'array'
    and jsonb_typeof(state_value -> 'dayPositions') = 'object'
    and jsonb_typeof(state_value -> 'attemptCounts') = 'object'
    and jsonb_typeof(state_value -> 'sentenceNotes') = 'object'
    and jsonb_typeof(state_value -> 'answerHistory') = 'object'
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'masteredIds') item
      where jsonb_typeof(item) <> 'string'
    )
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'completedChallengeDates') item
      where jsonb_typeof(item) <> 'string'
    )
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'completedSentenceIds') item
      where jsonb_typeof(item) <> 'string'
    )
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'reviewQueueIds') item
      where jsonb_typeof(item) <> 'string'
    )
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'favoriteIds') item
      where jsonb_typeof(item) <> 'string'
    )
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'customSentences') item
      where jsonb_typeof(item) <> 'object'
        or jsonb_typeof(item -> 'id') <> 'string'
        or jsonb_typeof(item -> 'english') <> 'string'
        or jsonb_typeof(item -> 'korean') <> 'string'
        or not private.is_json_integer_between(item -> 'day', 1, 60)
        or item ->> 'source' <> 'custom'
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'dayPositions') entry
      where entry.key !~ '^([1-9]|[1-5][0-9]|60)$'
        or not private.is_json_nonnegative_integer(entry.value)
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'attemptCounts') entry
      where not private.is_json_nonnegative_integer(entry.value)
    )
    and not exists (
      select 1 from jsonb_array_elements(state_value -> 'studyActivities') item
      where jsonb_typeof(item) <> 'object'
        or not private.is_canonical_timestamp(item ->> 'timestamp')
        or not private.is_json_integer_between(item -> 'day', 1, 60)
        or jsonb_typeof(item -> 'sentenceId') <> 'string'
        or item ->> 'action' not in ('answer-checked', 'mastered', 'review-completed')
        or (item ? 'correct' and jsonb_typeof(item -> 'correct') <> 'boolean')
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'sentenceNotes') entry
      where jsonb_typeof(entry.value) <> 'object'
        or jsonb_typeof(entry.value -> 'text') <> 'string'
        or entry.value ->> 'text' = ''
        or entry.value ->> 'text' <> btrim(entry.value ->> 'text')
        or length(entry.value ->> 'text') > 2000
        or not private.is_canonical_timestamp(entry.value ->> 'updatedAt')
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'answerHistory') entry
      where jsonb_typeof(entry.value) <> 'array'
        or jsonb_array_length(entry.value) > 5
        or exists (
          select 1 from jsonb_array_elements(entry.value) attempt
          where jsonb_typeof(attempt) <> 'object'
            or not private.is_canonical_timestamp(attempt ->> 'timestamp')
            or jsonb_typeof(attempt -> 'attempt') <> 'string'
            or length(attempt ->> 'attempt') > 2000
            or attempt ->> 'verdict' not in ('correct', 'equivalent', 'contextual', 'needs-fix')
            or (attempt ? 'reason' and jsonb_typeof(attempt -> 'reason') <> 'string')
        )
    )
    and (state_value -> 'selectedDay' = 'null'::jsonb
      or private.is_json_integer_between(state_value -> 'selectedDay', 1, 60)), false);
$$;

revoke all on function private.is_json_integer_between(jsonb, numeric, numeric) from public, anon;
revoke all on function private.is_json_nonnegative_integer(jsonb) from public, anon;
revoke all on function private.is_canonical_timestamp(text) from public, anon;
revoke all on function private.is_valid_learning_state(jsonb) from public, anon;
grant execute on function private.is_json_integer_between(jsonb, numeric, numeric) to authenticated;
grant execute on function private.is_json_nonnegative_integer(jsonb) to authenticated;
grant execute on function private.is_canonical_timestamp(text) to authenticated;
grant execute on function private.is_valid_learning_state(jsonb) to authenticated;

create table public.learning_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.learning_group_members (
  group_id uuid not null references public.learning_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (user_id)
);

create table public.learning_group_profiles (
  group_id uuid primary key references public.learning_groups(id) on delete cascade,
  learning_state jsonb not null check (private.is_valid_learning_state(learning_state)),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table private.learning_profile_migration_backups (
  group_id uuid not null references public.learning_groups(id) on delete cascade,
  source_user_id uuid not null references auth.users(id) on delete restrict,
  learning_state jsonb not null,
  revision bigint not null,
  updated_at timestamptz not null,
  backed_up_at timestamptz not null default now(),
  primary key (group_id, source_user_id)
);

revoke all on private.learning_profile_migration_backups from public, anon, authenticated;

create or replace function private.is_learning_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.learning_group_members membership
    where membership.group_id = target_group_id
      and membership.user_id = auth.uid()
  );
$$;

revoke all on function private.is_learning_group_member(uuid) from public, anon;
grant execute on function private.is_learning_group_member(uuid) to authenticated;

create or replace function private.bump_learning_group_profile_revision()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function private.bump_learning_group_profile_revision() from public, anon;

drop trigger if exists learning_group_profiles_revision on public.learning_group_profiles;
create trigger learning_group_profiles_revision
before update on public.learning_group_profiles
for each row execute function private.bump_learning_group_profile_revision();

create or replace function public.update_learning_group_profile(
  target_group_id uuid,
  expected_revision bigint,
  next_learning_state jsonb
)
returns setof public.learning_group_profiles
language sql
security definer
set search_path = ''
as $$
  update public.learning_group_profiles as profile
  set learning_state = next_learning_state
  where profile.group_id = target_group_id
    and profile.revision = expected_revision
    and private.is_learning_group_member(target_group_id)
  returning profile.*;
$$;

revoke all on function public.update_learning_group_profile(uuid, bigint, jsonb) from public, anon;
grant execute on function public.update_learning_group_profile(uuid, bigint, jsonb) to authenticated;

alter table public.learning_groups enable row level security;
alter table public.learning_group_members enable row level security;
alter table public.learning_group_profiles enable row level security;

create policy learning_groups_member_select
on public.learning_groups
for select
to authenticated
using (private.is_learning_group_member(id));

create policy learning_group_members_self_select
on public.learning_group_members
for select
to authenticated
using (user_id = auth.uid());

create policy learning_group_profiles_member_crud
on public.learning_group_profiles
for all
to authenticated
using (private.is_learning_group_member(group_id))
with check (private.is_learning_group_member(group_id));

revoke all on public.learning_groups from anon;
revoke all on public.learning_group_members from anon;
revoke all on public.learning_group_profiles from anon;
revoke all on public.learning_groups from authenticated;
revoke all on public.learning_group_members from authenticated;
revoke all on public.learning_group_profiles from authenticated;
grant select on public.learning_groups to authenticated;
grant select on public.learning_group_members to authenticated;
grant select, insert on public.learning_group_profiles to authenticated;

commit;
