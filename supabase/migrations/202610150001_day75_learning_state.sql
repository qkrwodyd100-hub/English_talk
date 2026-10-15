-- Day 61-75 support for shared learning-state validation.
--
-- The app course grew from 60 to 75 days (MAX_COURSE_DAY = 75), but the
-- original private.is_valid_learning_state() still caps custom-sentence days,
-- dayPositions keys, study-activity days, and selectedDay at 60. Any client
-- state touching Day 61+ then fails the learning_group_profiles CHECK and
-- every upload surfaces as a generic sync failure. This migration widens the
-- cap to 75 without touching table grants, RLS policies, or the RPC.
--
-- Apply once in Supabase Dashboard -> SQL Editor -> New query, then Run.
-- Expected: `Success. No rows returned`.
-- Rerunnable: yes (CREATE OR REPLACE FUNCTION only).

begin;

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
          and private.is_json_integer_between(item -> 'day', 1, 75)
          and item ->> 'source' = 'custom',
        false
      )
    )
    and not exists (
      select 1 from jsonb_each(state_value -> 'dayPositions') entry
      where entry.key !~ '^([1-9]|[1-6][0-9]|7[0-5])$'
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
          and private.is_json_integer_between(item -> 'day', 1, 75)
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
      or private.is_json_integer_between(state_value -> 'selectedDay', 1, 75)), false);
$$;

revoke all on function private.is_valid_learning_state(jsonb) from public, anon;

commit;
