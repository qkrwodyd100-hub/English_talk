import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/202608150001_private_learning_groups.sql', import.meta.url)

test('learning group migration keeps membership private and enforced by RLS', async () => {
  const sql = await readFile(migrationUrl, 'utf8')
  assert.doesNotMatch(sql, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, 'migration must not contain private email addresses')
  assert.doesNotMatch(sql, /grant\s+.*\s+to\s+anon\b/i, 'anonymous users must not receive group access')
  assert.doesNotMatch(sql, /grant\s+[^;]*delete[^;]*learning_group_profiles/i, 'members must not be able to delete the shared profile')
  for (const table of ['learning_groups', 'learning_group_members', 'learning_group_profiles']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'))
  }
  assert.match(sql, /learning_group_members[\s\S]+unique\s*\(user_id\)/i)
  assert.match(sql, /private\.is_learning_group_member\(group_id\)/i)
  assert.match(sql, /for all[\s\S]+using \(private\.is_learning_group_member\(group_id\)\)[\s\S]+with check \(private\.is_learning_group_member\(group_id\)\)/i)
  assert.match(sql, /check \(private\.is_valid_learning_state\(learning_state\)\)/i)
  assert.match(sql, /grant execute on function private\.is_valid_learning_state\(jsonb\) to authenticated/i)
  assert.match(sql, /jsonb_array_elements\(state_value -> 'customSentences'\)[\s\S]+jsonb_each\(state_value -> 'answerHistory'\)/i)
  assert.match(sql, /private\.is_json_integer_between\(state_value -> 'selectedDay', 1, 60\)/i)
  assert.match(sql, /private\.is_json_integer_between\(item -> 'day', 1, 60\)/i)
  assert.match(sql, /private\.is_json_nonnegative_integer\(entry\.value\)/i)
  assert.match(sql, /private\.is_canonical_timestamp\(item ->> 'timestamp'\)/i)
  assert.match(sql, /jsonb_array_length\(entry\.value\) > 5/i)
  assert.match(sql, /length\(attempt ->> 'attempt'\) > 2000/i)
  assert.match(sql, /function public\.update_learning_group_profile\([\s\S]+expected_revision bigint[\s\S]+where[\s\S]+profile\.revision = expected_revision/i)
  assert.doesNotMatch(sql, /grant\s+update\s+on\s+public\.learning_group_profiles/i, 'updates must go through the compare-and-swap function')
})
