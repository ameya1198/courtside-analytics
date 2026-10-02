# dbt project

dbt turns SQL files into tables and views in the warehouse, and tests them.

```
models/staging/   clean copy of each raw table (views)
models/marts/     tables the dashboard reads (dimensions, facts, analysis)
macros/           reusable SQL snippets
seeds/            small CSV files loaded as tables
tests/            custom checks
```

## Run it

Always run dbt from this folder. Load your passwords once per terminal window:

```
cd dbt
set -a; source ../.env; set +a
dbt debug              # checks the connection
dbt source freshness   # is the raw data recent?
dbt run                # builds the models
dbt test               # runs the checks
dbt build              # run and test together, in the right order
```

Build or test one model: `dbt run --select stg_nba__teams`
Build a model and everything after it: `dbt run --select stg_nba__teams+`
