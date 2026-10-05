-- Player totals in clutch time: the last 5 minutes of a game with the score within 5 points.
select
    player_id,
    player_name,
    team_id,
    team_abbreviation,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    gp as games,
    w as wins,
    l as losses,
    min as minutes,
    pts,
    fgm,
    fga,
    fg3m,
    fg3a,
    ftm,
    fta,
    ast,
    tov,
    plus_minus
from {{ source('raw', 'player_clutch') }}
