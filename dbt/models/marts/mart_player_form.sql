-- Player form: one row per player per game, with rolling averages that show who is hot or cold.
-- Only games with 10+ minutes count, so 2-minute garbage-time cameos do not distort averages.
-- Rolling windows stay inside one season and one season type.
-- A view, not a table: no page reads it, and as a table it took 54 MB of the 500 MB free tier
-- (room we use for shot charts). Make it a table again if a page starts querying it.
{{ config(materialized='view') }}

with played as (
    select
        game_id,
        player_id,
        player_name,
        team_id,
        team_abbreviation,
        game_date,
        season,
        season_label,
        season_type,
        minutes_played,
        pts,
        reb,
        ast,
        fga,
        fta
    from {{ ref('fct_player_game') }}
    where did_play
        and minutes_played >= 10
)

select
    game_id,
    player_id,
    player_name,
    team_id,
    team_abbreviation,
    game_date,
    season,
    season_label,
    season_type,
    minutes_played,
    pts,
    reb,
    ast,
    count(*) over season_to_date as games_played,

    -- Last 5 games (this game and the 4 before it)
    round(avg(pts) over last_5, 1) as pts_last_5,
    round(avg(reb) over last_5, 1) as reb_last_5,
    round(avg(ast) over last_5, 1) as ast_last_5,

    -- Last 10 games
    round(avg(pts) over last_10, 1) as pts_last_10,
    round(avg(reb) over last_10, 1) as reb_last_10,
    round(avg(ast) over last_10, 1) as ast_last_10,
    -- Shooting efficiency needs totals (not an average of game percentages), so sum first
    {{ true_shooting_pct('(sum(pts) over last_10)', '(sum(fga) over last_10)', '(sum(fta) over last_10)') }} as ts_pct_last_10,

    -- Season so far
    round(avg(pts) over season_to_date, 1) as pts_season,
    round(avg(reb) over season_to_date, 1) as reb_season,
    round(avg(ast) over season_to_date, 1) as ast_season,

    -- Positive = scoring more than their season norm lately (hot). Negative = cold.
    round(avg(pts) over last_5 - avg(pts) over season_to_date, 1) as pts_form_delta,

    -- True on each player's most recent game, so the dashboard can grab "current form" easily
    row_number() over (
        partition by player_id, season, season_type
        order by game_date desc, game_id desc
    ) = 1 as is_latest_game
from played
window
    season_to_date as (
        partition by player_id, season, season_type
        order by game_date, game_id
        rows between unbounded preceding and current row
    ),
    last_5 as (
        partition by player_id, season, season_type
        order by game_date, game_id
        rows between 4 preceding and current row
    ),
    last_10 as (
        partition by player_id, season, season_type
        order by game_date, game_id
        rows between 9 preceding and current row
    )
