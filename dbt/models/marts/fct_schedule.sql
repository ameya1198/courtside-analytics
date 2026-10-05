-- One row per scheduled game (regular season, play-in, playoffs, NBA Cup final), played or not.
-- Adds each team's days of rest before the game, so upcoming back-to-backs are visible in advance.
with games as (
    select *
    from {{ ref('stg_nba__schedule') }}
    where season_type in ('Regular Season', 'Play-In', 'Playoffs', 'NBA Cup Final')
),

appearances as (
    -- One row per team per game, so each team's previous game can be found.
    -- Knockout games whose teams are not decided yet use team id 0 on both sides: leave them out.
    select game_id, season, game_date, home_team_id as team_id from games where home_team_id <> 0
    union all
    select game_id, season, game_date, away_team_id as team_id from games where away_team_id <> 0
),

rest as (
    select
        game_id,
        team_id,
        game_date - lag(game_date) over (
            partition by team_id, season order by game_date
        ) - 1 as days_rest
    from appearances
)

select
    games.game_id,
    games.game_date,
    games.game_datetime_utc,
    games.season,
    games.season || '-' || right((games.season + 1)::text, 2) as season_label,
    games.season_type,
    games.game_label,
    games.game_status,
    games.is_final,
    games.game_status_text,
    games.home_team_id,
    games.home_team,
    games.home_score,
    home_rest.days_rest as home_days_rest,
    coalesce(home_rest.days_rest = 0, false) as home_back_to_back,
    games.away_team_id,
    games.away_team,
    games.away_score,
    away_rest.days_rest as away_days_rest,
    coalesce(away_rest.days_rest = 0, false) as away_back_to_back,
    games.arena_name
from games
left join rest as home_rest
    on games.game_id = home_rest.game_id
    and games.home_team_id = home_rest.team_id
left join rest as away_rest
    on games.game_id = away_rest.game_id
    and games.away_team_id = away_rest.team_id
