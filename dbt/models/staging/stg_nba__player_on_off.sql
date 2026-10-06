-- Team ratings with each player on and off the court, per team, season and season type.
-- One row per team x player x on/off. Ratings are points per 100 possessions.
select
    team_id,
    team_abbreviation,
    player_id,
    -- The API sends "Last, First". Flip it so names match the rest of the warehouse.
    case when player_name like '%, %'
        then split_part(player_name, ', ', 2) || ' ' || split_part(player_name, ', ', 1)
        else player_name end as player_name,
    court_status,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    gp as games,
    min as minutes,
    off_rating,
    def_rating,
    net_rating
from {{ source('raw', 'player_on_off') }}
