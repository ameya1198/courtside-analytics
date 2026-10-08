-- One row per player per regular season: how strong a player is in each of the 11 Roster Needs measures,
-- as a league percentile (100 = best). The Roster Needs page scores trade targets against a team's holes with these.
-- Percentiles are among qualified players (500+ minutes) in the same season; others get nulls.
-- Some needs blend two skills, averaging whichever percentiles exist:
--   three_pt        threes made per 36, and 3P% pulled toward the league average for low-volume shooters
--   rim_finishing   restricted-area FG% (pulled toward average the same way), and rim attempts per 36
--   rim_protection  blocks per 36, and opponent FG% at the rim when he is the closest defender (2024-25 on)
--   perimeter_d     opponent 3P% when he is the closest defender, and threes contested per 36 (2024-25 on)
--   def_rebounding  defensive rebounds per 36, and defensive box-outs per 36 (2024-25 on)
--   forcing_tov     steals per 36, and deflections per 36 (2024-25 on)
--   transition_d    no player stat tracks this, so it uses his on/off defensive rating (2024-25 on)
with games as (
    select *
    from {{ ref('fct_player_game') }}
    where season_type = 'Regular Season' and did_play
),

box as (
    select
        player_id,
        max(player_name) as player_name,
        season,
        max(season_label) as season_label,
        -- His team at the end of the season, for "is he on another team"
        (array_agg(team_abbreviation order by game_date desc))[1] as team_abbreviation,
        count(*) as games,
        sum(minutes_played) as minutes,
        sum(fga) as fga,
        sum(fg3a) as fg3a,
        sum(fg3m) as fg3m,
        sum(fta) as fta,
        sum(oreb) as oreb,
        sum(dreb) as dreb,
        sum(ast) as ast,
        sum(stl) as stl,
        sum(blk) as blk,
        sum(tov) as tov
    from games
    group by player_id, season
),

rim as (
    select player_id, season, count(*) as rim_fga, sum(is_made::int) as rim_fgm
    from {{ ref('fct_shots') }}
    where season_type = 'Regular Season'
        and shot_zone_basic = 'Restricted Area'
    group by player_id, season
),

defense as (
    -- Defended shots are whole-season numbers, the same on every team row. On/off is weighted by minutes.
    select
        player_id,
        season,
        max(dfg_diff_rim) filter (where dfga_rim >= 100) as dfg_diff_rim,
        max(dfg_diff_three) filter (where dfga_three >= 100) as dfg_diff_three,
        round(sum(onoff_drtg * on_min) / nullif(sum(on_min) filter (where onoff_drtg is not null), 0), 1) as onoff_drtg
    from {{ ref('mart_player_defense') }}
    group by player_id, season
),

hustle as (
    select
        player_id,
        season,
        sum(minutes) as minutes,
        sum(contested_shots_3pt) as contests_3pt,
        sum(deflections) as deflections,
        sum(def_boxouts) as def_boxouts
    from {{ ref('stg_nba__player_hustle') }}
    where season_type = 'Regular Season'
    group by player_id, season
),

league as (
    -- League shooting this season, for pulling small samples toward average
    select
        box.season,
        sum(box.fg3m)::numeric / nullif(sum(box.fg3a), 0) as fg3_pct,
        sum(rim.rim_fgm)::numeric / nullif(sum(rim.rim_fga), 0) as rim_pct
    from box
    left join rim
        on box.player_id = rim.player_id
        and box.season = rim.season
    group by box.season
),

skills as (
    select
        box.player_id,
        box.player_name,
        box.season,
        box.season_label,
        box.team_abbreviation,
        box.games,
        box.minutes,
        box.minutes >= 500 as is_qualified,
        {{ per_36('box.fg3m', 'box.minutes') }} as fg3m_per_36,
        -- 100 league-average attempts added: a 40-for-80 shooter lands near 39%, not 50%
        round((box.fg3m + 100 * league.fg3_pct) / (box.fg3a + 100), 3) as fg3_pct_adj,
        round((rim.rim_fgm + 50 * league.rim_pct) / (rim.rim_fga + 50), 3) as rim_pct_adj,
        {{ per_36('rim.rim_fga', 'box.minutes') }} as rim_fga_per_36,
        -- Turnovers per play he finishes: shots, trips to the line, assists and turnovers
        round(box.tov::numeric / nullif(box.fga + 0.44 * box.fta + box.ast + box.tov, 0), 3) as tov_ratio,
        {{ per_36('box.oreb', 'box.minutes') }} as oreb_per_36,
        {{ per_36('box.fta', 'box.minutes') }} as fta_per_36,
        {{ per_36('box.ast', 'box.minutes') }} as ast_per_36,
        {{ per_36('box.blk', 'box.minutes') }} as blk_per_36,
        defense.dfg_diff_rim,
        defense.dfg_diff_three,
        {{ per_36('hustle.contests_3pt', 'hustle.minutes') }} as contests_3pt_per_36,
        {{ per_36('box.dreb', 'box.minutes') }} as dreb_per_36,
        {{ per_36('hustle.def_boxouts', 'hustle.minutes') }} as boxouts_per_36,
        defense.onoff_drtg,
        {{ per_36('box.stl', 'box.minutes') }} as stl_per_36,
        {{ per_36('hustle.deflections', 'hustle.minutes') }} as deflections_per_36
    from box
    inner join league
        on box.season = league.season
    left join rim
        on box.player_id = rim.player_id
        and box.season = rim.season
    left join defense
        on box.player_id = defense.player_id
        and box.season = defense.season
    left join hustle
        on box.player_id = hustle.player_id
        and box.season = hustle.season
),


pcts as (
    select
        *,
        {{ need_pctile('fg3m_per_36') }} as p_fg3m,
        {{ need_pctile('fg3_pct_adj') }} as p_fg3_pct,
        {{ need_pctile('rim_pct_adj') }} as p_rim_pct,
        {{ need_pctile('rim_fga_per_36') }} as p_rim_fga,
        {{ need_pctile('tov_ratio', false) }} as p_tov,
        {{ need_pctile('oreb_per_36') }} as p_oreb,
        {{ need_pctile('fta_per_36') }} as p_fta,
        {{ need_pctile('ast_per_36') }} as p_ast,
        {{ need_pctile('blk_per_36') }} as p_blk,
        {{ need_pctile('dfg_diff_rim', false) }} as p_dfg_rim,
        {{ need_pctile('dfg_diff_three', false) }} as p_dfg_three,
        {{ need_pctile('contests_3pt_per_36') }} as p_contests_3pt,
        {{ need_pctile('dreb_per_36') }} as p_dreb,
        {{ need_pctile('boxouts_per_36') }} as p_boxouts,
        {{ need_pctile('onoff_drtg') }} as p_onoff,
        {{ need_pctile('stl_per_36') }} as p_stl,
        {{ need_pctile('deflections_per_36') }} as p_deflections
    from skills
)


select
    player_id,
    player_name,
    season,
    season_label,
    team_abbreviation,
    games,
    minutes,
    is_qualified,
    fg3m_per_36,
    fg3_pct_adj,
    rim_pct_adj,
    tov_ratio,
    oreb_per_36,
    fta_per_36,
    ast_per_36,
    blk_per_36,
    dreb_per_36,
    stl_per_36,
    onoff_drtg,
    {{ blend_pctiles('p_fg3m', 'p_fg3_pct') }} as three_pt,
    {{ blend_pctiles('p_rim_pct', 'p_rim_fga') }} as rim_finishing,
    round(p_tov)::int as ball_security,
    round(p_oreb)::int as off_rebounding,
    round(p_fta)::int as ft_rate,
    round(p_ast)::int as playmaking,
    {{ blend_pctiles('p_blk', 'p_dfg_rim') }} as rim_protection,
    {{ blend_pctiles('p_dfg_three', 'p_contests_3pt') }} as perimeter_d,
    {{ blend_pctiles('p_dreb', 'p_boxouts') }} as def_rebounding,
    round(p_onoff)::int as transition_d,
    {{ blend_pctiles('p_stl', 'p_deflections') }} as forcing_tov
from pcts
