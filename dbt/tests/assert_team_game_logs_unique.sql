-- A test passes when it returns zero rows. This returns any duplicated team-game.
select game_id, team_id, count(*)
from {{ ref('stg_nba__team_game_logs') }}
group by 1, 2
having count(*) > 1
