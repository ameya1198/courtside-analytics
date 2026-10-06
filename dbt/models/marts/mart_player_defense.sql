-- One row per player x team x regular season: how a player's team defends with him, and how shooters
-- do against him. Used by the Defense tab (impact table) and the Player Profile defense card.
--   onoff_drtg       = team defensive rating with him off the court minus with him on. Positive is good:
--                      the team allows fewer points per 100 possessions when he plays.
--   dfg_diff_*       = opponent FG% when he is the closest defender minus what those shooters usually hit.
--                      Negative is good. Overall, at the rim (under 6 feet) and on threes.
-- Defended shots and hustle are whole-season numbers for the player, so a traded player has the same
-- values on both of his team rows. Qualified = 500+ on-court minutes and 20+ games for that team.
with on_off as (
    select *
    from {{ ref('stg_nba__player_on_off') }}
    where season_type = 'Regular Season'
),

impact as (
    select
        on_c.player_id,
        on_c.player_name,
        on_c.team_id,
        on_c.team_abbreviation,
        on_c.season,
        on_c.season_label,
        on_c.games,
        on_c.minutes as on_min,
        on_c.def_rating as on_drtg,
        off_c.def_rating as off_drtg,
        round(off_c.def_rating - on_c.def_rating, 1) as onoff_drtg
    from on_off as on_c
    left join on_off as off_c
        on on_c.team_id = off_c.team_id
        and on_c.player_id = off_c.player_id
        and on_c.season = off_c.season
        and off_c.court_status = 'off'
    where on_c.court_status = 'on'
),

defended as (
    select
        player_id,
        season,
        max(d_fga) filter (where category = 'Overall') as dfga_overall,
        max(d_fg_pct) filter (where category = 'Overall') as dfg_pct_overall,
        round(max(dfg_diff) filter (where category = 'Overall'), 3) as dfg_diff_overall,
        max(d_fga) filter (where category = 'Less Than 6Ft') as dfga_rim,
        round(max(dfg_diff) filter (where category = 'Less Than 6Ft'), 3) as dfg_diff_rim,
        max(d_fga) filter (where category = '3 Pointers') as dfga_three,
        round(max(dfg_diff) filter (where category = '3 Pointers'), 3) as dfg_diff_three
    from {{ ref('stg_nba__player_defended_shots') }}
    where season_type = 'Regular Season'
    group by player_id, season
),

hustle as (
    select
        player_id,
        season,
        {{ per_36('sum(contested_shots)', 'sum(minutes)') }} as contests_per_36,
        {{ per_36('sum(deflections)', 'sum(minutes)') }} as deflections_per_36,
        {{ per_36('sum(charges_drawn)', 'sum(minutes)') }} as charges_per_36,
        {{ per_36('sum(loose_balls_recovered)', 'sum(minutes)') }} as loose_balls_per_36
    from {{ ref('stg_nba__player_hustle') }}
    where season_type = 'Regular Season'
    group by player_id, season
),

salaries as (
    -- Same rule as mart_player_value: one salary per player per season.
    select distinct on (player_id, season) player_id, season, salary
    from {{ ref('stg_nba__salaries') }}
    where player_id is not null
    order by player_id, season, salary desc
),

joined as (
    select
        impact.*,
        defended.dfga_overall,
        defended.dfg_pct_overall,
        defended.dfg_diff_overall,
        defended.dfga_rim,
        defended.dfg_diff_rim,
        defended.dfga_three,
        defended.dfg_diff_three,
        hustle.contests_per_36,
        hustle.deflections_per_36,
        hustle.charges_per_36,
        hustle.loose_balls_per_36,
        salaries.salary,
        impact.on_min >= 500 and impact.games >= 20 as is_qualified
    from impact
    left join defended
        on impact.player_id = defended.player_id
        and impact.season = defended.season
    left join hustle
        on impact.player_id = hustle.player_id
        and impact.season = hustle.season
    left join salaries
        on impact.player_id = salaries.player_id
        and impact.season = salaries.season
),

percentiles as (
    -- League percentiles among qualified players in the same season. 100 is best for all four.
    select
        player_id,
        team_id,
        season,
        round(100 * percent_rank() over (partition by season order by onoff_drtg))::int as onoff_pctile,
        round(100 * percent_rank() over (partition by season order by dfg_diff_overall desc))::int as dfg_pctile,
        round(100 * percent_rank() over (partition by season order by contests_per_36))::int as contests_pctile,
        round(100 * percent_rank() over (partition by season order by deflections_per_36))::int as deflections_pctile
    from joined
    where is_qualified
        and onoff_drtg is not null
        and dfg_diff_overall is not null
        and contests_per_36 is not null
)

select
    joined.*,
    percentiles.onoff_pctile,
    percentiles.dfg_pctile,
    percentiles.contests_pctile,
    percentiles.deflections_pctile
from joined
left join percentiles
    on joined.player_id = percentiles.player_id
    and joined.team_id = percentiles.team_id
    and joined.season = percentiles.season
