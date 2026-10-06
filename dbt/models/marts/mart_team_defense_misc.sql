-- How opponents score against each team, per game, with a league rank for each.
-- Rank 1 = fewest points allowed that way.
with misc as (
    select *
    from {{ ref('stg_nba__team_defense_misc') }}
)

select
    misc.team_id,
    teams.team_abbreviation,
    misc.team_name,
    misc.season,
    misc.season_label,
    misc.season_type,
    misc.games,
    misc.opp_pts_off_tov,
    misc.opp_pts_2nd_chance,
    misc.opp_pts_fb,
    misc.opp_pts_paint,
    rank() over (partition by misc.season, misc.season_type order by misc.opp_pts_off_tov)::int as opp_pts_off_tov_rank,
    rank() over (partition by misc.season, misc.season_type order by misc.opp_pts_2nd_chance)::int as opp_pts_2nd_chance_rank,
    rank() over (partition by misc.season, misc.season_type order by misc.opp_pts_fb)::int as opp_pts_fb_rank,
    rank() over (partition by misc.season, misc.season_type order by misc.opp_pts_paint)::int as opp_pts_paint_rank
from misc
left join {{ ref('dim_team') }} as teams
    on misc.team_id = teams.team_id
