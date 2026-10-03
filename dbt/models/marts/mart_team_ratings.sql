-- One row per team per season per season type, with the standard team strength numbers.
-- Ratings are "points per 100 possessions", which lets fast and slow teams be compared fairly.
-- Possessions are estimated: shots + 0.44 x free throws - offensive rebounds + turnovers.
with games as (
    -- Put each team's game next to its opponent's game, so we can measure defense too.
    select
        team.team_id,
        team.team_abbreviation,
        team.team_name,
        team.conference,
        team.season,
        team.season_label,
        team.season_type,
        team.is_win,
        team.pts,
        team.minutes_played,
        team.fga + 0.44 * team.fta - team.oreb + team.tov as possessions,
        opp.pts as opp_pts,
        opp.fga + 0.44 * opp.fta - opp.oreb + opp.tov as opp_possessions
    from {{ ref('fct_team_game') }} as team
    inner join {{ ref('fct_team_game') }} as opp
        on team.game_id = opp.game_id
        and team.team_id <> opp.team_id
),

season_totals as (
    select
        team_id,
        team_abbreviation,
        team_name,
        conference,
        season,
        season_label,
        season_type,
        count(*) as games,
        sum(is_win::int) as wins,
        round(avg(pts), 1) as pts_per_game,
        round(avg(opp_pts), 1) as opp_pts_per_game,
        round(100 * sum(pts) / sum(possessions), 1) as off_rating,
        round(100 * sum(opp_pts) / sum(opp_possessions), 1) as def_rating,
        -- Pace = possessions per 48 minutes. Team minutes are 5 players x game length, so divide by 5.
        round(48 * sum((possessions + opp_possessions) / 2) / sum(minutes_played / 5), 1) as pace
    from games
    group by team_id, team_abbreviation, team_name, conference, season, season_label, season_type
)

select
    *,
    games - wins as losses,
    round(wins::numeric / games, 3) as win_pct,
    round(off_rating - def_rating, 1) as net_rating,
    -- Rank 1 = best net rating, within the same season and season type.
    rank() over (
        partition by season, season_type
        order by off_rating - def_rating desc
    ) as net_rating_rank
from season_totals
