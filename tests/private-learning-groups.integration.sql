\set ON_ERROR_STOP on

create role anon nologin;
create role authenticated nologin;
create schema auth;
grant usage on schema auth to authenticated;

create table auth.users (
  id uuid primary key,
  email text not null,
  email_confirmed_at timestamptz
);

create function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

grant execute on function auth.uid() to authenticated;

create table public.learning_profiles (
  user_id uuid primary key references auth.users(id),
  learning_state jsonb not null,
  revision bigint not null,
  updated_at timestamptz not null
);

\ir ../supabase/migrations/202608150001_private_learning_groups.sql
\ir ../supabase/migrations/202608150001_private_learning_groups.sql

insert into auth.users(id, email, email_confirmed_at) values
  ('11111111-1111-4111-8111-111111111111', 'member-one' || chr(64) || 'example.invalid', now()),
  ('22222222-2222-4222-8222-222222222222', 'member-two' || chr(64) || 'example.invalid', now()),
  ('33333333-3333-4333-8333-333333333333', 'outsider' || chr(64) || 'example.invalid', now());

do $$
declare
  valid_shape jsonb := '{"masteredIds":[],"customSentences":[],"completedChallengeDates":[],"selectedDay":null,"dayPositions":{},"completedSentenceIds":[],"attemptCounts":{},"reviewQueueIds":[],"favoriteIds":[],"studyActivities":[],"sentenceNotes":{},"answerHistory":{}}'::jsonb;
begin
  if private.is_valid_learning_state(jsonb_set(valid_shape, '{customSentences}', '[{"day":1,"source":"custom"}]'::jsonb))
     or private.is_valid_learning_state(jsonb_set(valid_shape, '{studyActivities}', '[{"day":1,"sentenceId":"s","action":"mastered"}]'::jsonb))
     or private.is_valid_learning_state(jsonb_set(valid_shape, '{answerHistory}', '{"s":[{"attempt":"missing timestamp","verdict":"correct"}]}'::jsonb)) then
    raise exception 'validator accepted a learning-state item with missing required fields';
  end if;
end;
$$;

insert into public.learning_profiles(user_id, learning_state, revision, updated_at) values
(
  '11111111-1111-4111-8111-111111111111',
  '{
    "masteredIds":["current","shared"],
    "customSentences":[
      {"id":"same","english":"Current.","korean":"현재", "day":2,"source":"custom"},
      {"id":"current-only","english":"Current only.","korean":"현재만", "day":2,"source":"custom"},
      {"id":"same","english":"Current latest.","korean":"최신 현재", "day":2,"source":"custom"}
    ],
    "completedChallengeDates":["2026-09-10"],
    "selectedDay":2,
    "selectedDayIsManual":true,
    "dayPositions":{"1":4,"2":3},
    "completedSentenceIds":["current-sentence"],
    "attemptCounts":{"same":4,"current":2},
    "reviewQueueIds":["current-review"],
    "favoriteIds":["shared-favorite"],
    "studyActivities":[
      {"timestamp":"2026-09-10T02:00:00.000Z","day":2,"sentenceId":"current-sentence","action":"mastered"},
      {"timestamp":"2026-09-09T02:00:00.000Z","day":1,"sentenceId":"shared-activity","action":"answer-checked","correct":true}
    ],
    "sentenceNotes":{"same":{"text":"current note","updatedAt":"2026-09-10T02:00:00.000Z"}},
    "answerHistory":{"same":[
      {"timestamp":"2026-09-10T02:00:00.000Z","attempt":"current","verdict":"correct"},
      {"timestamp":"2026-09-09T02:00:00.000Z","attempt":"shared","verdict":"equivalent"}
    ]}
  }'::jsonb,
  5,
  '2026-09-10T02:00:00Z'
),
(
  '22222222-2222-4222-8222-222222222222',
  '{
    "masteredIds":["backup","shared"],
    "customSentences":[
      {"id":"same","english":"Backup.","korean":"백업", "day":1,"source":"custom"},
      {"id":"backup-only","english":"Backup only.","korean":"백업만", "day":1,"source":"custom"}
    ],
    "completedChallengeDates":["2026-09-09"],
    "selectedDay":1,
    "dayPositions":{"1":1,"3":8},
    "completedSentenceIds":["backup-sentence"],
    "attemptCounts":{"same":1,"backup":3},
    "reviewQueueIds":["backup-review"],
    "favoriteIds":["backup-favorite","shared-favorite"],
    "studyActivities":[
      {"timestamp":"2026-09-11T02:00:00.000Z","day":1,"sentenceId":"backup-sentence","action":"review-completed"},
      {"timestamp":"2026-09-09T02:00:00.000Z","day":1,"sentenceId":"shared-activity","action":"answer-checked","correct":true}
    ],
    "sentenceNotes":{
      "same":{"text":"backup note","updatedAt":"2026-09-11T02:00:00.000Z"},
      "backup":{"text":"backup only note","updatedAt":"2026-09-11T02:00:00.000Z"}
    },
    "answerHistory":{"same":[
      {"timestamp":"2026-09-11T02:00:00.000Z","attempt":"backup","verdict":"needs-fix"},
      {"timestamp":"2026-09-09T02:00:00.000Z","attempt":"shared","verdict":"equivalent"},
      {"timestamp":"2026-09-08T02:00:00.000Z","attempt":"older-1","verdict":"needs-fix"},
      {"timestamp":"2026-09-07T02:00:00.000Z","attempt":"older-2","verdict":"needs-fix"},
      {"timestamp":"2026-09-06T02:00:00.000Z","attempt":"must-be-trimmed","verdict":"needs-fix"}
    ]}
  }'::jsonb,
  4,
  '2026-09-11T02:00:00Z'
);

create temp table first_link as
select * from private.link_two_learning_accounts(
  'member-one' || chr(64) || 'example.invalid',
  'member-two' || chr(64) || 'example.invalid'
);

do $$
declare
  linked record;
  state jsonb;
  group_total bigint;
begin
  select * into strict linked from first_link;
  if linked.member_count <> 2 or linked.profile_count <> 1 or linked.backed_up_legacy_count <> 2 then
    raise exception 'unexpected link counts: %', row_to_json(linked);
  end if;

  select learning_state into strict state
  from public.learning_group_profiles
  where group_id = linked.linked_group_id;

  if state -> 'masteredIds' <> '["current","shared","backup"]'::jsonb
     or state -> 'customSentences' -> 0 ->> 'english' <> 'Current latest.'
     or state -> 'customSentences' -> 2 ->> 'id' <> 'backup-only'
     or state -> 'dayPositions' <> '{"1":4,"2":3,"3":8}'::jsonb
     or state -> 'attemptCounts' <> '{"same":4,"current":2,"backup":3}'::jsonb
     or state -> 'sentenceNotes' -> 'same' ->> 'text' <> 'current note'
     or state -> 'sentenceNotes' -> 'backup' ->> 'text' <> 'backup only note'
     or state -> 'studyActivities' -> 0 ->> 'sentenceId' <> 'backup-sentence'
     or jsonb_array_length(state -> 'studyActivities') <> 3
     or state -> 'answerHistory' -> 'same' -> 0 ->> 'attempt' <> 'backup'
     or jsonb_array_length(state -> 'answerHistory' -> 'same') <> 5
     or (state -> 'answerHistory' -> 'same') @> '[{"attempt":"must-be-trimmed"}]'::jsonb
     or state ->> 'selectedDay' <> '2'
     or state ->> 'selectedDayIsManual' <> 'true' then
    raise exception 'merged state does not match mergeLearningStates semantics: %', state;
  end if;

  select count(*) into group_total from public.learning_groups;
  perform private.link_two_learning_accounts(
    'member-one' || chr(64) || 'example.invalid',
    'member-two' || chr(64) || 'example.invalid'
  );
  if (select count(*) from public.learning_groups) <> group_total then
    raise exception 'rerunning the operator created a duplicate group';
  end if;

  begin
    perform private.link_two_learning_accounts(
      'member-one' || chr(64) || 'example.invalid',
      'outsider' || chr(64) || 'example.invalid'
    );
    raise exception 'incompatible existing membership was accepted';
  exception
    when others then
      if sqlerrm = 'incompatible existing membership was accepted' then raise; end if;
  end;
  if (select count(*) from public.learning_groups) <> group_total then
    raise exception 'failed operator attempt left partial data';
  end if;
end;
$$;

select set_config('test.target_group', (select linked_group_id::text from first_link), false);

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-4111-8111-111111111111', true);
do $$
declare
  target_group uuid := current_setting('test.target_group')::uuid;
  next_state jsonb;
  changed_count bigint;
begin
  if (select count(*) from public.learning_group_members) <> 1 then
    raise exception 'member can see another member row';
  end if;
  if (select count(*) from public.learning_groups where id = target_group) <> 1
     or (select count(*) from public.learning_group_profiles where group_id = target_group) <> 1 then
    raise exception 'member cannot read its shared group/profile';
  end if;

  select learning_state || '{"selectedDay":4}'::jsonb into next_state
  from public.learning_group_profiles where group_id = target_group;
  select count(*) into changed_count
  from public.update_learning_group_profile(target_group, 5, next_state);
  if changed_count <> 1 or (select revision from public.learning_group_profiles where group_id = target_group) <> 6 then
    raise exception 'member CAS update did not advance exactly one revision';
  end if;
  select count(*) into changed_count
  from public.update_learning_group_profile(target_group, 5, next_state);
  if changed_count <> 0 or (select revision from public.learning_group_profiles where group_id = target_group) <> 6 then
    raise exception 'stale CAS update mutated the profile';
  end if;

  begin
    update public.learning_group_profiles set learning_state = next_state where group_id = target_group;
    raise exception 'direct member update was accepted';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;
commit;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-4222-8222-222222222222', true);
do $$
declare
  target_group uuid := current_setting('test.target_group')::uuid;
begin
  if (select count(*) from public.learning_group_members) <> 1
     or (select count(*) from public.learning_groups where id = target_group) <> 1
     or (select count(*) from public.learning_group_profiles where group_id = target_group) <> 1 then
    raise exception 'second member cannot read its own membership and shared profile';
  end if;
end;
$$;
rollback;

begin;
set local role authenticated;
select set_config('request.jwt.claim.sub', '33333333-3333-4333-8333-333333333333', true);
do $$
declare
  target_group uuid := current_setting('test.target_group')::uuid;
  target_state jsonb;
  changed_count bigint;
begin
  if (select count(*) from public.learning_groups where id = target_group) <> 0
     or (select count(*) from public.learning_group_profiles where group_id = target_group) <> 0
     or (select count(*) from public.learning_group_members where group_id = target_group) <> 0 then
    raise exception 'nonmember can read private group data';
  end if;
  select learning_state into target_state
  from public.learning_group_profiles where group_id = target_group;
  select count(*) into changed_count
  from public.update_learning_group_profile(target_group, 6, coalesce(target_state, '{}'::jsonb));
  if changed_count <> 0 then
    raise exception 'nonmember RPC changed the shared profile';
  end if;
end;
$$;
rollback;

insert into auth.users(id, email, email_confirmed_at) values
  ('44444444-4444-4444-8444-444444444444', 'empty-one' || chr(64) || 'example.invalid', now()),
  ('55555555-5555-4555-8555-555555555555', 'empty-two' || chr(64) || 'example.invalid', now()),
  ('66666666-6666-4666-8666-666666666666', 'single-one' || chr(64) || 'example.invalid', now()),
  ('77777777-7777-4777-8777-777777777777', 'single-two' || chr(64) || 'example.invalid', now());

insert into public.learning_profiles(user_id, learning_state, revision, updated_at)
select
  '66666666-6666-4666-8666-666666666666',
  '{"masteredIds":["single"],"customSentences":[],"completedChallengeDates":[],"selectedDay":3,"dayPositions":{},"completedSentenceIds":[],"attemptCounts":{},"reviewQueueIds":[],"favoriteIds":[],"studyActivities":[],"sentenceNotes":{},"answerHistory":{}}'::jsonb,
  2,
  '2026-09-11T03:00:00Z';

do $$
declare
  empty_pair record;
  single_pair record;
begin
  select * into strict empty_pair from private.link_two_learning_accounts(
    'empty-one' || chr(64) || 'example.invalid',
    'empty-two' || chr(64) || 'example.invalid'
  );
  select * into strict single_pair from private.link_two_learning_accounts(
    'single-one' || chr(64) || 'example.invalid',
    'single-two' || chr(64) || 'example.invalid'
  );
  if empty_pair.member_count <> 2 or empty_pair.profile_count <> 1 or empty_pair.backed_up_legacy_count <> 0 then
    raise exception 'zero-legacy pair was not initialized safely: %', row_to_json(empty_pair);
  end if;
  if single_pair.member_count <> 2 or single_pair.profile_count <> 1 or single_pair.backed_up_legacy_count <> 1 then
    raise exception 'one-legacy pair was not initialized safely: %', row_to_json(single_pair);
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('88888888-8888-4888-8888-888888888888', 'invalid-one' || chr(64) || 'example.invalid', now()),
  ('99999999-9999-4999-8999-999999999999', 'invalid-two' || chr(64) || 'example.invalid', now());
insert into public.learning_profiles(user_id, learning_state, revision, updated_at) values
  ('88888888-8888-4888-8888-888888888888', '{"broken":true}'::jsonb, 1, now());

do $$
declare
  group_total bigint := (select count(*) from public.learning_groups);
begin
  begin
    perform private.link_two_learning_accounts(
      'invalid-one' || chr(64) || 'example.invalid',
      'invalid-two' || chr(64) || 'example.invalid'
    );
    raise exception 'invalid legacy state was accepted';
  exception
    when others then
      if sqlerrm = 'invalid legacy state was accepted' then raise; end if;
  end;
  if (select count(*) from public.learning_groups) <> group_total
     or exists (select 1 from public.learning_group_members where user_id in ('88888888-8888-4888-8888-888888888888', '99999999-9999-4999-8999-999999999999')) then
    raise exception 'invalid legacy state left partial group data';
  end if;
end;
$$;

insert into auth.users(id, email, email_confirmed_at) values
  ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'duplicate' || chr(64) || 'example.invalid', now()),
  ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'DUPLICATE' || chr(64) || 'example.invalid', now());

do $$
declare
  group_total bigint := (select count(*) from public.learning_groups);
begin
  begin
    perform private.link_two_learning_accounts(
      'duplicate' || chr(64) || 'example.invalid',
      'missing' || chr(64) || 'example.invalid'
    );
    raise exception 'ambiguous and missing Auth users were accepted';
  exception
    when others then
      if sqlerrm = 'ambiguous and missing Auth users were accepted' then raise; end if;
  end;
  if (select count(*) from public.learning_groups) <> group_total then
    raise exception 'ambiguous account lookup left partial group data';
  end if;
end;
$$;

\ir ../supabase/migrations/202608150001_private_learning_groups.sql

do $$
begin
  if (select count(*) from public.learning_groups) <> 3
     or (select count(*) from public.learning_group_members) <> 6
     or (select count(*) from private.learning_profile_migration_backups) <> 3
     or (select revision from public.learning_group_profiles where group_id = current_setting('test.target_group')::uuid) <> 6 then
    raise exception 'migration rerun changed seeded data';
  end if;
end;
$$;

select 'private learning-group integration checks passed' as result;
