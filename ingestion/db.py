"""Warehouse connection helpers. Reads credentials from .env, never hardcoded."""
import argparse
import os

from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL, Engine

load_dotenv()


def get_engine() -> Engine:
    url = URL.create(
        "postgresql+psycopg2",
        username=os.environ["SUPABASE_DB_USER"],
        password=os.environ["SUPABASE_DB_PASSWORD"],
        host=os.environ["SUPABASE_DB_HOST"],
        port=int(os.environ.get("SUPABASE_DB_PORT", "5432")),
        database=os.environ.get("SUPABASE_DB_NAME", "postgres"),
    )
    return create_engine(url, pool_pre_ping=True)


def check() -> None:
    with get_engine().connect() as conn:
        schemas = conn.execute(
            text(
                "select schema_name from information_schema.schemata "
                "where schema_name in ('raw','staging','marts') order by 1"
            )
        ).scalars().all()
        size_mb = conn.execute(
            text("select pg_database_size(current_database()) / 1024.0 / 1024.0")
        ).scalar_one()
    print(f"Connected. Schemas found: {schemas}")
    print(f"Database size: {size_mb:.1f} MB of 500 MB free tier")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    if args.check:
        check()
