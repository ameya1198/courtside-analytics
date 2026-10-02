-- Raw tables. Data is stored exactly as the NBA API returns it (lowercase names).
-- We add three columns of our own: season, season_type, loaded_at.
-- No primary keys here on purpose: dbt tests will catch duplicates in Phase 2.

create table if not exists raw.teams (
    id            bigint,
    full_name     text,
    abbreviation  text,
    nickname      text,
    city          text,
    state         text,
    year_founded  integer,
    loaded_at     timestamptz not null default now()
);

create table if not exists raw.players (
    id          bigint,
    full_name   text,
    first_name  text,
    last_name   text,
    is_active   boolean,
    loaded_at   timestamptz not null default now()
);

-- One row per player per game.
create table if not exists raw.player_game_logs (
    season_id          text,
    player_id          bigint,
    player_name        text,
    team_id            bigint,
    team_abbreviation  text,
    team_name          text,
    game_id            text,
    game_date          date,
    matchup            text,
    wl                 text,
    min                numeric,
    fgm                integer,
    fga                integer,
    fg_pct             numeric,
    fg3m               integer,
    fg3a               integer,
    fg3_pct            numeric,
    ftm                integer,
    fta                integer,
    ft_pct             numeric,
    oreb               integer,
    dreb               integer,
    reb                integer,
    ast                integer,
    stl                integer,
    blk                integer,
    tov                integer,
    pf                 integer,
    pts                integer,
    plus_minus         numeric,
    fantasy_pts        numeric,
    video_available    integer,
    season             integer not null,   -- start year, 2025 means 2025-26
    season_type        text    not null,   -- Regular Season or Playoffs
    loaded_at          timestamptz not null default now()
);

-- One row per team per game.
create table if not exists raw.team_game_logs (
    season_id          text,
    team_id            bigint,
    team_abbreviation  text,
    team_name          text,
    game_id            text,
    game_date          date,
    matchup            text,
    wl                 text,
    min                numeric,
    fgm                integer,
    fga                integer,
    fg_pct             numeric,
    fg3m               integer,
    fg3a               integer,
    fg3_pct            numeric,
    ftm                integer,
    fta                integer,
    ft_pct             numeric,
    oreb               integer,
    dreb               integer,
    reb                integer,
    ast                integer,
    stl                integer,
    blk                integer,
    tov                integer,
    pf                 integer,
    pts                integer,
    plus_minus         numeric,
    video_available    integer,
    season             integer not null,
    season_type        text    not null,
    loaded_at          timestamptz not null default now()
);

-- Loads delete by season and season type first, so index those.
create index if not exists player_logs_season_idx on raw.player_game_logs (season, season_type);
create index if not exists team_logs_season_idx   on raw.team_game_logs (season, season_type);

-- Raw data is only touched by the loader, never through the public API.
alter table raw.teams            enable row level security;
alter table raw.players          enable row level security;
alter table raw.player_game_logs enable row level security;
alter table raw.team_game_logs   enable row level security;
