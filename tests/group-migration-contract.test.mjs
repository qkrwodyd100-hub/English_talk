import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const migrationUrl = new URL('../supabase/migrations/202608150001_private_learning_groups.sql', import.meta.url)
const operatorUrl = new URL('../supabase/operations/link-two-learning-accounts.sql', import.meta.url)
const setupGuideUrl = new URL('../docs/supabase-private-group-setup.md', import.meta.url)

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
  assert.match(sql, /length\(attempt ->> 'attempt'\) <= 2000/i)
  assert.match(sql, /function public\.update_learning_group_profile\([\s\S]+expected_revision bigint[\s\S]+where[\s\S]+profile\.revision = expected_revision/i)
  assert.doesNotMatch(sql, /grant\s+update\s+on\s+public\.learning_group_profiles/i, 'updates must go through the compare-and-swap function')
  assert.match(sql, /create table if not exists public\.learning_groups/i, 'the migration must be safe to rerun')
  assert.match(sql, /function private\.merge_learning_states\(current_state jsonb, backup_state jsonb\)/i)
  assert.match(sql, /function private\.link_two_learning_accounts\(member_email_1 text, member_email_2 text\)/i)
  assert.match(sql, /Exactly two distinct member emails are required/i)
  assert.match(sql, /private\.merge_learning_states\(/i)
  assert.match(sql, /from public\.learning_profiles[\s\S]+for update/i, 'legacy rows must be locked before backup and merge')
  assert.match(sql, /count\(account\.id\)\s*<>\s*1/i, 'each requested email must resolve to exactly one confirmed Auth user')
  assert.match(sql, /value is null[\s\S]+private\.is_canonical_timestamp/i, 'missing timestamps must be rejected')
})

test('two-account operator packet is generic and keeps identifiers private', async () => {
  const sql = await readFile(operatorUrl, 'utf8')
  assert.doesNotMatch(sql, /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/, 'operator packet must not contain an email address')
  assert.match(sql, /<MEMBER_EMAIL_1>/)
  assert.match(sql, /<MEMBER_EMAIL_2>/)
  assert.doesNotMatch(sql, /<MEMBER_EMAIL_3>/)
  assert.match(sql, /private\.link_two_learning_accounts\(/i)
  assert.match(sql, /member_count\s*=\s*2/i)
  assert.match(sql, /profile_count\s*=\s*1/i)
  assert.match(sql, /backed_up_legacy_count\s+between\s+0\s+and\s+2/i)
})

test('operator readback stays scoped to the requested pair', async () => {
  const guide = await readFile(setupGuideUrl, 'utf8')
  assert.doesNotMatch(guide, /order by max\(groups\.created_at\) desc/i, 'global latest-group lookup can report another group')
  assert.match(guide, /private\.link_two_learning_accounts\([\s\S]+<MEMBER_EMAIL_1>[\s\S]+<MEMBER_EMAIL_2>/i)
})
