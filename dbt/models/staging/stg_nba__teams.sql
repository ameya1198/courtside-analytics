-- One clean row per team. Staging models only rename and tidy, no business logic.
select
    id as team_id,
    full_name as team_name,
    abbreviation as team_abbreviation,
    nickname as team_nickname,
    city,
    state,
    year_founded
from {{ source('raw', 'teams') }}
