-- Roster Needs. $1 = season (null = latest season the team has 20+ games in), $2 = team abbreviation,
-- $3 = side: 'offense', 'defense' or 'both' (which needs can count as holes).
-- Holes = up to three needs on that side where the team ranks 16th or worse. Fit = a player's league percentile in each hole,
-- weighted by the team's rank there (27th counts more than 21st), 0 to 100.
-- Each candidate gets a tier (untouchable, hard to get, gettable) so the page only suggests realistic moves.
-- Current rosters (mart_roster_status) set his team today, free agents, salary and contract end.
-- Salary, age, the tabs and the stars toggle are filtered on the page, so they don't need a query each.
with s as (
  select coalesce(
    $1::int,
    (select max(season) from marts.mart_team_needs where team_abbreviation = $2 and games >= 20)
  ) as season
),
needs as (
  select n.*
  from marts.mart_team_needs n, s
  where n.season = s.season and n.team_abbreviation = $2
),
side_needs as (
  select * from needs where $3::text = 'both' or lower(side) = $3::text
),
holes as (
  -- Up to three needs where the team is in the bottom half (16th or worse). A team with none gets its single
  -- worst need, so there is always something to shop for. Weight = rank, so the deepest hole counts most.
  select need, league_rank as weight
  from side_needs
  where league_rank >= 16
     or (not exists (select 1 from side_needs where league_rank >= 16)
         and league_rank = (select max(league_rank) from side_needs))
  order by league_rank desc, need
  limit 3
),
players as (
  -- Every qualified player this season, one row per need with his percentile in it
  select p.player_id, p.player_name, p.team_abbreviation, p.minutes, p.games, x.need, x.pct
  from marts.mart_player_needs p
  cross join lateral (
    values
      ('three_pt', p.three_pt), ('rim_finishing', p.rim_finishing), ('ball_security', p.ball_security),
      ('off_rebounding', p.off_rebounding), ('ft_rate', p.ft_rate), ('playmaking', p.playmaking),
      ('rim_protection', p.rim_protection), ('perimeter_d', p.perimeter_d), ('def_rebounding', p.def_rebounding),
      ('transition_d', p.transition_d), ('forcing_tov', p.forcing_tov)
  ) as x (need, pct)
  where p.season = (select season from s) and p.is_qualified
),
fit as (
  -- A missing percentile counts as league average (50), so one gap doesn't wreck or flatter a score
  select pl.player_id,
         round(sum(h.weight * coalesce(pl.pct, 50))::numeric / sum(h.weight))::int as fit
  from players pl
  join holes h on h.need = pl.need
  group by pl.player_id
),
skills as (
  select player_id, json_object_agg(need, pct) as pcts
  from players
  group by player_id
),
rs as (
  -- Current rosters apply when we are looking at last season or this one; older seasons use who played where
  select max(roster_season) as roster_season,
         max(roster_season) - 1 <= (select season from s) as is_current
  from marts.mart_roster_status
),
status as (
  select * from marts.mart_roster_status where (select is_current from rs)
),
value as (
  select v.*,
         -- His team now (current rosters), or the team he finished the season with (older seasons)
         case when (select is_current from rs) then st.team_abbreviation else v.team_abbreviation end as team_now,
         coalesce(st.is_free_agent, false) as free_agent,
         -- Position comes from today's rosters even for older seasons: players rarely change position
         (select position from marts.mart_roster_status ps where ps.player_id = v.player_id) as position,
         st.contract_end,
         -- What he costs now: this season's salary, else last season's (free agents: last season's as a guide)
         coalesce(st.salary, st.last_salary, v.salary) as cost
  from marts.mart_player_value v
  left join status st on st.player_id = v.player_id
  where v.season = (select season from s)
),
team_strength as (
  select team_abbreviation, net_rating_rank
  from marts.mart_team_ratings r, s
  where r.season = s.season and r.season_type = 'Regular Season'
),
tiers as (
  -- Untouchable: his team's best player (VORP), a top-20 player in the league, a top-5 pick from the last three
  -- drafts who is 23 or younger, or the second-best player on a top-10 team (contenders keep their top two).
  -- Hard to get: any other team's second-best player, or anyone paid $35M or more.
  select x.*,
         case
           when team_now is not null and team_rank = 1 then 'untouchable'
           when league_rank <= 20 then 'untouchable'
           when rookie_star then 'untouchable'
           when team_now is not null and team_rank = 2 and team_net_rank <= 10 then 'untouchable'
           when team_now is not null and team_rank = 2 then 'hard'
           when cost >= 35e6 then 'hard'
           else 'gettable'
         end as tier,
         case
           when team_now is not null and team_rank = 1 then team_now || E'\'s best player'
           when league_rank <= 20 then 'Top-20 player in the league'
           when rookie_star then 'Top-5 pick on his rookie deal'
           when team_now is not null and team_rank = 2 and team_net_rank <= 10 then team_now || E'\'s second-best player, on a top-10 team'
           when team_now is not null and team_rank = 2 then team_now || E'\'s second-best player'
           when cost >= 35e6 then 'Paid $35M or more'
         end as reason
  from (
    select v.*,
           -- Free agents have no team, so they rank among themselves and never count as a team's best
           rank() over (partition by v.team_now order by v.vorp desc nulls last) as team_rank,
           rank() over (order by v.vorp desc nulls last) as league_rank,
           ts.net_rating_rank as team_net_rank,
           coalesce(
             case when v.draft_number ~ '^[0-9]+$' then v.draft_number::int end <= 5
             and case when v.draft_year ~ '^[0-9]+$' then v.draft_year::int end >= (select season from s) + 1 - 3
             and v.age <= 23,
             false) as rookie_star
    from value v
    left join team_strength ts on ts.team_abbreviation = v.team_now
  ) x
),
candidates as (
  -- Everyone who could join us: players on other teams and free agents, with a price
  select p.player_id, p.player_name, coalesce(t.team_now, p.team_abbreviation) as team, p.minutes, p.games,
         f.fit, k.pcts, t.cost as salary, t.age, t.ws, t.vorp, t.dollars_per_win_share,
         t.team_now in (select team_abbreviation from team_strength where net_rating_rank > 20) as seller,
         t.tier, t.free_agent, t.contract_end, t.reason, t.position
  from (select distinct player_id, player_name, team_abbreviation, minutes, games from players) p
  join fit f using (player_id)
  join skills k using (player_id)
  join tiers t using (player_id)
  where t.cost is not null
    and (t.free_agent or t.team_now is distinct from $2)
    and (t.team_now is not null or t.free_agent)
),
roster as (
  -- Our rotation. With current rosters: today's players, by last season's minutes (any team).
  -- Older seasons: the nine players with the most minutes for us that season.
  select g.player_id, max(g.player_name) as player_name, sum(g.minutes_played) as minutes, count(*) as games
  from marts.fct_player_game g, s
  where g.season = s.season and g.season_type = 'Regular Season' and g.did_play
    and case when (select is_current from rs)
          then g.player_id in (select player_id from status where team_abbreviation = $2)
          else g.team_abbreviation = $2 end
  group by g.player_id
  order by sum(g.minutes_played) desc
  limit 9
),
trend as (
  -- Rolling 10-game totals for every measure that has game-by-game data (transition defense does not)
  select game_number, game_date,
         sum(fga) over w as fga, sum(fgm) over w as fgm, sum(fg3m) over w as fg3m, sum(fta) over w as fta,
         sum(oreb) over w as oreb, sum(dreb) over w as dreb, sum(ast) over w as ast, sum(tov) over w as tov,
         sum(poss) over w as poss, sum(rim_fga) over w as rim_fga, sum(rim_fgm) over w as rim_fgm,
         sum(opp_fg3a) over w as opp_fg3a, sum(opp_fg3m) over w as opp_fg3m, sum(opp_oreb) over w as opp_oreb,
         sum(opp_dreb) over w as opp_dreb, sum(opp_tov) over w as opp_tov, sum(opp_poss) over w as opp_poss,
         sum(opp_rim_fga) over w as opp_rim_fga, sum(opp_rim_fgm) over w as opp_rim_fgm
  from marts.mart_team_need_games t, s
  where t.season = s.season and t.team_abbreviation = $2
  window w as (order by game_number rows between 9 preceding and current row)
)
select json_build_object(
  'season', (select season from s),
  'seasonLabel', (select min(season_label) from needs),
  'seasons', (select coalesce(json_agg(season order by season desc), '[]'::json)
              from (select distinct season from marts.mart_team_needs where team_abbreviation = $2 and games >= 20) x),
  'side', $3::text,
  'rosterSeason', (select roster_season from rs where is_current),
  'needs', (select coalesce(json_agg(json_build_object(
      'need', need, 'side', side, 'higherIsBetter', higher_is_better, 'value', value::float,
      'leagueAvg', league_avg::float, 'best', best_value::float, 'rank', league_rank, 'pctile', pctile
    ) order by side desc, need), '[]'::json) from needs),
  'holes', (select coalesce(json_agg(need order by weight desc, need), '[]'::json) from holes),
  -- Measure values over the last 10 games, from game 10 on
  'trend', (select coalesce(json_agg(json_build_object(
      'g', game_number, 'date', game_date,
      'three_pt', round(100.0 * fg3m / nullif(fga, 0), 1)::float,
      'rim_finishing', round(rim_fgm::numeric / nullif(rim_fga, 0), 3)::float,
      'ball_security', round(100.0 * tov / nullif(poss, 0), 1)::float,
      'off_rebounding', round(oreb::numeric / nullif(oreb + opp_dreb, 0), 3)::float,
      'ft_rate', round(fta::numeric / nullif(fga, 0), 3)::float,
      'playmaking', round(ast::numeric / nullif(fgm, 0), 3)::float,
      'rim_protection', round(opp_rim_fgm::numeric / nullif(opp_rim_fga, 0), 3)::float,
      'perimeter_d', round(opp_fg3m::numeric / nullif(opp_fg3a, 0), 3)::float,
      'def_rebounding', round(dreb::numeric / nullif(dreb + opp_oreb, 0), 3)::float,
      'forcing_tov', round(100.0 * opp_tov / nullif(opp_poss, 0), 1)::float
    ) order by game_number), '[]'::json) from trend where game_number >= 10),
  'roster', (select coalesce(json_agg(json_build_object(
      'id', r.player_id, 'name', r.player_name, 'mpg', round(r.minutes / r.games, 1)::float,
      'fit', f.fit, 'pcts', k.pcts, 'position', ps.position
    ) order by r.minutes desc), '[]'::json)
    from roster r left join fit f using (player_id) left join skills k using (player_id)
    left join marts.mart_roster_status ps using (player_id)),
  -- [id, name, team, fit, salary, age, ws, vorp, $ per WS, seller, minutes, games, percentiles by need,
  --  tier, free agent, contract end season, why untouchable or hard to get, position]
  'candidates', (select coalesce(json_agg(json_build_array(
      player_id, player_name, team, fit, salary, age::float, ws::float, vorp::float,
      dollars_per_win_share, coalesce(seller, false), round(minutes)::int, games, pcts,
      tier, free_agent, contract_end, reason, position
    ) order by fit desc, salary), '[]'::json) from candidates)
) as data;
