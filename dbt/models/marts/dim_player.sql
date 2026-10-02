-- One row per player who appears in the game logs.
-- Built from the logs because the players list misses some recent rookies.
with logged_players as (
    -- Latest name per player, in case a name changed over the years
    select distinct on (player_id)
        player_id,
        player_name
    from {{ ref('stg_nba__player_game_logs') }}
    order by player_id, game_date desc
)

select
    logged_players.player_id,
    logged_players.player_name,
    players.is_active
from logged_players
left join {{ ref('stg_nba__players') }} as players
    on logged_players.player_id = players.player_id
