-- One row per team x regular season x need: how the team does on each of the 11 Roster Needs measures,
-- with its league rank (1 = best) and percentile (100 = best). The Roster Needs page calls the worst-ranked
-- needs a team's holes. Player-level skills for the same needs are in mart_player_needs.
with totals as (
    select
        team_id,
        team_abbreviation,
        season,
        season_label,
        count(*) as games,
        sum(fga) as fga,
        sum(fgm) as fgm,
        sum(fg3m) as fg3m,
        sum(fta) as fta,
        sum(oreb) as oreb,
        sum(dreb) as dreb,
        sum(ast) as ast,
        sum(tov) as tov,
        sum(poss) as poss,
        sum(rim_fga) as rim_fga,
        sum(rim_fgm) as rim_fgm,
        sum(opp_fg3a) as opp_fg3a,
        sum(opp_fg3m) as opp_fg3m,
        sum(opp_oreb) as opp_oreb,
        sum(opp_dreb) as opp_dreb,
        sum(opp_tov) as opp_tov,
        sum(opp_poss) as opp_poss,
        sum(opp_rim_fga) as opp_rim_fga,
        sum(opp_rim_fgm) as opp_rim_fgm
    from {{ ref('mart_team_need_games') }}
    group by team_id, team_abbreviation, season, season_label
),

misc as (
    select team_id, season, opp_pts_fb
    from {{ ref('mart_team_defense_misc') }}
    where season_type = 'Regular Season'
),

needs as (
    -- One row per need. higher_is_better says which way is good.
    select
        totals.team_id,
        totals.team_abbreviation,
        totals.season,
        totals.season_label,
        totals.games,
        need.need,
        need.side,
        need.higher_is_better,
        need.value
    from totals
    left join misc
        on totals.team_id = misc.team_id
        and totals.season = misc.season
    cross join lateral (
        values
            ('three_pt', 'Offense', true, round(100.0 * totals.fg3m / nullif(totals.fga, 0), 1)),
            ('rim_finishing', 'Offense', true, round(totals.rim_fgm::numeric / nullif(totals.rim_fga, 0), 3)),
            ('ball_security', 'Offense', false, round(100.0 * totals.tov / nullif(totals.poss, 0), 1)),
            ('off_rebounding', 'Offense', true, round(totals.oreb::numeric / nullif(totals.oreb + totals.opp_dreb, 0), 3)),
            ('ft_rate', 'Offense', true, round(totals.fta::numeric / nullif(totals.fga, 0), 3)),
            ('playmaking', 'Offense', true, round(totals.ast::numeric / nullif(totals.fgm, 0), 3)),
            ('rim_protection', 'Defense', false, round(totals.opp_rim_fgm::numeric / nullif(totals.opp_rim_fga, 0), 3)),
            ('perimeter_d', 'Defense', false, round(totals.opp_fg3m::numeric / nullif(totals.opp_fg3a, 0), 3)),
            ('def_rebounding', 'Defense', true, round(totals.dreb::numeric / nullif(totals.dreb + totals.opp_oreb, 0), 3)),
            ('transition_d', 'Defense', false, round(misc.opp_pts_fb::numeric, 1)),
            ('forcing_tov', 'Defense', true, round(100.0 * totals.opp_tov / nullif(totals.opp_poss, 0), 1))
    ) as need (need, side, higher_is_better, value)
),

ranked as (
    select
        *,
        rank() over (
            partition by season, need
            order by case when higher_is_better then value else -value end desc
        )::int as league_rank,
        count(*) over (partition by season, need) as teams,
        round(avg(value) over (partition by season, need), 3) as league_avg,
        case
            when higher_is_better then max(value) over (partition by season, need)
            else min(value) over (partition by season, need)
        end as best_value
    from needs
    where value is not null
)

select
    team_id,
    team_abbreviation,
    season,
    season_label,
    games,
    need,
    side,
    higher_is_better,
    value,
    league_avg,
    best_value,
    league_rank,
    -- 100 = best in the league, 0 = worst
    round(100.0 * (teams - league_rank) / nullif(teams - 1, 0))::int as pctile
from ranked
