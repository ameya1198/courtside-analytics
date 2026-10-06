-- Hustle totals per player per season type: contests, deflections, charges, loose balls, box-outs.
select
    player_id,
    player_name,
    team_id,
    team_abbreviation,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    g as games,
    min as minutes,
    contested_shots,
    contested_shots_2pt,
    contested_shots_3pt,
    deflections,
    charges_drawn,
    loose_balls_recovered,
    def_loose_balls_recovered,
    def_boxouts
from {{ source('raw', 'player_hustle') }}
