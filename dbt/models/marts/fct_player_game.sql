-- One row per player per game, with team details added.
select
    logs.*,
    teams.team_name,
    teams.team_nickname,
    teams.team_city
from {{ ref('stg_nba__player_game_logs') }} as logs
left join {{ ref('dim_team') }} as teams
    on logs.team_id = teams.team_id
