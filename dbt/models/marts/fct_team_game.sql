-- One row per team per game, with team details and rest days added.
-- Incremental: after the first build, each run only reprocesses the last 7 days of games.
-- (Older games never change, so there is no need to rebuild them.)
{{ config(
    materialized='incremental',
    unique_key=['game_id', 'team_id'],
    incremental_strategy='delete+insert'
) }}

select
    logs.game_id,
    logs.team_id,
    logs.team_abbreviation,
    logs.team_name,
    teams.team_nickname,
    teams.team_city,
    teams.conference,
    teams.division,
    logs.game_date,
    logs.season,
    logs.season_label,
    logs.season_type,
    logs.is_playoffs,
    logs.matchup,
    logs.is_home,
    logs.opponent_abbreviation,
    logs.is_win,
    rest.days_rest,
    rest.is_back_to_back,
    rest.opponent_days_rest,
    rest.rest_advantage,
    logs.minutes_played,
    logs.pts,
    logs.reb,
    logs.oreb,
    logs.dreb,
    logs.ast,
    logs.stl,
    logs.blk,
    logs.tov,
    logs.pf,
    logs.fgm,
    logs.fga,
    logs.fg_pct,
    logs.fg3m,
    logs.fg3a,
    logs.fg3_pct,
    logs.ftm,
    logs.fta,
    logs.ft_pct,
    logs.plus_minus,
    {{ true_shooting_pct('logs.pts', 'logs.fga', 'logs.fta') }} as ts_pct
from {{ ref('stg_nba__team_game_logs') }} as logs
left join {{ ref('dim_team') }} as teams
    on logs.team_id = teams.team_id
left join {{ ref('int_team_game_rest') }} as rest
    on logs.game_id = rest.game_id
    and logs.team_id = rest.team_id

{% if is_incremental() %}
-- This part only runs on later builds: skip games older than 7 days before our latest game
where logs.game_date >= (select max(game_date) - 7 from {{ this }})
{% endif %}
