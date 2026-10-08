{#
  Helpers for mart_player_needs (Roster Needs page).
#}

{# Percentile of one stat among qualified players with a value, 0 to 100 (100 = best). Lower-is-better stats are flipped. #}
{% macro need_pctile(col, higher_is_better=true) %}
    case when is_qualified and {{ col }} is not null then
        100 * percent_rank() over (
            partition by season, is_qualified and {{ col }} is not null
            order by {{ col }} {{ '' if higher_is_better else 'desc' }}
        )
    end
{% endmacro %}

{# Average of two percentiles, using whichever exist. Null when neither does. #}
{% macro blend_pctiles(a, b) %}
    round((coalesce({{ a }}, 0) + coalesce({{ b }}, 0)) / nullif(({{ a }} is not null)::int + ({{ b }} is not null)::int, 0))::int
{% endmacro %}
