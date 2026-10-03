-- How good was each team BEFORE each game? (wins and games played so far this season)
-- "Before" matters: using the full-season record would leak the future into the game.
select
    game_id,
    team_id,
    -- Window: all of this team's earlier games in the same season and season type.
    -- "1 preceding" stops just before the current game, so the current result is not counted.
    coalesce(count(*) over team_so_far, 0) as games_before,
    coalesce(sum(is_win::int) over team_so_far, 0) as wins_before,
    round(
        (sum(is_win::int) over team_so_far)::numeric
        / nullif(count(*) over team_so_far, 0),
        3
    ) as win_pct_before
from {{ ref('fct_team_game') }}
window team_so_far as (
    partition by team_id, season, season_type
    order by game_date, game_id
    rows between unbounded preceding and 1 preceding
)
