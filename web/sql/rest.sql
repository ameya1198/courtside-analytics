-- Rest and Schedule for one team. $1 = season (null = latest), $2 = team abbreviation.
-- The chosen season plus the two before it (regular season) give enough games to compare rest days.
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
w as (
  select g.team_abbreviation as abbr, least(g.days_rest, 3) as rest, g.is_back_to_back as b2b,
         g.opponent_days_rest as opp_rest, g.is_win, g.plus_minus, g.season
  from marts.fct_team_game g, s
  where g.season_type = 'Regular Season' and g.season between s.season - 2 and s.season
    and g.days_rest is not null
),
league_b as (
  -- League win rate by days of rest, against an opponent with at least one day off.
  select rest, round(avg(is_win::int), 3)::float as win_pct
  from w where opp_rest >= 1 group by 1
),
team_b as (
  select rest, count(*)::int as games,
         round(avg(is_win::int), 3)::float as win_pct,
         round(avg(plus_minus), 2)::float as margin
  from w where abbr = upper($2::text) and opp_rest >= 1 group by 1
),
buckets as (
  select t.rest, t.games, t.win_pct, t.margin, l.win_pct as league_win_pct
  from team_b t join league_b l using (rest)
),
gaps as (
  -- Every team, so the page can rank the chosen team and show the league average.
  select abbr,
         count(*) filter (where b2b)::int as b2b_games,
         round(avg(is_win::int) filter (where b2b), 3)::float as b2b_pct,
         round(avg(is_win::int) filter (where not b2b), 3)::float as rested_pct
  from w group by 1
),
sched as (
  -- The full schedule (fct_schedule), so back-to-backs still to come count too. It is loaded for last
  -- season and this one; older seasons fall back to the games played.
  select f.game_date, t.b2b, f.is_final
  from marts.fct_schedule f, s,
       lateral (values (f.home_team, f.home_back_to_back), (f.away_team, f.away_back_to_back)) as t(abbr, b2b)
  where f.season = s.season and f.season_type = 'Regular Season' and t.abbr = upper($2::text)
),
b2b_games as (
  select game_date, is_final from sched where b2b
  union all
  select g.game_date, true
  from marts.fct_team_game g, s
  where not exists (select 1 from sched)
    and g.season = s.season and g.season_type = 'Regular Season' and g.is_back_to_back
    and g.team_abbreviation = upper($2::text)
),
months as (
  select upper($2::text) as abbr, extract(month from game_date)::int as month, count(*)::int as n
  from b2b_games group by 2
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'historyFrom', (select min(season) from w),
  'historyTo', (select max(season) from w),
  'team', (select json_build_object('abbr', team_abbreviation, 'name', team_name) from marts.dim_team where team_abbreviation = upper($2::text)),
  'buckets', (select coalesce(json_agg(b order by b.rest), '[]'::json) from buckets b),
  'gaps', (select coalesce(json_agg(g), '[]'::json) from gaps g),
  'months', (select coalesce(json_agg(json_build_array(abbr, month, n)), '[]'::json) from months),
  'b2bPlayed', (select count(*)::int from b2b_games where is_final)
) as data
