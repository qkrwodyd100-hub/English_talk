# Private learning-group setup

This setup deliberately keeps member email addresses out of Git, the frontend bundle, screenshots, and Vite environment variables. Enter the three real addresses only in the private Supabase SQL Editor query described below.

## 1. Confirm the three Auth users

1. Open Supabase Dashboard → **Authentication** → **Users**.
2. Confirm all three intended addresses appear exactly once and show a confirmed email.
3. Do not continue while an address is missing, misspelled, duplicated, or unconfirmed. Request and open a Magic Link on that account first.

## 2. Apply the schema migration

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

Create a second **New query**. Replace the three placeholders in the first array with the intended addresses. Do not save, share, screenshot, or commit the populated query.

The block is atomic. It refuses to proceed unless there are exactly three distinct confirmed Auth users, none is already in a group, and at most one legacy `learning_profiles` row exists. A legacy row is copied into a private backup table and then into the shared group profile; the old row is not deleted.

```sql
do $$
declare
  target_emails text[] := array[
    '<MEMBER_EMAIL_1>',
    '<MEMBER_EMAIL_2>',
    '<MEMBER_EMAIL_3>'
  ];
  target_user_ids uuid[];
  new_group_id uuid;
  legacy_count integer;
begin
  if cardinality(target_emails) <> 3
     or (select count(distinct lower(value)) from unnest(target_emails) value) <> 3 then
    raise exception 'Exactly three distinct member emails are required';
  end if;

  select array_agg(user_id order by member_order)
  into target_user_ids
  from (
    select requested.member_order, account.id as user_id
    from unnest(target_emails) with ordinality requested(email, member_order)
    join auth.users account on lower(account.email) = lower(requested.email)
    where account.email_confirmed_at is not null
  ) confirmed;

  if coalesce(cardinality(target_user_ids), 0) <> 3 then
    raise exception 'All three exact Auth users must exist and have confirmed emails';
  end if;

  if exists (
    select 1 from public.learning_group_members
    where user_id = any(target_user_ids)
  ) then
    raise exception 'At least one target user already belongs to a learning group';
  end if;

  select count(*) into legacy_count
  from public.learning_profiles
  where user_id = any(target_user_ids);

  if legacy_count > 1 then
    raise exception 'More than one legacy profile exists; stop and merge the exported backups before seeding';
  end if;

  insert into public.learning_groups(created_by)
  values (target_user_ids[1])
  returning id into new_group_id;

  insert into private.learning_profile_migration_backups(
    group_id, source_user_id, learning_state, revision, updated_at
  )
  select new_group_id, user_id, learning_state, revision, updated_at
  from public.learning_profiles
  where user_id = any(target_user_ids);

  insert into public.learning_group_profiles(
    group_id, learning_state, revision, updated_at
  )
  select new_group_id, learning_state, revision, updated_at
  from public.learning_profiles
  where user_id = any(target_user_ids)
  order by updated_at desc
  limit 1;

  insert into public.learning_group_members(group_id, user_id)
  select new_group_id, member.user_id
  from unnest(target_user_ids) as member(user_id);
end
$$;
```

Expected: `Success. No rows returned`. If it raises an exception, no group, membership, backup, or profile change from this block is committed.

## 4. Read back without exposing emails

Run this query and keep only the counts, not user identifiers:

```sql
select
  groups.id as group_id,
  count(distinct members.user_id) as member_count,
  count(distinct profiles.group_id) as profile_count,
  count(distinct backups.source_user_id) as backed_up_legacy_count
from public.learning_groups groups
join public.learning_group_members members on members.group_id = groups.id
left join public.learning_group_profiles profiles on profiles.group_id = groups.id
left join private.learning_profile_migration_backups backups on backups.group_id = groups.id
group by groups.id
order by max(groups.created_at) desc
limit 1;
```

Expected: `member_count = 3`; `profile_count = 1` when a legacy profile existed, otherwise `0`; `backed_up_legacy_count` equals the number of migrated legacy rows.

Security behavior: members can select and initially insert their shared profile, but updates must use the membership-checked `update_learning_group_profile` compare-and-swap RPC. Direct table updates and deletes are not granted. Oversized or structurally malformed learning-state JSON is rejected by the database.

## 5. Verify on the three devices/accounts

1. On each device, request and open its own Magic Link on that same device. Confirm the panel shows the expected current account and **클라우드 동기화됨**.
2. On account/device A, add a harmless custom sentence. On B, press **지금 동기화** and confirm it appears; add a different sentence on B. On A, press **지금 동기화** and confirm both remain. Repeat the read on C.
3. Sign out on C and confirm the shared sentences disappear from that device's local signed-out view. A non-member account must show **공유 그룹에 등록되지 않은 계정** and must not read or write the group profile.
