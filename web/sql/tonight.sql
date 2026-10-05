-- Tonight. $1 = date (null = today in US Eastern time).
-- Uses the loaded schedule: today's games if there are any, otherwise the next game night.
-- Dates before the schedule we hold fall back to finished games from the game logs.
with d as (
  select coalesce($1::date, (now() at time zone 'America/New_York')::date) as asked,
         (now() at time zone 'America/New_York')::date as today
),
sched as (
  select * from marts.fct_schedule
),
target as (
  select coalesce(
    (select d.asked from d where exists (select 1 from sched where sched.game_date = d.asked)),
    (select min(game_date) from sched, d where d.asked >= d.today and sched.game_date >= d.asked),
    (select max(game_date) from marts.fct_team_game, d where game_date <= d.asked)
  ) as game_date
),
from_schedule as (
  select s.game_id, s.season, s.season_type, s.game_label, s.game_datetime_utc, s.game_status_text,
         s.is_final, s.home_team_id, s.home_team as home, s.home_score as home_pts, s.home_days_rest,
         s.home_back_to_back, s.away_team_id, s.away_team as away, s.away_score as away_pts,
         s.away_days_rest, s.away_back_to_back
  from sched s, target where s.game_date = target.game_date
),
from_logs as (
  -- Only used when the schedule does not cover the date.
  select h.game_id, h.season, h.season_type, null::text as game_label, null::timestamptz as game_datetime_utc,
         'Final'::text as game_status_text, true as is_final,
         h.team_id as home_team_id, h.team_abbreviation as home, h.pts as home_pts, h.days_rest as home_days_rest,
         coalesce(h.is_back_to_back, false) as home_back_to_back,
         a.team_id as away_team_id, a.team_abbreviation as away, a.pts as away_pts, a.days_rest as away_days_rest,
         coalesce(a.is_back_to_back, false) as away_back_to_back
  from marts.fct_team_game h
  join marts.fct_team_game a on a.game_id = h.game_id and a.team_id <> h.team_id, target
  where h.game_date = target.game_date and h.is_home
    and not exists (select 1 from from_schedule)
),
games as (
  select * from from_schedule union all select * from from_logs
),
-- Ratings from the game's season; early in a season (under 10 games) use last season's instead.
rating_season as (
  select case
    when (select coalesce(max(games), 0) from marts.mart_team_ratings
          where season = (select max(season) from games) and season_type = 'Regular Season') >= 10
      then (select max(season) from games)
    else (select max(season) from games) - 1
  end as season
),
net as (
  select team_id, round(off_rating - def_rating, 1)::float as net
  from marts.mart_team_ratings, rating_season
  where mart_team_ratings.season = rating_season.season and season_type = 'Regular Season'
),
top as (
  select distinct on (p.game_id) p.game_id, p.player_name as name, p.team_abbreviation as team, p.pts, p.reb, p.ast
  from marts.fct_player_game p join games on games.game_id = p.game_id
  order by p.game_id, p.pts desc, p.reb desc
)
select json_build_object(
  'asked', (select asked from d),
  'today', (select today from d),
  'date', (select game_date from target),
  'isToday', (select game_date = today from target, d),
  'isUpcoming', (select game_date > today from target, d),
  'seasonType', (select min(season_type) from games),
  'ratingSeason', (select season from rating_season),
  'games', (select coalesce(json_agg(json_build_object(
      'id', g.game_id,
      'label', g.game_label,
      'tipUtc', g.game_datetime_utc,
      'status', g.game_status_text,
      'final', g.is_final,
      'away', g.away, 'awayPts', g.away_pts, 'awayNet', na.net, 'awayRest', g.away_days_rest, 'awayB2B', g.away_back_to_back,
      'home', g.home, 'homePts', g.home_pts, 'homeNet', nh.net, 'homeRest', g.home_days_rest, 'homeB2B', g.home_back_to_back,
      'top', case when t.name is null then null else json_build_object('name', t.name, 'team', t.team, 'pts', t.pts, 'reb', t.reb, 'ast', t.ast) end
    ) order by g.game_datetime_utc nulls last, g.home), '[]'::json)
    from games g
    left join net nh on nh.team_id = g.home_team_id
    left join net na on na.team_id = g.away_team_id
    left join top t on t.game_id = g.game_id)
) as data
