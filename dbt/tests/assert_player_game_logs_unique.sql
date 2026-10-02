-- A test passes when it returns zero rows. This returns any duplicated player-game.
select game_id, player_id, count(*)
from {{ ref('stg_nba__player_game_logs') }}
group by 1, 2
having count(*) > 1
