-- One row per calendar day, from before the first season to after the next one.
-- Handy for calendar charts and for finding days with no games.
with days as (
    -- date_spine comes from dbt_utils. The end date is not included.
    {{ dbt_utils.date_spine(
        datepart="day",
        start_date="cast('2015-10-01' as date)",
        end_date="cast('2027-07-01' as date)"
    ) }}
)

select
    cast(date_day as date) as date_day,
    extract(year from date_day)::int as year,
    extract(month from date_day)::int as month,
    to_char(date_day, 'Dy') as day_name,
    extract(isodow from date_day)::int as day_of_week,   -- 1 = Monday, 7 = Sunday
    extract(isodow from date_day) in (6, 7) as is_weekend,
    -- A season starts in October, so Oct to Dec belong to the season starting that year
    case
        when extract(month from date_day) >= 10 then extract(year from date_day)::int
        else extract(year from date_day)::int - 1
    end as season
from days
