-- Raw shots: one row per shot attempt (made or missed), as the NBA shot chart API returns it.
-- Small number types (smallint) keep this table compact on the 500 MB free tier.
-- We skip player and team names on purpose: dbt joins those in from the dimension tables.

create table if not exists raw.shots (
    game_id            text,
    game_event_id      integer,    -- order of the event inside the game; with game_id it identifies a shot
    player_id          bigint,
    team_id            bigint,
    period             smallint,   -- 1-4, then 5+ for overtime
    minutes_remaining  smallint,
    seconds_remaining  smallint,
    event_type         text,       -- Made Shot or Missed Shot
    action_type        text,       -- Jump Shot, Driving Layup Shot, Dunk Shot, ...
    shot_type          text,       -- 2PT Field Goal or 3PT Field Goal
    shot_zone_basic    text,       -- Restricted Area, Mid-Range, Above the Break 3, ...
    shot_zone_area     text,       -- Left Side, Center, Right Side, ...
    shot_zone_range    text,       -- Less Than 8 ft., 8-16 ft., 24+ ft., ...
    shot_distance      smallint,   -- feet from the basket
    loc_x              smallint,   -- court position in tenths of a foot, 0 = centre line of the hoop
    loc_y              smallint,   -- tenths of a foot out from the baseline (hoop is near 0)
    shot_made_flag     smallint,   -- 1 = made, 0 = missed
    game_date          date,
    season             integer not null,   -- start year, 2025 means 2025-26
    season_type        text    not null,   -- Regular Season or Playoffs
    loaded_at          timestamptz not null default now()
);

-- Loads delete by season, season type and date range, so index those.
create index if not exists shots_season_date_idx on raw.shots (season, season_type, game_date);

-- Raw data is only touched by the loader, never through the public API.
alter table raw.shots enable row level security;
