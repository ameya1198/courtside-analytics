-- Defense. $1 = season (null = latest), $2 = team abbreviation (null = best defense), $3 = opponent abbreviation (null = all opponents).
-- Defensive rating = points allowed per 100 opponent possessions (shots + 0.44 x free throws - offensive rebounds + turnovers).
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
ratings as (
  select t.team_id, t.team_abbreviation as abbr, t.team_name as name, t.games::int as gp,
         round(t.def_rating, 1)::float as drtg, t.opp_pts_per_game::float as opp_ppg,
         rank() over (order by t.def_rating asc)::int as def_rank
  from marts.mart_team_ratings t, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
prev as (
  select t.team_abbreviation as abbr, round(t.def_rating, 1)::float as drtg,
         rank() over (order by t.def_rating asc)::int as def_rank
  from marts.mart_team_ratings t, s
  where t.season = s.season - 1 and t.season_type = 'Regular Season'
),
pick as (
  select coalesce(
    (select abbr from ratings where abbr = upper($2::text)),
    (select abbr from ratings order by drtg asc limit 1)
  ) as abbr
),
me as (
  select r.* from ratings r, pick where r.abbr = pick.abbr
),
-- Every team game next to the opponent's line for the same game.
tg as (
  select t.game_id, t.game_date, t.team_abbreviation as abbr, t.opponent_abbreviation as opp, t.is_win as win,
         t.dreb, o.oreb as opp_oreb, o.fgm as opp_fgm, o.fg3m as opp_fg3m, o.fga as opp_fga, o.fta as opp_fta,
         o.ftm as opp_ftm, o.tov as opp_tov, o.pts as opp_pts,
         o.fga + 0.44 * o.fta - o.oreb + o.tov as opp_poss
  from marts.fct_team_game t
  join marts.fct_team_game o on o.game_id = t.game_id and o.team_id <> t.team_id, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
ff as (
  select abbr,
         sum(opp_fgm + 0.5 * opp_fg3m) / nullif(sum(opp_fga), 0) as opp_efg,
         sum(opp_tov) / nullif(sum(opp_fga + 0.44 * opp_fta + opp_tov), 0) as forced_tov,
         sum(dreb)::numeric / nullif(sum(dreb + opp_oreb), 0) as dreb,
         sum(opp_ftm)::numeric / nullif(sum(opp_fga), 0) as opp_ftr
  from tg group by 1
),
ff_ranked as (
  -- Rank 1 is always the best defense: low opponent shooting and free throws, high turnovers forced and rebounds kept.
  select abbr,
         round(opp_efg, 3)::float as opp_efg, round(forced_tov, 3)::float as forced_tov,
         round(dreb, 3)::float as dreb, round(opp_ftr, 3)::float as opp_ftr,
         rank() over (order by opp_efg asc)::int as opp_efg_rank,
         rank() over (order by forced_tov desc)::int as forced_tov_rank,
         rank() over (order by dreb desc)::int as dreb_rank,
         rank() over (order by opp_ftr asc)::int as opp_ftr_rank
  from ff
),
league_ff as (
  select round(sum(opp_fgm + 0.5 * opp_fg3m) / nullif(sum(opp_fga), 0), 3)::float as opp_efg,
         round(sum(opp_tov) / nullif(sum(opp_fga + 0.44 * opp_fta + opp_tov), 0), 3)::float as forced_tov,
         round(sum(dreb)::numeric / nullif(sum(dreb + opp_oreb), 0), 3)::float as dreb,
         round(sum(opp_ftm)::numeric / nullif(sum(opp_fga), 0), 3)::float as opp_ftr,
         round(100 * sum(opp_pts) / nullif(sum(opp_poss), 0), 1)::float as drtg
  from tg
),
my_games as (
  select tg.* from tg, pick where tg.abbr = pick.abbr
),
opponents as (
  select opp as abbr, count(*)::int as games from my_games group by 1
),
opp_pick as (
  select (select abbr from opponents where abbr = upper($3::text)) as abbr
),
-- Shots taken against the chosen team, optionally by one opponent.
shots_vs as (
  select sh.* from marts.fct_shots sh
  join my_games g on g.game_id = sh.game_id and sh.team_abbreviation = g.opp, opp_pick
  where opp_pick.abbr is null or sh.team_abbreviation = opp_pick.abbr
),
-- Comparison: the chosen opponent against everyone else, or the whole league when no opponent is picked.
shots_cmp as (
  select sh.* from marts.fct_shots sh, s, opp_pick, pick
  where sh.season = s.season and sh.season_type = 'Regular Season'
    and (opp_pick.abbr is null
         or (sh.team_abbreviation = opp_pick.abbr
             and sh.game_id not in (select game_id from my_games)))
),
zone_agg as (
  select 'vs' as side, shot_zone_basic as zone, count(*)::int as fga, sum(is_made::int)::int as fgm from shots_vs group by 2
  union all
  select 'cmp', shot_zone_basic, count(*)::int, sum(is_made::int)::int from shots_cmp group by 2
),
zones as (
  select side, zone, fga,
         round(fga::numeric / sum(fga) over (partition by side), 3)::float as share,
         round(fgm::numeric / nullif(fga, 0), 3)::float as fg
  from zone_agg
),
bins as (
  select (floor(loc_x / 50.0) * 50)::int as x, (floor(loc_y / 50.0) * 50)::int as y,
         count(*)::int as a, sum(is_made::int)::int as m
  from shots_vs where loc_y <= 300 and loc_x between -250 and 249
  group by 1, 2
),
-- Box-score defense for the chosen team's rotation players.
roster_box as (
  select p.player_id, max(p.player_name) as name, count(*)::int as gp,
         round(avg(p.minutes_played), 1)::float as mpg,
         round(36 * sum(p.stl) / nullif(sum(p.minutes_played), 0), 2)::float as stl36,
         round(36 * sum(p.blk) / nullif(sum(p.minutes_played), 0), 2)::float as blk36,
         round(36 * sum(p.dreb) / nullif(sum(p.minutes_played), 0), 1)::float as dreb36,
         round(36 * sum(p.pf) / nullif(sum(p.minutes_played), 0), 1)::float as pf36,
         round(avg(p.plus_minus), 1)::float as pm
  from marts.fct_player_game p, s, pick
  where p.season = s.season and p.season_type = 'Regular Season' and p.team_abbreviation = pick.abbr and p.did_play
  group by p.player_id
  having count(*) >= 10 and avg(p.minutes_played) >= 12
),
-- Phase 2: on/off, defended shooting, hustle and salary from mart_player_defense, for the same players.
roster as (
  select b.*,
         d.on_min::float as on_min, d.on_drtg::float as on_drtg, d.off_drtg::float as off_drtg,
         d.onoff_drtg::float as onoff_drtg,
         d.dfga_overall::float as dfga, d.dfg_diff_overall::float as dfg_diff,
         d.dfg_diff_rim::float as dfg_diff_rim, d.dfg_diff_three::float as dfg_diff_three,
         d.contests_per_36::float as contests36, d.deflections_per_36::float as deflections36,
         d.salary, coalesce(d.is_qualified, false) as qualified,
         d.onoff_pctile, d.dfg_pctile, d.contests_pctile, d.deflections_pctile
  from roster_box b
  cross join s
  cross join me
  left join marts.mart_player_defense d
    on d.player_id = b.player_id and d.team_id = me.team_id and d.season = s.season
),
-- How opponents score against the chosen team, per game, with league ranks (1 = fewest allowed).
misc_league as (
  select m.* from marts.mart_team_defense_misc m, s
  where m.season = s.season and m.season_type = 'Regular Season'
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'team', (select json_build_object('team_id', me.team_id, 'abbr', me.abbr, 'name', me.name, 'gp', me.gp, 'drtg', me.drtg,
                                    'def_rank', me.def_rank, 'opp_ppg', me.opp_ppg, 'prev_drtg', p.drtg, 'prev_rank', p.def_rank)
           from me left join prev p on p.abbr = me.abbr),
  'leagueDrtg', (select drtg from league_ff),
  'ranking', (select coalesce(json_agg(json_build_array(abbr, drtg) order by drtg), '[]'::json) from ratings),
  'factors', (select row_to_json(f) from ff_ranked f, pick where f.abbr = pick.abbr),
  'leagueFactors', (select json_build_object('opp_efg', opp_efg, 'forced_tov', forced_tov, 'dreb', dreb, 'opp_ftr', opp_ftr) from league_ff),
  'games', (select coalesce(json_agg(json_build_array(game_date, opp, round(100 * opp_pts / nullif(opp_poss, 0), 1), win) order by game_date), '[]'::json) from my_games),
  'opponents', (select coalesce(json_agg(json_build_array(abbr, games) order by abbr), '[]'::json) from opponents),
  'opponent', (select abbr from opp_pick),
  'shotCount', (select count(*) from shots_vs),
  'zones', (select coalesce(json_agg(json_build_object('zone', zone, 'fga', fga, 'share', share, 'fg', fg) order by share desc), '[]'::json) from zones where side = 'vs'),
  'compareZones', (select coalesce(json_agg(json_build_object('zone', zone, 'fga', fga, 'share', share, 'fg', fg)), '[]'::json) from zones where side = 'cmp'),
  'bins', (select coalesce(json_agg(json_build_array(x, y, a, m)), '[]'::json) from bins),
  'players', (select coalesce(json_agg(r order by r.mpg desc), '[]'::json) from roster r),
  'misc', (select json_build_object(
             'off_tov', m.opp_pts_off_tov::float, 'off_tov_rank', m.opp_pts_off_tov_rank,
             'second_chance', m.opp_pts_2nd_chance::float, 'second_chance_rank', m.opp_pts_2nd_chance_rank,
             'fast_break', m.opp_pts_fb::float, 'fast_break_rank', m.opp_pts_fb_rank,
             'paint', m.opp_pts_paint::float, 'paint_rank', m.opp_pts_paint_rank,
             'league', (select json_build_object(
                          'off_tov', round(avg(opp_pts_off_tov), 1)::float,
                          'second_chance', round(avg(opp_pts_2nd_chance), 1)::float,
                          'fast_break', round(avg(opp_pts_fb), 1)::float,
                          'paint', round(avg(opp_pts_paint), 1)::float) from misc_league))
           from misc_league m, me where m.team_id = me.team_id)
) as data
