-- One row per player who appears in the game logs.
-- Built from the logs because the players list misses some recent rookies.
with logged_players as (
    -- Latest name per player, in case a name changed over the years
    select distinct on (player_id)
        player_id,
        player_name
    from {{ ref('stg_nba__player_game_logs') }}
    order by player_id, game_date desc
),

player_seasons as (
    -- First and last season each player appeared in (start year, 2025 = 2025-26)
    select
        player_id,
        min(season) as first_season,
        max(season) as last_season
    from {{ ref('stg_nba__player_game_logs') }}
    group by player_id
)

select
    logged_players.player_id,
    logged_players.player_name,
    player_seasons.first_season,
    player_seasons.last_season,
    -- Blank for rookies missing from the players list, so prefer last_season
    players.is_active
from logged_players
inner join player_seasons
    on logged_players.player_id = player_seasons.player_id
left join {{ ref('stg_nba__players') }} as players
    on logged_players.player_id = players.player_id
