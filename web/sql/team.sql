-- Team Report. $1 = season (null = latest), $2 = team abbreviation (null = net rating leader).
with s as (
  select coalesce($1::int, (select max(season) from marts.mart_team_ratings where season_type = 'Regular Season')) as season
),
ratings as (
  select t.team_id, t.team_abbreviation as abbr, t.team_name as name, t.conference as conf,
         t.wins::int as w, t.losses::int as l, t.games::int as gp,
         round(t.off_rating, 1)::float as ortg, round(t.def_rating, 1)::float as drtg,
         round(t.off_rating - t.def_rating, 1)::float as net, round(t.pace, 1)::float as pace,
         rank() over (order by t.off_rating desc)::int as off_rank,
         rank() over (order by t.def_rating asc)::int as def_rank,
         rank() over (order by t.off_rating - t.def_rating desc)::int as net_rank,
         rank() over (order by t.wins::float / nullif(t.games, 0) desc)::int as win_rank
  from marts.mart_team_ratings t, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
pick as (
  select coalesce(
    (select abbr from ratings where abbr = upper($2::text)),
    (select abbr from ratings order by net desc limit 1)
  ) as abbr
),
tg as (
  select t.*, o.dreb as opp_dreb, o.pts as opp_pts
  from marts.fct_team_game t
  join marts.fct_team_game o on o.game_id = t.game_id and o.team_id <> t.team_id, s
  where t.season = s.season and t.season_type = 'Regular Season'
),
ff as (
  select team_abbreviation as abbr,
         sum(fgm + 0.5 * fg3m) / nullif(sum(fga), 0) as efg,
         sum(tov) / nullif(sum(fga + 0.44 * fta + tov), 0) as tov,
         sum(oreb)::numeric / nullif(sum(oreb + opp_dreb), 0) as orb,
         sum(ftm)::numeric / nullif(sum(fga), 0) as ftr
  from tg group by 1
),
ff_ranked as (
  select abbr,
         round(efg, 3)::float as efg, round(tov, 3)::float as tov, round(orb, 3)::float as orb, round(ftr, 3)::float as ftr,
         rank() over (order by efg desc)::int as efg_rank,
         rank() over (order by tov asc)::int as tov_rank,
         rank() over (order by orb desc)::int as orb_rank,
         rank() over (order by ftr desc)::int as ftr_rank
  from ff
),
league_ff as (
  select round(sum(fgm + 0.5 * fg3m) / nullif(sum(fga), 0), 3)::float as efg,
         round(sum(tov) / nullif(sum(fga + 0.44 * fta + tov), 0), 3)::float as tov,
         round(sum(oreb)::numeric / nullif(sum(oreb + opp_dreb), 0), 3)::float as orb,
         round(sum(ftm)::numeric / nullif(sum(fga), 0), 3)::float as ftr
  from tg
),
games as (
  select game_date, opponent_abbreviation as opp, is_home as home, is_win as win,
         pts, opp_pts, plus_minus::float as margin, is_back_to_back as b2b, days_rest
  from tg, pick where tg.team_abbreviation = pick.abbr
),
zones as (
  select z.shot_zone_basic as zone, z.fga::int as fga, round(z.share_of_shots, 3)::float as share, round(z.fg_pct, 3)::float as fg
  from marts.mart_team_shot_zones z, s, pick
  where z.season = s.season and z.season_type = 'Regular Season' and z.team_abbreviation = pick.abbr
),
league_zones as (
  select z.shot_zone_basic as zone,
         round(sum(z.fga)::numeric / sum(sum(z.fga)) over (), 3)::float as share,
         round(sum(z.fgm)::numeric / nullif(sum(z.fga), 0), 3)::float as fg
  from marts.mart_team_shot_zones z, s
  where z.season = s.season and z.season_type = 'Regular Season'
  group by 1
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from marts.mart_team_ratings, s where mart_team_ratings.season = s.season),
  'seasons', (select json_agg(distinct season order by season desc) from marts.mart_team_ratings where season_type = 'Regular Season'),
  'teams', (select json_agg(json_build_object('abbr', abbr, 'name', name) order by name) from ratings),
  'team', (select row_to_json(r) from ratings r, pick where r.abbr = pick.abbr),
  'factors', (select row_to_json(f) from ff_ranked f, pick where f.abbr = pick.abbr),
  'leagueFactors', (select row_to_json(l) from league_ff l),
  'games', (select coalesce(json_agg(g order by g.game_date), '[]'::json) from games g),
  'zones', (select coalesce(json_agg(z order by z.share desc), '[]'::json) from zones z),
  'leagueZones', (select coalesce(json_agg(lz), '[]'::json) from league_zones lz)
) as data
