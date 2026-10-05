-- Player age and physical details per season. Age is the player's age during that season.
select
    player_id,
    player_name,
    team_id,
    team_abbreviation,
    season,
    season_type,
    age,
    player_height_inches as height_inches,
    player_weight as weight_lbs,
    nullif(college, 'None') as college,
    country,
    nullif(draft_year, 'Undrafted') as draft_year,
    draft_round,
    draft_number
from {{ source('raw', 'player_bio') }}
