-- Does rest change results? One row per season x rest situation x opponent strength x home/away.
-- Only regular season games, because playoff schedules are built differently.
-- The columns games, wins and point_diff_total can be added up, so the dashboard can
-- regroup rows (for example all seasons together) and recompute win % from the totals.
with games as (
    select
        team.season,
        team.is_home,
        team.is_win,
        team.plus_minus,
        -- Cap rest at 3 so "3" means "3 or more days". Long gaps (the 2020 pause) stay out of the way.
        least(team.days_rest, 3) as team_rest_days,
        least(team.opponent_days_rest, 3) as opponent_rest_days,
        -- Opponent strength = opponent's win % before this game.
        -- Early season records are noisy, so we need at least 10 games before we trust them.
        case
            when opp.games_before < 10 then 'Unknown'
            when opp.win_pct_before >= 0.55 then 'Strong'
            when opp.win_pct_before <= 0.45 then 'Weak'
            else 'Average'
        end as opponent_strength
    from {{ ref('fct_team_game') }} as team
    inner join {{ ref('int_team_game_strength') }} as opp
        on team.game_id = opp.game_id
        and team.team_id <> opp.team_id
    where team.season_type = 'Regular Season'
        and team.days_rest is not null            -- a team's first game of a season has no rest value
        and team.opponent_days_rest is not null
)

select
    season,
    team_rest_days,
    opponent_rest_days,
    opponent_strength,
    is_home,
    count(*) as games,
    sum(is_win::int) as wins,
    round(avg(is_win::int), 3) as win_pct,
    sum(plus_minus) as point_diff_total,
    round(avg(plus_minus), 2) as avg_point_diff
from games
group by season, team_rest_days, opponent_rest_days, opponent_strength, is_home
