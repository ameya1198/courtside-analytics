# dbt project

Phase 2 starts here. You will run `dbt init` yourself, so this folder is intentionally empty apart from the profile template.

```
cd dbt
dbt init courtside        # when asked for adapter choose postgres
cp profiles.yml.example ~/.dbt/profiles.yml
dbt debug
```

Model layers: `staging` (views), `intermediate` (views), `marts` (tables, incremental for facts).
