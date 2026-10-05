-- Extra raw tables: clutch splits, player bio (age), the season schedule and salaries.
-- All small. Loaders delete and reload by season, so re-runs never duplicate rows.

-- Team results in clutch time: last 5 minutes, score within 5 points. One row per team per season type.
create table if not exists raw.team_clutch (
    team_id      bigint,
    team_name    text,
    gp           integer,
    w            integer,
    l            integer,
    min          numeric,
    fgm integer, fga integer, fg3m integer, fg3a integer, ftm integer, fta integer,
    oreb integer, dreb integer, reb integer, ast integer, tov integer, stl integer, blk integer,
    pts          integer,
    plus_minus   numeric,
    season       integer not null,   -- start year, 2025 means 2025-26
    season_type  text    not null,
    loaded_at    timestamptz not null default now()
);

-- The same split per player.
create table if not exists raw.player_clutch (
    player_id    bigint,
    player_name  text,
    team_id      bigint,
    team_abbreviation text,
    gp           integer,
    w            integer,
    l            integer,
    min          numeric,
    fgm integer, fga integer, fg3m integer, fg3a integer, ftm integer, fta integer,
    reb integer, ast integer, tov integer, stl integer, blk integer,
    pts          integer,
    plus_minus   numeric,
    season       integer not null,
    season_type  text    not null,
    loaded_at    timestamptz not null default now()
);

-- Player bio per season: age, size, draft. Age is as of that season.
create table if not exists raw.player_bio (
    player_id            bigint,
    player_name          text,
    team_id              bigint,
    team_abbreviation    text,
    age                  numeric,
    player_height_inches integer,
    player_weight        integer,
    college              text,
    country              text,
    draft_year           text,
    draft_round          text,
    draft_number         text,
    season               integer not null,
    season_type          text    not null,
    loaded_at            timestamptz not null default now()
);

-- Every scheduled game of a season (preseason, regular season, play-in, playoffs), with scores once played.
create table if not exists raw.schedule (
    game_id             text,
    game_date           date,         -- US Eastern calendar date
    game_datetime_utc   timestamptz,  -- tip-off
    game_status         integer,      -- 1 scheduled, 2 live, 3 final
    game_status_text    text,
    game_label          text,         -- e.g. Emirates NBA Cup, Play-In, East First Round
    home_team_id        bigint,
    home_team_tricode   text,
    home_score          integer,
    away_team_id        bigint,
    away_team_tricode   text,
    away_score          integer,
    arena_name          text,
    season              integer not null,
    loaded_at           timestamptz not null default now()
);

-- Player salaries from Basketball-Reference. One row per player per season (a traded player can have two).
-- player_id is the NBA id when the name matched; bbref_id is Basketball-Reference's own id.
create table if not exists raw.salaries (
    season       integer not null,   -- start year of the season the salary is for
    bbref_id     text,
    player_name  text,
    team         text,               -- Basketball-Reference team code (BRK, CHO, PHO...)
    salary       bigint,
    player_id    bigint,
    source       text,               -- team_page (past seasons) or contracts_page (this and future seasons)
    loaded_at    timestamptz not null default now()
);

create index if not exists team_clutch_season_idx on raw.team_clutch (season, season_type);
create index if not exists player_clutch_season_idx on raw.player_clutch (season, season_type);
create index if not exists player_bio_season_idx on raw.player_bio (season, season_type);
create index if not exists schedule_season_idx on raw.schedule (season, game_date);
create index if not exists salaries_season_idx on raw.salaries (season, source);

alter table raw.team_clutch enable row level security;
alter table raw.player_clutch enable row level security;
alter table raw.player_bio enable row level security;
alter table raw.schedule enable row level security;
alter table raw.salaries enable row level security;
