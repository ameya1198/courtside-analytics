-- Current team rosters (Roster Needs page): who is on each team right now, after summer trades and signings.
-- One row per team x player for a season. The loader replaces a season's rows each run, so it always
-- matches today's rosters. Players who played last season but are on no roster are free agents.
-- Source: CommonTeamRoster, one call per team.
create table if not exists raw.team_rosters (
    season             integer not null,   -- start year, 2026 means 2026-27
    team_id            bigint  not null,
    team_abbreviation  text,
    player_id          bigint  not null,
    player_name        text,
    position           text,               -- 'G', 'F-C' and so on
    age                numeric,
    experience         text,               -- years in the league; 'R' for rookies
    loaded_at          timestamptz not null default now()
);

create index if not exists team_rosters_season_idx on raw.team_rosters (season);

alter table raw.team_rosters enable row level security;
