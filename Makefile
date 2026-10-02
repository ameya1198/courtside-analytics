.PHONY: check-db lint test load-reference load-current backfill dbt-build

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

dbt-build:
	cd dbt && dbt build
