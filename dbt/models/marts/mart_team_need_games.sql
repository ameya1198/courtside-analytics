-- One row per team per regular-season game: the counting stats behind the Roster Needs measures,
-- for the team and for its opponent that night. Season totals and rolling 10-game trends both add these up.
-- Rim shots (restricted area) come from the shot charts, so they are null for games without shot data.
with games as (
    select *
    from {{ ref('fct_team_game') }}
    where season_type = 'Regular Season'
),

rim as (
    select
        game_id,
        team_id,
        count(*) as rim_fga,
        sum(is_made::int) as rim_fgm
    from {{ ref('fct_shots') }}
    where season_type = 'Regular Season'
        and shot_zone_basic = 'Restricted Area'
    group by game_id, team_id
)

select
    team.game_id,
    team.team_id,
    team.team_abbreviation,
    team.season,
    team.season_label,
    team.game_date,
    row_number() over (partition by team.team_id, team.season order by team.game_date, team.game_id) as game_number,
    team.fga,
    team.fgm,
    team.fg3a,
    team.fg3m,
    team.fta,
    team.oreb,
    team.dreb,
    team.ast,
    team.tov,
    -- Possessions, estimated the same way as mart_team_ratings
    team.fga + 0.44 * team.fta - team.oreb + team.tov as poss,
    rim.rim_fga,
    rim.rim_fgm,
    opp.fga as opp_fga,
    opp.fg3a as opp_fg3a,
    opp.fg3m as opp_fg3m,
    opp.fta as opp_fta,
    opp.oreb as opp_oreb,
    opp.dreb as opp_dreb,
    opp.tov as opp_tov,
    opp.fga + 0.44 * opp.fta - opp.oreb + opp.tov as opp_poss,
    opp_rim.rim_fga as opp_rim_fga,
    opp_rim.rim_fgm as opp_rim_fgm
from games as team
inner join games as opp
    on team.game_id = opp.game_id
    and team.team_id <> opp.team_id
left join rim
    on team.game_id = rim.game_id
    and team.team_id = rim.team_id
left join rim as opp_rim
    on opp.game_id = opp_rim.game_id
    and opp.team_id = opp_rim.team_id
