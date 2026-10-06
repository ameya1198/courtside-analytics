-- Player Value. $1 = season (null = latest season that has both games and salaries).
-- Value = salary per Win Share (offense and defense). VORP is the second measure.
-- $2 = team abbreviation: limits the bargain, worst-contract and leader lists to that team (null = whole league).
-- Medians, the age curve and the chart points stay league-wide, as the comparison.
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
  -- League-wide Win Shares per 48 minutes by age, every season we hold. Qualified players with 500+ minutes.
  select age::int as age, count(*)::int as players,
         round(48 * sum(ws) / nullif(sum(adv_minutes), 0), 3)::float as ws48
  from marts.mart_player_value
  where is_qualified and adv_minutes >= 500 and age between 19 and 39
  group by 1
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from pool),
  'seasons', (select coalesce(json_agg(season order by season desc), '[]'::json) from seasons),
  'qualifiedCount', (select count(*) from qualified),
  'pricedCount', (select count(*) from priced where ws is not null),
  'medianSalary', (select percentile_cont(0.5) within group (order by salary) from priced where ws is not null),
  'medianWs', (select percentile_cont(0.5) within group (order by ws) from priced where ws is not null),
  -- [player_id, name, team, age, salary, win shares, vorp, ws per 48, dollars per win share, games, ows, dws]
  'players', (select coalesce(json_agg(json_build_array(
      player_id, player_name, team_abbreviation, age::float, salary, ws::float, vorp::float, ws_per_48::float,
      dollars_per_win_share::float, games, ows::float, dws::float
    ) order by ws desc), '[]'::json) from priced where ws is not null),
  'bargains', (select coalesce(json_agg(b), '[]'::json) from (
      -- Cheapest wins: salary per Win Share, players paid $2M or more with at least one Win Share
      select player_id, player_name, team_abbreviation as team, salary, games,
             ws::float, ows::float, dws::float, vorp::float, dollars_per_win_share::float as per_ws
      from priced
      where salary >= 2000000 and ws >= 1  -- skip two-way and minimum-salary call-ups, and tiny samples
        and ($2::text is null or team_abbreviation = upper($2::text))
      order by dollars_per_win_share asc limit 5) b),
  'worst', (select coalesce(json_agg(w), '[]'::json) from (
      -- Big contracts, judged on whatever games the player managed, so injuries count against value.
      -- Only contracts that cost more per Win Share than the league median, so a well-paid star who
      -- earns his money is not listed. No Win Shares at all ranks as the worst.
      select player_id, player_name, team_abbreviation as team, salary, games,
             ws::float, ows::float, dws::float, vorp::float, dollars_per_win_share::float as per_ws
      from pool
      where salary >= 20000000 and games >= 10 and ws is not null
        and coalesce(dollars_per_win_share, 1e15) > (
          select percentile_cont(0.5) within group (order by dollars_per_win_share) from priced
          where dollars_per_win_share is not null)
        and ($2::text is null or team_abbreviation = upper($2::text))
      order by coalesce(dollars_per_win_share, 1e15) desc limit 5) w),
  'leaders', (select coalesce(json_agg(l), '[]'::json) from (
      -- VORP: value over a replacement-level player, the second measure
      select player_id, player_name, team_abbreviation as team, vorp::float, bpm::float, obpm::float, dbpm::float,
             ws::float, salary
      from pool
      where vorp is not null
        and ($2::text is null or team_abbreviation = upper($2::text))
      order by vorp desc limit 10) l),
  'ages', (select coalesce(json_agg(a order by a.age), '[]'::json) from ages a)
) as data
