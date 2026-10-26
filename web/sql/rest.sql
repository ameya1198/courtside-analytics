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
team_sched as (
  -- The full schedule (fct_schedule), so games and back-to-backs still to come are in. It is loaded for
  -- last season and this one; older seasons fall back to the games played.
  select f.game_date, t.opp, t.home, t.b2b, f.is_final, t.pts, t.opp_pts, f.game_datetime_utc as tip
  from marts.fct_schedule f, s,
       lateral (values
         (f.home_team, f.away_team, true, f.home_back_to_back, f.home_score, f.away_score),
         (f.away_team, f.home_team, false, f.away_back_to_back, f.away_score, f.home_score)
       ) as t(abbr, opp, home, b2b, pts, opp_pts)
  where f.season = s.season and f.season_type = 'Regular Season' and t.abbr = upper($2::text)
),
games as (
  select * from team_sched
  union all
  select g.game_date, g.opponent_abbreviation, g.is_home, g.is_back_to_back, true,
         g.pts, (g.pts - g.plus_minus)::int, null::timestamptz
  from marts.fct_team_game g, s
  where not exists (select 1 from team_sched)
    and g.season = s.season and g.season_type = 'Regular Season' and g.team_abbreviation = upper($2::text)
),
games_flagged as (
  -- The first night of a back-to-back is the game before a second night
  select *, coalesce(lead(b2b) over (order by game_date), false) as b2b_first from games
),
months as (
  select upper($2::text) as abbr, extract(month from game_date)::int as month, count(*)::int as n
  from games where b2b group by 2
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
  'b2bPlayed', (select count(*)::int from games where b2b and is_final),
  -- [date, opponent, home, 2nd night of a back-to-back, 1st night, final, points, opponent points, tip-off (UTC)]
  'games', (select coalesce(json_agg(json_build_array(
              to_char(game_date, 'YYYY-MM-DD'), opp, home, b2b, b2b_first, is_final, pts, opp_pts, tip
            ) order by game_date), '[]'::json) from games_flagged)
) as data
