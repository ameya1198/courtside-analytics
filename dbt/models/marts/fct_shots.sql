-- One row per shot, with player and team names added. This is what shot charts read.
-- It is a VIEW (not a table) on purpose: it adds no storage, and the free tier is only 500 MB.
{{ config(materialized='view') }}

select
    shots.game_id,
    shots.game_event_id,
    shots.player_id,
    players.player_name,
    shots.team_id,
    teams.team_abbreviation,
    shots.game_date,
    shots.season,
    shots.season_label,
    shots.season_type,
    shots.is_playoffs,
    shots.period,
    shots.seconds_left_in_period,
    shots.action_type,
    shots.shot_type,
    shots.is_three,
    shots.shot_zone_basic,
    shots.shot_zone_area,
    shots.shot_zone_range,
    shots.shot_distance,
    shots.loc_x,
    shots.loc_y,
    shots.is_made,
    shots.points
from {{ ref('stg_nba__shots') }} as shots
left join {{ ref('dim_player') }} as players
    on shots.player_id = players.player_id
left join {{ ref('dim_team') }} as teams
    on shots.team_id = teams.team_id
