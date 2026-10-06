-- Raw tables for individual and team defense (Defense tab, phase 2).
-- Loaders delete and reload by season and season type, so re-runs never duplicate rows.
-- Loaded for 2024-25 onward only: on/off and tracking data add up, and the free tier is 500 MB.

-- Team results with each player on and off the court. One row per team x player x on/off.
-- Ratings are points per 100 possessions. Source: TeamPlayerOnOffSummary, one call per team.
create table if not exists raw.player_on_off (
    team_id            bigint,
    team_abbreviation  text,
    player_id          bigint,
    player_name        text,          -- "Last, First" as the API sends it
    court_status       text,          -- 'on' or 'off'
    gp                 integer,
    min                numeric,       -- team minutes in that state
    plus_minus         numeric,
    off_rating         numeric,
    def_rating         numeric,
    net_rating         numeric,
    season             integer not null,   -- start year, 2025 means 2025-26
    season_type        text    not null,
    loaded_at          timestamptz not null default now()
);

-- Shots a player defended: opponent FG% when he was the closest defender, against what
-- those shooters usually hit. One row per player x category. Source: LeagueDashPtDefend.
create table if not exists raw.player_defended_shots (
    player_id          bigint,
    player_name        text,
    team_id            bigint,        -- his last team that season
    team_abbreviation  text,
    player_position    text,
    gp                 integer,
    freq               numeric,       -- share of his defended shots in this category
    d_fgm              numeric,
    d_fga              numeric,
    d_fg_pct           numeric,       -- opponent FG% when he defends
    normal_fg_pct      numeric,       -- those shooters' usual FG%
    pct_plusminus      numeric,       -- d_fg_pct minus normal_fg_pct. Negative is good defense
    category           text,          -- 'Overall', '3 Pointers' or 'Less Than 6Ft'
    season             integer not null,
    season_type        text    not null,
    loaded_at          timestamptz not null default now()
);

-- Hustle stats, season totals. One row per player. Source: LeagueHustleStatsPlayer.
create table if not exists raw.player_hustle (
    player_id                  bigint,
    player_name                text,
    team_id                    bigint,
    team_abbreviation          text,
    g                          integer,
    min                        numeric,
    contested_shots            numeric,
    contested_shots_2pt        numeric,
    contested_shots_3pt        numeric,
    deflections                numeric,
    charges_drawn              numeric,
    loose_balls_recovered      numeric,
    def_loose_balls_recovered  numeric,
    def_boxouts                numeric,
    season                     integer not null,
    season_type                text    not null,
    loaded_at                  timestamptz not null default now()
);

-- How opponents score against each team, per game. Source: LeagueDashTeamStats, measure type Misc.
create table if not exists raw.team_defense_misc (
    team_id             bigint,
    team_name           text,
    gp                  integer,
    opp_pts_off_tov     numeric,   -- points off our turnovers
    opp_pts_2nd_chance  numeric,   -- second-chance points
    opp_pts_fb          numeric,   -- fast-break points
    opp_pts_paint       numeric,   -- points in the paint
    season              integer not null,
    season_type         text    not null,
    loaded_at           timestamptz not null default now()
);

create index if not exists player_on_off_season_idx on raw.player_on_off (season, season_type);
create index if not exists player_defended_shots_season_idx on raw.player_defended_shots (season, season_type);
create index if not exists player_hustle_season_idx on raw.player_hustle (season, season_type);
create index if not exists team_defense_misc_season_idx on raw.team_defense_misc (season, season_type);
-- The Defense page joins shots to one team's games by game_id. Without this it scans every shot,
-- which pushed cold page loads past the 10 second query limit.
create index if not exists shots_game_idx on raw.shots (game_id);

alter table raw.player_on_off enable row level security;
alter table raw.player_defended_shots enable row level security;
alter table raw.player_hustle enable row level security;
alter table raw.team_defense_misc enable row level security;
