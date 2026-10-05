-- Team totals in clutch time: the last 5 minutes of a game with the score within 5 points.
select
    team_id,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    gp as games,
    w as wins,
    l as losses,
    min as minutes,
    pts,
    plus_minus,
    -- Estimated possessions, the same formula the team ratings use
    fga + 0.44 * fta - oreb + tov as possessions
from {{ source('raw', 'team_clutch') }}
