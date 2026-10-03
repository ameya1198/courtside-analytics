-- Matchup Scout. $1 = season (null = latest), $2 = team A, $3 = team B (nulls = top two by net rating).
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
ratings as (
  select t.team_id, t.team_abbreviation as abbr, t.team_name as name, t.conference as conf,
         t.wins::int as w, t.losses::int as l,
         round(t.off_rating, 1)::float as ortg, round(t.def_rating, 1)::float as drtg,
         round(t.off_rating - t.def_rating, 1)::float as net, round(t.pace, 1)::float as pace,
         row_number() over (order by t.off_rating - t.def_rating desc) as rn
  from marts.mart_team_ratings t, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
pick as (
  select coalesce((select abbr from ratings where abbr = upper($2::text)), (select abbr from ratings where rn = 1)) as a,
         coalesce((select abbr from ratings where abbr = upper($3::text)), (select abbr from ratings where rn = 2)) as b
),
tg as (
  select t.*, o.dreb as opp_dreb, o.pts as opp_pts
  from marts.fct_team_game t
  join marts.fct_team_game o on o.game_id = t.game_id and o.team_id <> t.team_id, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
ff as (
  select team_abbreviation as abbr,
         round(sum(fgm + 0.5 * fg3m) / nullif(sum(fga), 0), 3)::float as efg,
         round(sum(tov) / nullif(sum(fga + 0.44 * fta + tov), 0), 3)::float as tov,
         round(sum(oreb)::numeric / nullif(sum(oreb + opp_dreb), 0), 3)::float as orb,
         round(sum(ftm)::numeric / nullif(sum(fga), 0), 3)::float as ftr
  from tg, pick where team_abbreviation in (pick.a, pick.b)
  group by 1
),
h2h as (
  select t.game_date, t.season_type as phase, t.is_home as a_home, t.pts as a_pts, o.pts as b_pts
  from marts.fct_team_game t
  join marts.fct_team_game o on o.game_id = t.game_id and o.team_id <> t.team_id, s, pick
  where t.season = s.season and t.team_abbreviation = pick.a and o.team_abbreviation = pick.b
),
zones as (
  select z.team_abbreviation as abbr, z.shot_zone_basic as zone,
         round(z.share_of_shots, 3)::float as share, round(z.fg_pct, 3)::float as fg
  from marts.mart_team_shot_zones z, s, pick
  where z.season = s.season and z.season_type = 'Regular Season' and z.team_abbreviation in (pick.a, pick.b)
    and z.shot_zone_basic <> 'Backcourt'
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'teams', (select json_agg(json_build_object('abbr', abbr, 'name', name) order by name) from ratings),
  'a', (select row_to_json(r) from ratings r, pick where r.abbr = pick.a),
  'b', (select row_to_json(r) from ratings r, pick where r.abbr = pick.b),
  'factors', (select json_object_agg(abbr, json_build_object('efg', efg, 'tov', tov, 'orb', orb, 'ftr', ftr)) from ff),
  'games', (select coalesce(json_agg(h order by h.game_date), '[]'::json) from h2h h),
  'zones', (select coalesce(json_agg(z), '[]'::json) from zones z)
) as data
