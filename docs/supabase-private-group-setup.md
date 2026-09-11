# Private learning-group setup

This setup deliberately keeps member email addresses out of Git, the frontend bundle, screenshots, and Vite environment variables. Enter the two real addresses only in the private Supabase SQL Editor query described below.

## 1. Confirm the two Auth users

1. Open Supabase Dashboard → **Authentication** → **Users**.
2. Confirm both intended addresses appear exactly once and show a confirmed email.
3. Do not continue while an address is missing, misspelled, duplicated, or unconfirmed. Request and open a Magic Link on that account first.

## 2. Apply the schema migration

Minimal one-click path: in one new private SQL Editor query, paste the complete migration first, append the operator query from section 3, replace the two placeholders, and select **Run** once. The migration is rerunnable and the account-link operation is atomic. The separate steps below make the same checks easier to inspect.

1. Open **SQL Editor** → **New query**.
2. Open `supabase/migrations/202608150001_private_learning_groups.sql` locally and paste its complete contents.
3. Select **Run**. The result must be `Success. No rows returned`.
4. Run this readback query:

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in ('learning_groups', 'learning_group_members', 'learning_group_profiles')
order by tablename;
```

Expected: exactly three rows and `rowsecurity = true` for every row.

## 3. Privately seed one group

Create a second **New query**. Open `supabase/operations/link-two-learning-accounts.sql`, replace its two placeholders with the intended addresses, and paste it into SQL Editor. Do not save, share, screenshot, or commit the populated query.

The operation is atomic and safe to rerun with the same pair. It refuses to proceed unless there are exactly two distinct confirmed Auth users and their existing memberships are compatible. It privately backs up zero, one, or two legacy `learning_profiles` rows without deleting them. When both rows exist, the higher revision wins positional values (then newer `updated_at`, then placeholder order as a deterministic tie-break), while sets, history, notes, and custom content are merged with the same precedence as the app's `mergeLearningStates` function. Invalid legacy JSON or a partially conflicting membership aborts the whole transaction.

```sql
select *
from private.link_two_learning_accounts(
  '<MEMBER_EMAIL_1>',
  '<MEMBER_EMAIL_2>'
);
```

Expected: one row with `member_count = 2`, `profile_count = 1`, and `backed_up_legacy_count` from `0` through `2`. If it raises an exception, no group, membership, backup, or profile change from the account-link operation is committed.

## 4. Read back without exposing emails

Re-run the same private operation query with the same two placeholders populated. This is a read-only no-op for an already linked pair and scopes the readback to those exact accounts. Keep only the three counts, not the group ID or user identifiers:

```sql
select *
from private.link_two_learning_accounts(
  '<MEMBER_EMAIL_1>',
  '<MEMBER_EMAIL_2>'
);
```

Expected: `member_count = 2`; `profile_count = 1`; `backed_up_legacy_count` is `0`, `1`, or `2` and equals the number of preserved legacy rows.

Security behavior: members can select and initially insert their shared profile, but updates must use the membership-checked `update_learning_group_profile` compare-and-swap RPC. Direct table updates and deletes are not granted. Oversized or structurally malformed learning-state JSON is rejected by the database.

## 5. Verify on the two devices/accounts

1. On each device, request and open its own Magic Link on that same device. Confirm the panel shows the expected current account and **클라우드 동기화됨**.
2. On account/device A, add a harmless custom sentence. On B, press **지금 동기화** and confirm it appears; add a different sentence on B. On A, press **지금 동기화** and confirm both remain.
3. Sign out on B and confirm the shared sentences disappear from that device's signed-out account view. A non-member account must show **공유 그룹에 등록되지 않은 계정** and must not read or write the group profile.
