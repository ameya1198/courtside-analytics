-- Player Value. $1 = season (null = latest season that has both games and salaries).
with seasons as (
  select distinct season from marts.mart_player_value where salary is not null
),
s as (
  select coalesce($1::int, (select max(season) from seasons)) as season
),
pool as (
  select v.*
  from marts.mart_player_value v, s
  where v.season = s.season
),
qualified as (
  select * from pool where is_qualified
),
priced as (
  select * from qualified where salary is not null
),
ages as (
  -- League-wide production by age, every season we hold, qualified players only.
  select age::int as age, count(*)::int as players, round(avg(fantasy_ppg), 1)::float as fantasy_ppg
  from marts.mart_player_value
  where is_qualified and age between 19 and 39
  group by 1
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from pool),
  'seasons', (select coalesce(json_agg(season order by season desc), '[]'::json) from seasons),
  'qualifiedCount', (select count(*) from qualified),
  'pricedCount', (select count(*) from priced),
  'medianSalary', (select percentile_cont(0.5) within group (order by salary) from priced),
  'medianProduction', (select percentile_cont(0.5) within group (order by fantasy_ppg) from priced),
  -- [player_id, name, team, age, salary, fantasy_ppg, pts_per_36, ts_pct, dollars_per_fantasy_pt, games]
  'players', (select coalesce(json_agg(json_build_array(
      player_id, player_name, team_abbreviation, age::float, salary, fantasy_ppg::float, pts_per_36::float,
      ts_pct::float, dollars_per_fantasy_pt, games
    ) order by fantasy_ppg desc), '[]'::json) from priced),
  'bargains', (select coalesce(json_agg(b), '[]'::json) from (
      select player_id, player_name, team_abbreviation as team, salary, fantasy_ppg::float, dollars_per_fantasy_pt::float as per_pt
      from priced
      where salary >= 2000000  -- skip two-way and minimum-salary call-ups
      order by dollars_per_fantasy_pt asc limit 5) b),
  'worst', (select coalesce(json_agg(w), '[]'::json) from (
      -- Big contracts, judged on whatever games the player managed, so injuries count against value.
      select player_id, player_name, team_abbreviation as team, salary, fantasy_ppg::float, games,
             dollars_per_fantasy_pt::float as per_pt
      from pool
      where salary >= 20000000 and games >= 10
      order by dollars_per_fantasy_pt desc limit 5) w),
  'leaders', (select coalesce(json_agg(l), '[]'::json) from (
      select player_id, player_name, team_abbreviation as team, ppg::float, pts_per_36::float as p36,
             ts_pct::float as ts, salary
      from qualified order by pts_per_36 desc limit 10) l),
  'ages', (select coalesce(json_agg(a order by a.age), '[]'::json) from ages a)
) as data
