-- Shots a player defended as the closest defender, per category (all shots, threes, rim).
-- dfg_diff = opponent FG% against him minus what those shooters usually hit. Negative is good defense.
select
    player_id,
    player_name,
    team_id,
    team_abbreviation,
    player_position,
    category,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    gp as games,
    freq,
    d_fgm,
    d_fga,
    d_fg_pct,
    normal_fg_pct,
    d_fg_pct - normal_fg_pct as dfg_diff
from {{ source('raw', 'player_defended_shots') }}
