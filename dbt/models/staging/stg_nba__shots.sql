-- One row per shot attempt, with tidy names and a few derived flags.
select
    game_id,
    game_event_id,
    player_id,
    team_id,
    game_date,
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    season_type,
    (season_type = 'Playoffs') as is_playoffs,
    period,
    -- Seconds left in the period, handy for late-clock and end-of-quarter questions
    minutes_remaining * 60 + seconds_remaining as seconds_left_in_period,
    action_type,
    shot_type,
    (shot_type like '3PT%') as is_three,
    shot_zone_basic,
    shot_zone_area,
    shot_zone_range,
    shot_distance,
    loc_x,
    loc_y,
    (shot_made_flag = 1) as is_made,
    -- Points from this shot (free throws are not in this data)
    case
        when shot_made_flag = 1 and shot_type like '3PT%' then 3
        when shot_made_flag = 1 then 2
        else 0
    end as points
from {{ source('raw', 'shots') }}
