-- One row per player per regular season: production next to pay and age.
-- Production = NBA fantasy points per game (points, rebounds, assists, steals, blocks, minus turnovers).
-- It is a simple, well-known single number, good enough to compare value across players.
-- Qualified = played at least 48% of the most games any team played, and 20+ minutes a game.
with games as (
    select *
    from {{ ref('fct_player_game') }}
    where season_type = 'Regular Season' and did_play
),

team_games as (
    select season, max(n) as max_games
    from (
        select season, team_id, count(distinct game_id) as n
        from games
        group by season, team_id
    ) as per_team
    group by season
),

production as (
    select
        player_id,
        max(player_name) as player_name,
        season,
        max(season_label) as season_label,
        (array_agg(team_abbreviation order by game_date desc))[1] as team_abbreviation,
        (array_agg(team_id order by game_date desc))[1] as team_id,
        count(*) as games,
        round(sum(minutes_played) / count(*), 1) as mpg,
        round(sum(pts)::numeric / count(*), 1) as ppg,
        round(sum(reb)::numeric / count(*), 1) as rpg,
        round(sum(ast)::numeric / count(*), 1) as apg,
        round(sum(fantasy_pts) / count(*), 1) as fantasy_ppg,
        sum(fantasy_pts) as fantasy_pts_total,
        {{ true_shooting_pct('sum(pts)', 'sum(fga)', 'sum(fta)') }} as ts_pct,
        {{ per_36('sum(pts)', 'sum(minutes_played)') }} as pts_per_36
    from games
    group by player_id, season
),

bio as (
    select distinct on (player_id, season) player_id, season, age, height_inches, country, draft_year, draft_number
    from {{ ref('stg_nba__player_bio') }}
    order by player_id, season, season_type
)

select
    production.*,
    bio.age,
    bio.height_inches,
    bio.country,
    bio.draft_year,
    bio.draft_number,
    salaries.salary,
    salaries.source as salary_source,
    production.games >= ceil(0.48 * team_games.max_games) and production.mpg >= 20 as is_qualified,
    -- Dollars paid per fantasy point produced. Lower means better value.
    round(salaries.salary / nullif(production.fantasy_pts_total, 0)) as dollars_per_fantasy_pt
from production
inner join team_games
    on production.season = team_games.season
left join bio
    on production.player_id = bio.player_id
    and production.season = bio.season
left join (
    -- Two Basketball-Reference rows can match one NBA id in rare name clashes. Keep one.
    select distinct on (player_id, season) player_id, season, salary, source
    from {{ ref('stg_nba__salaries') }}
    where player_id is not null
    order by player_id, season, salary desc
) as salaries
    on production.player_id = salaries.player_id
    and production.season = salaries.season
