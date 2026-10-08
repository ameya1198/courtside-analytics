-- Current rosters: one row per team x player for a season, as of the last load.
select
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    team_id,
    team_abbreviation,
    player_id,
    player_name,
    nullif(position, '') as position,
    age,
    -- 'R' = rookie
    case when experience = 'R' then 0 else nullif(experience, '')::int end as years_in_league
from {{ source('raw', 'team_rosters') }}
