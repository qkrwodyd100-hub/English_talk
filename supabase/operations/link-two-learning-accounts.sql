-- Run only in the private Supabase SQL Editor after applying the migration.
-- Replace both placeholders in this unsaved query. Never commit or screenshot the populated query.

select *
from private.link_two_learning_accounts(
  '<MEMBER_EMAIL_1>',
  '<MEMBER_EMAIL_2>'
);

-- Success requires member_count = 2, profile_count = 1,
-- and backed_up_legacy_count between 0 and 2.
-- Re-running with the same two accounts is a read-only no-op that returns the same group counts.
