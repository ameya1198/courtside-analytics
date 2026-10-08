-- Where every relevant player stands right now (Roster Needs page). One row per player who is on a current
-- roster or played last season. Players who played last season and are on no roster are free agents.
--   salary          what he is paid this season (rostered players), from Basketball-Reference contracts
--   contract_end    the last season his current deal pays him; options are counted as years under contract
--   last_salary     what he was paid last season, the price guide for a free agent
with roster_season as (
    select max(season) as season
    from {{ ref('stg_nba__team_rosters') }}
),

rostered as (
    select r.*
    from {{ ref('stg_nba__team_rosters') }} as r
    inner join roster_season using (season)
),

last_season as (
    -- Everyone who played last season, with the team he finished it on
    select
        player_id,
        max(player_name) as player_name,
        (array_agg(team_abbreviation order by game_date desc))[1] as last_team,
        sum(minutes_played) as last_minutes
    from {{ ref('fct_player_game') }}
    where season = (select season - 1 from roster_season)
        and season_type = 'Regular Season'
        and did_play
    group by player_id
),

salaries as (
    select player_id, season, salary
    from {{ ref('stg_nba__salaries') }}
    where player_id is not null
),

contracts as (
    select
        salaries.player_id,
        max(salaries.salary) filter (where salaries.season = roster_season.season) as salary,
        max(salaries.season) filter (where salaries.season >= roster_season.season) as contract_end,
        max(salaries.salary) filter (where salaries.season = roster_season.season - 1) as last_salary
    from salaries
    cross join roster_season
    group by salaries.player_id
),

players as (
    select player_id from rostered
    union
    select player_id from last_season
)

select
    players.player_id,
    coalesce(rostered.player_name, last_season.player_name) as player_name,
    roster_season.season as roster_season,
    rostered.team_abbreviation,
    rostered.team_id,
    rostered.position,
    rostered.years_in_league,
    rostered.player_id is null as is_free_agent,
    last_season.last_team,
    round(last_season.last_minutes) as last_minutes,
    contracts.salary,
    case when rostered.player_id is not null then contracts.contract_end end as contract_end,
    contracts.last_salary
from players
cross join roster_season
left join rostered
    on players.player_id = rostered.player_id
left join last_season
    on players.player_id = last_season.player_id
left join contracts
    on players.player_id = contracts.player_id
