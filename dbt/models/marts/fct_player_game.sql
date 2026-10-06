-- One row per player per game, with team details, rest days and a few efficiency stats.
-- Incremental: after the first build, each run only reprocesses the last 7 days of games.
-- Rows with 0 minutes are kept on purpose. Use did_play to filter them in analysis.
{{ config(
    materialized='incremental',
    unique_key=['game_id', 'player_id'],
    incremental_strategy='delete+insert',
    post_hook="create index if not exists fct_player_game_season_team_idx on {{ this }} (season, season_type, team_abbreviation)"
) }}

select
    logs.game_id,
    logs.player_id,
    logs.player_name,
    logs.team_id,
    logs.team_abbreviation,
    teams.team_name,
    teams.team_nickname,
    teams.team_city,
    teams.conference,
    logs.game_date,
    logs.season,
    logs.season_label,
    logs.season_type,
    logs.is_playoffs,
    logs.matchup,
    logs.is_home,
    logs.opponent_abbreviation,
    logs.is_win,
    -- Some 0-minute rows still have stats, so the flag checks the stats too
    (
        logs.minutes_played > 0
        or logs.pts <> 0 or logs.reb <> 0 or logs.ast <> 0
        or logs.stl <> 0 or logs.blk <> 0 or logs.tov <> 0
        or logs.pf <> 0 or logs.fga <> 0 or logs.fta <> 0
    ) as did_play,
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
    logs.fantasy_pts,
    {{ true_shooting_pct('logs.pts', 'logs.fga', 'logs.fta') }} as ts_pct,
    {{ per_36('logs.pts', 'logs.minutes_played') }} as pts_per_36,
    {{ per_36('logs.reb', 'logs.minutes_played') }} as reb_per_36,
    {{ per_36('logs.ast', 'logs.minutes_played') }} as ast_per_36
from {{ ref('stg_nba__player_game_logs') }} as logs
left join {{ ref('dim_team') }} as teams
    on logs.team_id = teams.team_id
left join {{ ref('int_team_game_rest') }} as rest
    on logs.game_id = rest.game_id
    and logs.team_id = rest.team_id

{% if is_incremental() %}
-- This part only runs on later builds: skip games older than 7 days before our latest game
where logs.game_date >= (select max(game_date) - 7 from {{ this }})
{% endif %}
