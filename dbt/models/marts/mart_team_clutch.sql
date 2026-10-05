-- One row per team per season type: how the team does when games are close late.
-- Clutch time = last 5 minutes of the 4th quarter or overtime, score within 5 points.
-- Clutch net rating = points scored minus allowed per 100 clutch possessions (estimated).
select
    clutch.team_id,
    teams.team_abbreviation,
    teams.team_name,
    clutch.season,
    clutch.season_label,
    clutch.season_type,
    clutch.games,
    clutch.wins,
    clutch.losses,
    round(clutch.wins::numeric / nullif(clutch.wins + clutch.losses, 0), 3) as win_pct,
    round(clutch.minutes, 1) as minutes,
    clutch.plus_minus,
    round(100 * clutch.plus_minus / nullif(clutch.possessions, 0), 1) as net_rating,
    rank() over (
        partition by clutch.season, clutch.season_type
        order by clutch.plus_minus / nullif(clutch.possessions, 0) desc nulls last
    ) as net_rating_rank,
    rank() over (
        partition by clutch.season, clutch.season_type
        order by clutch.wins::numeric / nullif(clutch.wins + clutch.losses, 0) desc nulls last
    ) as win_pct_rank
from {{ ref('stg_nba__team_clutch') }} as clutch
inner join {{ ref('dim_team') }} as teams
    on clutch.team_id = teams.team_id
