-- Free tier limit is 500 MB. Run anytime to see where space is going.
select
    n.nspname                                            as schema_name,
    c.relname                                            as table_name,
    pg_size_pretty(pg_total_relation_size(c.oid))        as total_size
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r'
  and n.nspname in ('raw', 'staging', 'marts')
order by pg_total_relation_size(c.oid) desc;
