{#
  By default dbt names a schema "<default>_<custom>", which would give us staging_staging.
  This override makes dbt use the exact schema name we ask for (staging, marts).
#}
{% macro generate_schema_name(custom_schema_name, node) -%}
    {%- if custom_schema_name is none -%}
        {{ target.schema }}
    {%- else -%}
        {{ custom_schema_name | trim }}
    {%- endif -%}
{%- endmacro %}
