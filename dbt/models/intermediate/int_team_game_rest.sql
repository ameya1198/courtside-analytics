-- How much rest each team had before a game, and how much its opponent had.
-- days_rest is the number of full days off. 0 means a back-to-back.
-- It is blank for a team's first game of a season.
with team_games as (
    select
        game_id,
        team_id,
        game_date,
        -- lag() looks at the previous row. Here: the same team's previous game this season.
        lag(game_date) over (
            partition by team_id, season
            order by game_date
        ) as previous_game_date
    from {{ ref('stg_nba__team_game_logs') }}
),

with_rest as (
    select
        game_id,
        team_id,
        game_date - previous_game_date - 1 as days_rest
    from team_games
)

select
    team.game_id,
    team.team_id,
    team.days_rest,
    coalesce(team.days_rest = 0, false) as is_back_to_back,
    opponent.days_rest as opponent_days_rest,
    -- Positive means this team was more rested than its opponent
    team.days_rest - opponent.days_rest as rest_advantage
from with_rest as team
-- Every game has two rows, one per team. The other row is the opponent.
left join with_rest as opponent
    on team.game_id = opponent.game_id
    and team.team_id <> opponent.team_id
