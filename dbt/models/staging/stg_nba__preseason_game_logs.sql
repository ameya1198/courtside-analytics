-- Preseason player game logs. Separate from stg_nba__player_game_logs so preseason never mixes into the analysis.
select
    game_id,
    player_id,
    player_name,
    team_abbreviation,
    game_date,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    min as minutes_played,
    pts,
    reb,
    ast,
    stl,
    blk,
    tov,
    fgm,
    fga,
    fg3m,
    fg3a,
    ftm,
    fta,
    plus_minus
from {{ source('raw', 'preseason_game_logs') }}
where min > 0
