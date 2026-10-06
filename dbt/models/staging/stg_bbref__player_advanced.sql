-- Win Shares, Box Plus/Minus and VORP from Basketball-Reference team pages. One row per player x team x season
-- (a traded player has a row for each team). Regular season only.
-- Names that did not match an NBA id at load time are matched here against the bio data, like stg_nba__salaries.
with bio_names as (
    select distinct on (lower(player_name)) lower(player_name) as name_key, player_id
    from {{ ref('stg_nba__player_bio') }}
    order by lower(player_name), season desc
)

select
    advanced.season,
    advanced.season || '-' || right((advanced.season + 1)::text, 2) as season_label,
    coalesce(advanced.player_id, bio_names.player_id) as player_id,
    advanced.bbref_id,
    advanced.player_name,
    advanced.team as bbref_team,
    advanced.games,
    advanced.minutes,
    advanced.ows,
    advanced.dws,
    advanced.ws,
    advanced.ws_per_48,
    advanced.obpm,
    advanced.dbpm,
    advanced.bpm,
    advanced.vorp
from {{ source('raw', 'player_advanced') }} as advanced
left join bio_names
    on lower(advanced.player_name) = bio_names.name_key
