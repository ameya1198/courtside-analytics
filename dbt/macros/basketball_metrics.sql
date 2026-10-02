{#
  Reusable basketball formulas. Call them inside a model like this:
      {{ true_shooting_pct('pts', 'fga', 'fta') }} as ts_pct
  dbt swaps the call for the SQL below before it runs.
#}

{# True shooting %: points per shot attempt, counting 3s and free throws properly. #}
{% macro true_shooting_pct(pts, fga, fta) %}
    round({{ pts }}::numeric / nullif(2 * ({{ fga }} + 0.44 * {{ fta }}), 0), 3)
{% endmacro %}

{# Per 36: what a stat would be over 36 minutes. Noisy for players with few minutes. #}
{% macro per_36(stat, minutes) %}
    round({{ stat }}::numeric * 36 / nullif({{ minutes }}, 0), 1)
{% endmacro %}
