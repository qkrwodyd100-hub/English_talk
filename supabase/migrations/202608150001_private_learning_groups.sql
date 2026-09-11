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
  if value is null or value !~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$' then
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
      where not coalesce(
        jsonb_typeof(item) = 'object'
          and jsonb_typeof(item -> 'id') = 'string'
          and jsonb_typeof(item -> 'english') = 'string'
          and jsonb_typeof(item -> 'korean') = 'string'
          and private.is_json_integer_between(item -> 'day', 1, 60)
          and item ->> 'source' = 'custom',
        false
      )
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
      where not coalesce(
        jsonb_typeof(item) = 'object'
          and private.is_canonical_timestamp(item ->> 'timestamp')
          and private.is_json_integer_between(item -> 'day', 1, 60)
          and jsonb_typeof(item -> 'sentenceId') = 'string'
          and item ->> 'action' in ('answer-checked', 'mastered', 'review-completed')
          and (not item ? 'correct' or jsonb_typeof(item -> 'correct') = 'boolean'),
        false
      )
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'sentenceNotes') entry
      where not coalesce(
        jsonb_typeof(entry.value) = 'object'
          and jsonb_typeof(entry.value -> 'text') = 'string'
          and entry.value ->> 'text' <> ''
          and entry.value ->> 'text' = btrim(entry.value ->> 'text')
          and length(entry.value ->> 'text') <= 2000
          and private.is_canonical_timestamp(entry.value ->> 'updatedAt'),
        false
      )
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'answerHistory') entry
      where jsonb_typeof(entry.value) <> 'array'
        or jsonb_array_length(entry.value) > 5
        or exists (
          select 1 from jsonb_array_elements(entry.value) attempt
          where not coalesce(
            jsonb_typeof(attempt) = 'object'
              and private.is_canonical_timestamp(attempt ->> 'timestamp')
              and jsonb_typeof(attempt -> 'attempt') = 'string'
              and length(attempt ->> 'attempt') <= 2000
              and attempt ->> 'verdict' in ('correct', 'equivalent', 'contextual', 'needs-fix')
              and (not attempt ? 'reason' or jsonb_typeof(attempt -> 'reason') = 'string'),
            false
          )
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

create table if not exists public.learning_groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.learning_group_members (
  group_id uuid not null references public.learning_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (group_id, user_id),
  unique (user_id)
);

create table if not exists public.learning_group_profiles (
  group_id uuid primary key references public.learning_groups(id) on delete cascade,
  learning_state jsonb not null check (private.is_valid_learning_state(learning_state)),
  revision bigint not null default 1 check (revision > 0),
  updated_at timestamptz not null default now()
);

create table if not exists private.learning_profile_migration_backups (
  group_id uuid not null references public.learning_groups(id) on delete cascade,
  source_user_id uuid not null references auth.users(id) on delete restrict,
  learning_state jsonb not null,
  revision bigint not null,
  updated_at timestamptz not null,
  backed_up_at timestamptz not null default now(),
  primary key (group_id, source_user_id)
);

revoke all on private.learning_profile_migration_backups from public, anon, authenticated;

create or replace function private.merge_jsonb_array_distinct(primary_values jsonb, secondary_values jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(item.value order by item.source_priority, item.item_order), '[]'::jsonb)
  from (
    select distinct on (candidate.value)
      candidate.value, candidate.source_priority, candidate.item_order
    from (
      select value, 0 as source_priority, ordinality as item_order
      from jsonb_array_elements(primary_values) with ordinality
      union all
      select value, 1, ordinality
      from jsonb_array_elements(secondary_values) with ordinality
    ) candidate
    order by candidate.value, candidate.source_priority, candidate.item_order
  ) item;
$$;

create or replace function private.merge_custom_sentences(primary_values jsonb, secondary_values jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  with candidates as (
    select value, value ->> 'id' as sentence_id, 0 as source_priority, ordinality as item_order
    from jsonb_array_elements(primary_values) with ordinality
    union all
    select value, value ->> 'id', 1, ordinality
    from jsonb_array_elements(secondary_values) with ordinality
  ), chosen as (
    select distinct on (candidate.sentence_id)
      candidate.sentence_id, candidate.value
    from candidates candidate
    order by candidate.sentence_id,
      candidate.source_priority,
      case when candidate.source_priority = 0 then -candidate.item_order else candidate.item_order end
  ), positions as (
    select
      candidate.sentence_id,
      min(candidate.source_priority) as source_priority,
      coalesce(
        min(candidate.item_order) filter (where candidate.source_priority = 0),
        min(candidate.item_order) filter (where candidate.source_priority = 1)
      ) as item_order
    from candidates candidate
    group by candidate.sentence_id
  )
  select coalesce(jsonb_agg(chosen.value order by positions.source_priority, positions.item_order), '[]'::jsonb)
  from chosen
  join positions using (sentence_id);
$$;

create or replace function private.merge_study_activities(primary_values jsonb, secondary_values jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_agg(item.value order by item.value ->> 'timestamp' desc, item.source_priority, item.item_order), '[]'::jsonb)
  from (
    select distinct on (candidate.value)
      candidate.value, candidate.source_priority, candidate.item_order
    from (
      select value, 0 as source_priority, ordinality as item_order
      from jsonb_array_elements(primary_values) with ordinality
      union all
      select value, 1, ordinality
      from jsonb_array_elements(secondary_values) with ordinality
    ) candidate
    order by candidate.value, candidate.source_priority, candidate.item_order
  ) item;
$$;

create or replace function private.merge_answer_history(primary_values jsonb, secondary_values jsonb)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select coalesce(jsonb_object_agg(history.sentence_id, history.attempts), '{}'::jsonb)
  from (
    select sentence_id, (
      select coalesce(jsonb_agg(limited_attempt.value order by limited_attempt.value ->> 'timestamp' desc, limited_attempt.source_priority, limited_attempt.item_order), '[]'::jsonb)
      from (
        select attempt.value, attempt.source_priority, attempt.item_order
        from (
          select distinct on (candidate.value)
            candidate.value, candidate.source_priority, candidate.item_order
          from (
            select value, 0 as source_priority, ordinality as item_order
            from jsonb_array_elements(coalesce(primary_values -> sentence_id, '[]'::jsonb)) with ordinality
            union all
            select value, 1, ordinality
            from jsonb_array_elements(coalesce(secondary_values -> sentence_id, '[]'::jsonb)) with ordinality
          ) candidate
          order by candidate.value, candidate.source_priority, candidate.item_order
        ) attempt
        order by attempt.value ->> 'timestamp' desc, attempt.source_priority, attempt.item_order
        limit 5
      ) limited_attempt
    ) attempts
    from jsonb_object_keys(primary_values || secondary_values) sentence_id
  ) history
  where jsonb_array_length(history.attempts) > 0;
$$;

create or replace function private.merge_learning_states(current_state jsonb, backup_state jsonb)
returns jsonb
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not private.is_valid_learning_state(current_state)
     or not private.is_valid_learning_state(backup_state) then
    raise exception 'Cannot merge an invalid learning state';
  end if;

  return current_state || jsonb_build_object(
    'masteredIds', private.merge_jsonb_array_distinct(current_state -> 'masteredIds', backup_state -> 'masteredIds'),
    'customSentences', private.merge_custom_sentences(current_state -> 'customSentences', backup_state -> 'customSentences'),
    'completedChallengeDates', private.merge_jsonb_array_distinct(current_state -> 'completedChallengeDates', backup_state -> 'completedChallengeDates'),
    'dayPositions', (backup_state -> 'dayPositions') || (current_state -> 'dayPositions'),
    'completedSentenceIds', private.merge_jsonb_array_distinct(current_state -> 'completedSentenceIds', backup_state -> 'completedSentenceIds'),
    'attemptCounts', (backup_state -> 'attemptCounts') || (current_state -> 'attemptCounts'),
    'reviewQueueIds', private.merge_jsonb_array_distinct(current_state -> 'reviewQueueIds', backup_state -> 'reviewQueueIds'),
    'favoriteIds', private.merge_jsonb_array_distinct(current_state -> 'favoriteIds', backup_state -> 'favoriteIds'),
    'studyActivities', private.merge_study_activities(current_state -> 'studyActivities', backup_state -> 'studyActivities'),
    'sentenceNotes', (backup_state -> 'sentenceNotes') || (current_state -> 'sentenceNotes'),
    'answerHistory', private.merge_answer_history(current_state -> 'answerHistory', backup_state -> 'answerHistory')
  );
end;
$$;

revoke all on function private.merge_jsonb_array_distinct(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.merge_custom_sentences(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.merge_study_activities(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.merge_answer_history(jsonb, jsonb) from public, anon, authenticated;
revoke all on function private.merge_learning_states(jsonb, jsonb) from public, anon, authenticated;

create or replace function private.link_two_learning_accounts(member_email_1 text, member_email_2 text)
returns table (
  linked_group_id uuid,
  member_count bigint,
  profile_count bigint,
  backed_up_legacy_count bigint
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  target_emails text[] := array[btrim(member_email_1), btrim(member_email_2)];
  target_user_ids uuid[];
  target_group_ids uuid[];
  new_group_id uuid;
  preferred_user_id uuid;
  preferred_state jsonb;
  preferred_revision bigint;
  preferred_updated_at timestamptz;
  other_state jsonb;
  other_revision bigint;
  merged_state jsonb;
begin
  if target_emails[1] = '' or target_emails[2] = ''
     or lower(target_emails[1]) = lower(target_emails[2]) then
    raise exception 'Exactly two distinct member emails are required';
  end if;

  if exists (
    select 1
    from unnest(target_emails) with ordinality requested(email, member_order)
    left join auth.users account
      on lower(account.email) = lower(requested.email)
      and account.email_confirmed_at is not null
    group by requested.member_order
    having count(account.id) <> 1
  ) then
    raise exception 'Both exact Auth users must exist once and have confirmed emails';
  end if;

  select array_agg(account.id order by requested.member_order)
  into target_user_ids
  from unnest(target_emails) with ordinality requested(email, member_order)
  join auth.users account on lower(account.email) = lower(requested.email)
  where account.email_confirmed_at is not null;

  if coalesce(cardinality(target_user_ids), 0) <> 2 then
    raise exception 'Both exact Auth users must exist once and have confirmed emails';
  end if;

  perform 1
  from auth.users account
  where account.id = any(target_user_ids)
  order by account.id
  for update;

  select array_agg(distinct membership.group_id)
  into target_group_ids
  from public.learning_group_members membership
  where membership.user_id = any(target_user_ids);

  if coalesce(cardinality(target_group_ids), 0) = 1
     and (select count(*) from public.learning_group_members membership where membership.group_id = target_group_ids[1]) = 2
     and (select count(*) from public.learning_group_members membership where membership.group_id = target_group_ids[1] and membership.user_id = any(target_user_ids)) = 2 then
    new_group_id := target_group_ids[1];
  elsif coalesce(cardinality(target_group_ids), 0) <> 0 then
    raise exception 'Target users already have incompatible learning-group memberships';
  else
    perform 1
    from public.learning_profiles profile
    where profile.user_id = any(target_user_ids)
    order by profile.user_id
    for update;

    if exists (
      select 1
      from public.learning_profiles profile
      where profile.user_id = any(target_user_ids)
        and not private.is_valid_learning_state(profile.learning_state)
    ) then
      raise exception 'A legacy learning profile is invalid; no changes were made';
    end if;

    insert into public.learning_groups(created_by)
    values (target_user_ids[1])
    returning id into new_group_id;

    insert into private.learning_profile_migration_backups(
      group_id, source_user_id, learning_state, revision, updated_at
    )
    select new_group_id, profile.user_id, profile.learning_state, profile.revision, profile.updated_at
    from public.learning_profiles profile
    where profile.user_id = any(target_user_ids);

    select profile.user_id, profile.learning_state, profile.revision, profile.updated_at
    into preferred_user_id, preferred_state, preferred_revision, preferred_updated_at
    from public.learning_profiles profile
    join unnest(target_user_ids) with ordinality target(user_id, member_order) on target.user_id = profile.user_id
    order by profile.revision desc, profile.updated_at desc, target.member_order
    limit 1;

    if preferred_user_id is null then
      preferred_state := '{"masteredIds":[],"customSentences":[],"completedChallengeDates":[],"selectedDay":null,"dayPositions":{},"completedSentenceIds":[],"attemptCounts":{},"reviewQueueIds":[],"favoriteIds":[],"studyActivities":[],"sentenceNotes":{},"answerHistory":{}}'::jsonb;
      preferred_revision := 1;
      preferred_updated_at := now();
      merged_state := preferred_state;
    else
      select profile.learning_state, profile.revision
      into other_state, other_revision
      from public.learning_profiles profile
      where profile.user_id = any(target_user_ids)
        and profile.user_id <> preferred_user_id
      limit 1;
      merged_state := case
        when other_state is null then preferred_state
        else private.merge_learning_states(preferred_state, other_state)
      end;
    end if;

    insert into public.learning_group_profiles(group_id, learning_state, revision, updated_at)
    values (new_group_id, merged_state, greatest(preferred_revision, coalesce(other_revision, 1)), preferred_updated_at);

    insert into public.learning_group_members(group_id, user_id)
    select new_group_id, member.user_id
    from unnest(target_user_ids) member(user_id);
  end if;

  return query
  select
    new_group_id,
    (select count(*) from public.learning_group_members membership where membership.group_id = new_group_id),
    (select count(*) from public.learning_group_profiles profile where profile.group_id = new_group_id),
    (select count(*) from private.learning_profile_migration_backups backup where backup.group_id = new_group_id);
end;
$$;

revoke all on function private.link_two_learning_accounts(text, text) from public, anon, authenticated;

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

drop policy if exists learning_groups_member_select on public.learning_groups;
create policy learning_groups_member_select
on public.learning_groups
for select
to authenticated
using (private.is_learning_group_member(id));

drop policy if exists learning_group_members_self_select on public.learning_group_members;
create policy learning_group_members_self_select
on public.learning_group_members
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists learning_group_profiles_member_crud on public.learning_group_profiles;
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
