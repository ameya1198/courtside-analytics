.PHONY: check-db lint test dbt-build

check-db:
	python -m ingestion.db --check

lint:
	ruff check ingestion
	sqlfluff lint dbt/models --dialect postgres

test:
	pytest -q

dbt-build:
	cd dbt && dbt build
