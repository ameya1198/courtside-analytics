-- One salary per player per season.
-- Team pages (what a player was actually paid that season) win over the contracts page.
-- A traded player shows up on two team pages with the same full salary, so we keep the largest figure.
with bio_names as (
    -- Recent players missing from nba_api's built-in list still appear in the bio data with their NBA id.
    select distinct on (lower(player_name)) lower(player_name) as name_key, player_id
    from {{ ref('stg_nba__player_bio') }}
    order by lower(player_name), season desc
),

ranked as (
    select
        season,
        coalesce(salaries.player_id, bio_names.player_id) as player_id,
        bbref_id,
        player_name,
        team,
        salary,
        source,
        row_number() over (
            partition by season, bbref_id
            order by case when source = 'team_page' then 0 else 1 end, salary desc
        ) as pick
    from {{ source('raw', 'salaries') }} as salaries
    left join bio_names
        on lower(salaries.player_name) = bio_names.name_key
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
