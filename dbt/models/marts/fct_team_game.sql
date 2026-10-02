-- One row per team per game, with team details added.
select
    logs.*,
    teams.team_nickname,
    teams.team_city
from {{ ref('stg_nba__team_game_logs') }} as logs
left join {{ ref('dim_team') }} as teams
    on logs.team_id = teams.team_id
