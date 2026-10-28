-- STEP 1 of 2 — run this ALONE first, then run step 2.
-- Adds the new "Lead Acquisition Manager" role.
alter type user_role add value if not exists 'acquisition_manager';
