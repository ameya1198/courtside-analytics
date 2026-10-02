-- One row per current NBA team, with its conference and division.
select
    teams.team_id,
    teams.team_name,
    teams.team_abbreviation,
    teams.team_nickname,
    teams.city as team_city,
    teams.state as team_state,
    teams.year_founded,
    divisions.conference,
    divisions.division
from {{ ref('stg_nba__teams') }} as teams
left join {{ ref('nba_team_divisions') }} as divisions
    on teams.team_abbreviation = divisions.team_abbreviation
