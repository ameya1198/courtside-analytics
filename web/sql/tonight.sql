-- Tonight. $1 = date (null = today in US Eastern time, or the latest night with games before it).
with d as (
  select coalesce($1::date, (now() at time zone 'America/New_York')::date) as asked
),
night as (
  select max(game_date) as game_date from marts.fct_team_game, d where game_date <= d.asked
),
home as (
  select h.game_id, h.season, h.season_type, h.team_id as home_id, h.team_abbreviation as home, h.pts as home_pts,
         a.team_id as away_id, a.team_abbreviation as away, a.pts as away_pts
  from marts.fct_team_game h
  join marts.fct_team_game a on a.game_id = h.game_id and a.team_id <> h.team_id, night
  where h.game_date = night.game_date and h.is_home
),
top as (
  select distinct on (p.game_id) p.game_id, p.player_name as name, p.team_abbreviation as team, p.pts, p.reb, p.ast
  from marts.fct_player_game p join home on home.game_id = p.game_id
  order by p.game_id, p.pts desc, p.reb desc
),
net as (
  select team_id, round(off_rating - def_rating, 1)::float as net
  from marts.mart_team_ratings
  where season = (select max(season) from home) and season_type = 'Regular Season'
)
select json_build_object(
  'asked', (select asked from d),
  'date', (select game_date from night),
  'isToday', (select game_date = asked from night, d),
  'seasonType', (select min(season_type) from home),
  'games', (select coalesce(json_agg(json_build_object(
      'away', h.away, 'awayPts', h.away_pts, 'awayNet', na.net,
      'home', h.home, 'homePts', h.home_pts, 'homeNet', nh.net,
      'top', json_build_object('name', t.name, 'team', t.team, 'pts', t.pts, 'reb', t.reb, 'ast', t.ast)
    ) order by h.home), '[]'::json)
    from home h
    left join net nh on nh.team_id = h.home_id
    left join net na on na.team_id = h.away_id
    left join top t on t.game_id = h.game_id)
) as data
