-- League Pulse. $1 = season start year (null = latest).
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
r as (
  select t.team_id, t.team_abbreviation as abbr, t.team_name as name, t.conference as conf,
         t.wins::int as w, t.losses::int as l, t.games::int as gp,
         round(t.off_rating, 1)::float as ortg, round(t.def_rating, 1)::float as drtg,
         round(t.off_rating - t.def_rating, 1)::float as net, round(t.pace, 1)::float as pace,
         rank() over (order by t.off_rating desc)::int as off_rank,
         rank() over (order by t.def_rating asc)::int as def_rank
  from marts.mart_team_ratings t, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
prev as (
  select t.team_id, round(t.off_rating - t.def_rating, 1)::float as net
  from marts.mart_team_ratings t, s
  where t.season = s.season - 1 and t.season_type = 'Regular Season'
),
three as (
  select g.season, g.season_label as label,
         round(sum(g.fg3a)::numeric / nullif(sum(g.fga), 0), 4)::float as rate
  from marts.fct_team_game g, s
  where g.season_type = 'Regular Season' and g.season between s.season - 10 and s.season
  group by 1, 2
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'teams', (select json_agg(r order by r.net desc) from r),
  'prev', (select coalesce(json_agg(prev), '[]'::json) from prev),
  'threeRate', (select coalesce(json_agg(three order by three.season), '[]'::json) from three)
) as data
