-- A test passes when it returns zero rows.
-- Points must equal 2 x field goals made + 3-pointers made + free throws made.
-- (A 3-pointer is already counted once in field goals, so add one more point for it.)
select game_id, player_id, pts, fgm, fg3m, ftm
from {{ ref('fct_player_game') }}
where pts <> 2 * fgm + fg3m + ftm
