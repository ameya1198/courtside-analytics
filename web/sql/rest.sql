-- Rest and Schedule. $1 = season (null = latest).
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
buckets as (
  -- Every regular season we hold, against an opponent with at least one day off.
  select team_rest_days as rest, sum(games)::int as games,
         round(sum(wins)::numeric / nullif(sum(games), 0), 3)::float as win_pct,
         round(sum(point_diff_total) / nullif(sum(games), 0), 2)::float as margin
  from marts.mart_rest_impact
  where opponent_rest_days >= 1
  group by 1
),
recent as (
  select g.team_abbreviation as abbr, g.is_back_to_back as b2b, g.is_win
  from marts.fct_team_game g, s
  where g.season_type = 'Regular Season' and g.season between s.season - 2 and s.season
    and g.days_rest is not null
),
gaps as (
  select abbr,
         count(*) filter (where b2b)::int as b2b_games,
         round(avg(is_win::int) filter (where b2b), 3)::float as b2b_pct,
         round(avg(is_win::int) filter (where not b2b), 3)::float as rested_pct
  from recent group by 1
),
months as (
  select g.team_abbreviation as abbr, extract(month from g.game_date)::int as month, count(*)::int as n
  from marts.fct_team_game g, s
  where g.season = s.season and g.season_type = 'Regular Season' and g.is_back_to_back
  group by 1, 2
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'historyFrom', (select min(season) from marts.mart_rest_impact),
  'historyTo', (select max(season) from marts.mart_rest_impact),
  'buckets', (select json_agg(b order by b.rest) from buckets b),
  'gaps', (select coalesce(json_agg(g), '[]'::json) from gaps g),
  'months', (select coalesce(json_agg(json_build_array(abbr, month, n)), '[]'::json) from months)
) as data
