-- Player Profile. $1 = season (null = latest), $2 = player_id (null = top scorer per 36 among qualified players).
-- Qualified: played at least 48% of the most games any team has played, and 20+ minutes a game.
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
pg as (
  select p.* from marts.fct_player_game p, s
  where p.season = s.season and p.season_type = 'Regular Season' and p.did_play
),
bar as (
  select ceil(0.48 * max(gp))::int as min_gp from (
    select team_id, count(distinct game_id) as gp from pg group by 1
  ) t
),
season_line as (
  select player_id, max(player_name) as name,
         (array_agg(team_abbreviation order by game_date desc))[1] as team,
         (array_agg(team_id order by game_date desc))[1] as team_id,
         -- every team the player appeared for this season (traded players have two or more)
         array_agg(distinct team_abbreviation) as teams,
         count(*)::int as gp,
         round(sum(minutes_played) / count(*), 1)::float as mpg,
         round(sum(pts)::numeric / count(*), 1)::float as ppg,
         round(sum(reb)::numeric / count(*), 1)::float as rpg,
         round(sum(ast)::numeric / count(*), 1)::float as apg,
         round(sum(stl)::numeric / count(*), 1)::float as spg,
         round(sum(blk)::numeric / count(*), 1)::float as bpg,
         coalesce(round(sum(pts) / nullif(2 * (sum(fga) + 0.44 * sum(fta)), 0), 3), 0)::float as ts,
         round(sum(fg3m)::numeric / nullif(sum(fg3a), 0), 3)::float as fg3,
         coalesce(round(36 * sum(pts) / nullif(sum(minutes_played), 0), 1), 0)::float as p36
  from pg group by player_id
),
qualified as (
  select l.* from season_line l, bar where l.gp >= bar.min_gp and l.mpg >= 20
),
pct as (
  select player_id,
         round(100 * percent_rank() over (order by ppg))::int as pts,
         round(100 * percent_rank() over (order by rpg))::int as reb,
         round(100 * percent_rank() over (order by apg))::int as ast,
         round(100 * percent_rank() over (order by spg))::int as stl,
         round(100 * percent_rank() over (order by bpg))::int as blk,
         round(100 * percent_rank() over (order by ts))::int as ts,
         round(100 * percent_rank() over (order by coalesce(fg3, 0)))::int as fg3,
         rank() over (order by p36 desc)::int as p36_rank
  from qualified
),
pick as (
  select coalesce(
    (select player_id from season_line where player_id = $2::bigint),
    (select player_id from qualified order by p36 desc limit 1)
  ) as player_id
),
last_games as (
  select game_date, opponent_abbreviation as opp, is_home as home, is_win as win, pts, reb, ast,
         round(minutes_played, 0)::int as min
  from pg, pick where pg.player_id = pick.player_id
  order by game_date desc limit 20
),
shots as (
  select sh.* from marts.fct_shots sh, s, pick
  where sh.season = s.season and sh.season_type = 'Regular Season' and sh.player_id = pick.player_id
),
bins as (
  select (floor(loc_x / 50.0) * 50)::int as x, (floor(loc_y / 50.0) * 50)::int as y,
         count(*)::int as a, sum(is_made::int)::int as m
  from shots where loc_y <= 300 and loc_x between -250 and 249
  group by 1, 2
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'minGames', (select min_gp from bar),
  'qualifiedCount', (select count(*) from qualified),
  -- Everyone who played, not just qualified players. Element 7 says if the player is ranked, element 8 lists their teams.
  'pool', (select json_agg(json_build_array(l.player_id, l.name, l.team, l.ppg, l.p36, l.ts, q.player_id is not null, l.teams)
                           order by (q.player_id is not null) desc, l.ppg desc)
           from season_line l left join qualified q using (player_id)),
  'player', (select row_to_json(l) from season_line l, pick where l.player_id = pick.player_id),
  'percentiles', (select row_to_json(p) from pct p, pick where p.player_id = pick.player_id),
  'lastGames', (select coalesce(json_agg(g order by g.game_date), '[]'::json) from last_games g),
  'value', (select json_build_object('age', v.age::float, 'salary', v.salary, 'fantasy_ppg', v.fantasy_ppg::float,
      'per_pt', v.dollars_per_fantasy_pt::float)
    from marts.mart_player_value v, s, pick where v.season = s.season and v.player_id = pick.player_id),
  'clutch', (select json_build_object('games', c.games, 'pts', c.pts, 'ts', c.ts_pct::float, 'plus_minus', c.plus_minus::float,
      'pts_rank', c.pts_rank, 'minutes', c.minutes::float)
    from marts.mart_player_clutch c, s, pick
    where c.season = s.season and c.season_type = 'Regular Season' and c.player_id = pick.player_id),
  'shots', json_build_object(
    'total', (select count(*) from shots),
    'rimFga', (select count(*) from shots where shot_distance <= 4),
    'rimFgm', (select count(*) from shots where shot_distance <= 4 and is_made),
    'bins', (select coalesce(json_agg(json_build_array(x, y, a, m)), '[]'::json) from bins)
  )
) as data
