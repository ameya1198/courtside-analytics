.PHONY: check-db lint test load-reference load-current backfill load-shots backfill-shots dbt-build load-extras backfill-extras load-salaries

check-db:
	python -m ingestion.db --check

lint:
	ruff check ingestion tests
	sqlfluff lint dbt/models --dialect postgres

test:
	pytest -q

# Teams and players (small lists, no NBA website call)
load-reference:
	python -m ingestion.load --reference

# Current season only. This is what the nightly job runs.
load-current:
	python -m ingestion.load --current

# Every season from BACKFILL_START_SEASON. Run once, takes a while.
backfill:
	python -m ingestion.load --backfill

# New shots for the current season (3 day overlap). Part of the nightly job.
load-shots:
	python -m ingestion.load --shots

# All shots since SHOTS_START_SEASON. Run once, takes a while.
backfill-shots:
	python -m ingestion.load --shots-backfill

dbt-build:
	cd dbt && set -a && . ../.env && set +a && dbt build

# Clutch splits, player bio (age) and schedule for this season. Part of the nightly job.
load-extras:
	python -m ingestion.load --extras

# Clutch and bio for every season since BACKFILL_START_SEASON. Run once.
backfill-extras:
	python -m ingestion.load --extras-backfill

# Salaries from Basketball-Reference since SALARY_START_SEASON. Run a few times a year.
load-salaries:
	python -m ingestion.load --salaries
