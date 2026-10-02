-- Run once in the Supabase SQL editor.
-- Layers: raw (as loaded) > staging (dbt views) > marts (dbt tables).

create schema if not exists raw;
create schema if not exists staging;
create schema if not exists marts;

-- Tracks every ingestion run so freshness and failures are queryable.
create table if not exists raw.ingestion_log (
    run_id        bigint generated always as identity primary key,
    source        text        not null,           -- e.g. player_game_logs
    season        text,                           -- e.g. 2025-26
    started_at    timestamptz not null default now(),
    finished_at   timestamptz,
    rows_loaded   integer,
    status        text        not null default 'running'
                  check (status in ('running', 'success', 'failed')),
    error_message text
);

create index if not exists ingestion_log_source_idx
    on raw.ingestion_log (source, started_at desc);

-- The dashboard connects with a read-only role, never the admin login.
-- Set a real password before running this block, then store it in the dashboard env.
-- create role dashboard_reader login password 'CHANGE_ME';
-- grant usage on schema marts to dashboard_reader;
-- alter default privileges in schema marts grant select on tables to dashboard_reader;
