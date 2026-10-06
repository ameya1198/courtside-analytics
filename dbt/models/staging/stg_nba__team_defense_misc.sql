-- Points each team allows per game off turnovers, second chances, fast breaks and in the paint.
select
    team_id,
    team_name,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    gp as games,
    opp_pts_off_tov,
    opp_pts_2nd_chance,
    opp_pts_fb,
    opp_pts_paint
from {{ source('raw', 'team_defense_misc') }}
