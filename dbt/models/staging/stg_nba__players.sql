-- One clean row per player in NBA history.
select
    id as player_id,
    full_name as player_name,
    first_name,
    last_name,
    is_active
from {{ source('raw', 'players') }}
