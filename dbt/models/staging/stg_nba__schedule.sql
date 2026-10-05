-- The season schedule. The third character of the game id says what kind of game it is.
select
    game_id,
    game_date,
    game_datetime_utc,
    season,
    case substring(game_id from 3 for 1)
        when '1' then 'Preseason'
        when '2' then 'Regular Season'
        when '3' then 'All-Star'
        when '4' then 'Playoffs'
        when '5' then 'Play-In'
        when '6' then 'NBA Cup Final'
        else 'Other'
    end as season_type,
    game_status,
    game_status = 3 as is_final,
    game_status_text,
    nullif(game_label, '') as game_label,
    home_team_id,
    home_team_tricode as home_team,
    home_score,
    away_team_id,
    away_team_tricode as away_team,
    away_score,
    arena_name
from {{ source('raw', 'schedule') }}
