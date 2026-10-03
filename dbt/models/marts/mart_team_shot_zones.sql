-- A team's shot diet: where its shots come from and how well they go in. One row per team, season, zone.
-- Teams that take more rim and corner threes (and fewer mid-range shots) usually score more efficiently.
with team_zones as (
    select
        team_id,
        team_abbreviation,
        season,
        season_label,
        season_type,
        shot_zone_basic,
        count(*) as fga,
        sum(is_made::int) as fgm,
        sum(points) as points
    from {{ ref('fct_shots') }}
    group by team_id, team_abbreviation, season, season_label, season_type, shot_zone_basic
)

select
    *,
    round(fgm::numeric / fga, 3) as fg_pct,
    round(points::numeric / fga, 3) as points_per_shot,
    round(fga::numeric / sum(fga) over (partition by team_id, season, season_type), 3) as share_of_shots
from team_zones
