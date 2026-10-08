-- One row per player per preseason: per-game averages for the "Preseason so far" box on Player Profile.
-- Shown only for rookies and new signings, who have no regular-season numbers with their new team.
-- Nothing else reads preseason: starters rest and coaches experiment, so these are not real games.
select
    player_id,
    max(player_name) as player_name,
    season,
    max(season_label) as season_label,
    (array_agg(team_abbreviation order by game_date desc))[1] as team_abbreviation,
    count(*) as games,
    max(game_date) as last_game,
    round(sum(minutes_played) / count(*), 1) as mpg,
    round(sum(pts)::numeric / count(*), 1) as ppg,
    round(sum(reb)::numeric / count(*), 1) as rpg,
    round(sum(ast)::numeric / count(*), 1) as apg,
    round(sum(stl)::numeric / count(*), 1) as spg,
    round(sum(blk)::numeric / count(*), 1) as bpg,
    round(sum(tov)::numeric / count(*), 1) as tpg,
    sum(fgm) as fgm,
    sum(fga) as fga,
    sum(fg3m) as fg3m,
    sum(fg3a) as fg3a,
    round(sum(fgm)::numeric / nullif(sum(fga), 0), 3) as fg_pct,
    round(sum(fg3m)::numeric / nullif(sum(fg3a), 0), 3) as fg3_pct,
    {{ true_shooting_pct('sum(pts)', 'sum(fga)', 'sum(fta)') }} as ts_pct,
    round(sum(plus_minus) / count(*), 1) as plus_minus
from {{ ref('stg_nba__preseason_game_logs') }}
group by player_id, season
