-- One row per player per season type: scoring and shooting in clutch time.
select
    player_id,
    player_name,
    team_abbreviation,
    season,
    season_label,
    season_type,
    games,
    wins,
    losses,
    round(minutes, 1) as minutes,
    pts,
    {{ true_shooting_pct('pts', 'fga', 'fta') }} as ts_pct,
    round(fgm::numeric / nullif(fga, 0), 3) as fg_pct,
    ast,
    tov,
    plus_minus,
    rank() over (partition by season, season_type order by pts desc) as pts_rank
from {{ ref('stg_nba__player_clutch') }}
