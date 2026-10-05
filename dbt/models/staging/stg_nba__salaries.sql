-- One salary per player per season.
-- Team pages (what a player was actually paid that season) win over the contracts page.
-- A traded player shows up on two team pages with the same full salary, so we keep the largest figure.
with ranked as (
    select
        season,
        player_id,
        bbref_id,
        player_name,
        team,
        salary,
        source,
        row_number() over (
            partition by season, bbref_id
            order by case when source = 'team_page' then 0 else 1 end, salary desc
        ) as pick
    from {{ source('raw', 'salaries') }}
    where salary > 0
)

select
    season,
    season || '-' || right((season + 1)::text, 2) as season_label,
    player_id,
    bbref_id,
    player_name,
    team as bbref_team,
    salary,
    source
from ranked
where pick = 1
