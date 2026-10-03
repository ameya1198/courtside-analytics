-- Where does each player shoot from, and how well? One row per player per season per zone.
-- Compare with league_fg_pct to see if a player is better or worse than average from that spot.
with player_zones as (
    select
        player_id,
        player_name,
        season,
        season_label,
        season_type,
        shot_zone_basic,
        count(*) as fga,
        sum(is_made::int) as fgm,
        sum(points) as points
    from {{ ref('fct_shots') }}
    group by player_id, player_name, season, season_label, season_type, shot_zone_basic
)

select
    *,
    round(fgm::numeric / fga, 3) as fg_pct,
    round(points::numeric / fga, 3) as points_per_shot,
    -- Share of this player's shots that came from this zone
    round(fga::numeric / sum(fga) over (partition by player_id, season, season_type), 3) as share_of_shots,
    -- League average from the same zone (add up every player in the zone first)
    round(
        (sum(fgm) over (partition by season, season_type, shot_zone_basic))::numeric
        / sum(fga) over (partition by season, season_type, shot_zone_basic),
        3
    ) as league_fg_pct
from player_zones
