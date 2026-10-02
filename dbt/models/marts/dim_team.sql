-- One row per current NBA team.
select
    team_id,
    team_name,
    team_abbreviation,
    team_nickname,
    city as team_city,
    state as team_state,
    year_founded
from {{ ref('stg_nba__teams') }}
