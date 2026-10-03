-- Read-only role for the dashboard. Applied in Supabase as migration 005_reader_role.
-- The password is set separately in the Supabase SQL editor and never committed:
--   alter role courtside_reader with password '...';
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'courtside_reader') then
    create role courtside_reader login;
  end if;
end $$;

grant usage on schema marts to courtside_reader;
grant select on all tables in schema marts to courtside_reader;
-- dbt recreates tables on every build, so new tables must inherit the grant.
alter default privileges for role postgres in schema marts grant select on tables to courtside_reader;
