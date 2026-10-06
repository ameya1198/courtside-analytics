-- Advanced stats from Basketball-Reference team pages: Win Shares, Box Plus/Minus and VORP.
-- Loaded by `python -m ingestion.load --salaries` from the same pages as salaries (no extra requests).
-- One row per player x team x season (a traded player has a row for each team). Regular season only.
create table if not exists raw.player_advanced (
    season       integer not null,   -- start year, 2025 means 2025-26
    bbref_id     text,
    player_name  text,
    team         text,               -- Basketball-Reference team code (BRK, CHO, PHO...)
    player_id    bigint,             -- NBA id when the name matched
    age          numeric,
    games        integer,
    minutes      numeric,
    ows          numeric,            -- offensive win shares
    dws          numeric,            -- defensive win shares
    ws           numeric,            -- win shares (ows + dws)
    ws_per_48    numeric,
    obpm         numeric,            -- offensive box plus/minus
    dbpm         numeric,            -- defensive box plus/minus
    bpm          numeric,
    vorp         numeric,            -- value over replacement player
    loaded_at    timestamptz not null default now()
);

create index if not exists player_advanced_season_idx on raw.player_advanced (season);

alter table raw.player_advanced enable row level security;
