"""
Import transactions CSV (often Windows-1252 / Excel export) into PostgreSQL.

Usage:
  python scripts/import_transactions.py INPUT.csv
"""

from __future__ import annotations

import csv
import os
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path

COLUMNS = [
    "id",
    "user_id",
    "entity_id",
    "user_identifier",
    "full_name",
    "transaction_id",
    "sub_transaction_id",
    "service_id",
    "product_id",
    "access_channel",
    "transaction_type",
    "transaction_amount",
    "before_balance",
    "after_balance",
    "unit_id",
    "ucp_id",
    "wallet_id",
    "pouch_id",
    "entity_name",
    "ucp_name",
    "wallet_name",
    "pouch_name",
    "service_name",
    "product_name",
    "status",
    "vendor_id",
    "vendor",
    "external_transaction_status",
    "error_code",
    "error_message",
    "vendor_transaction_id",
    "vendor_response_code",
    "vendor_transaction_message",
    "tx_reference",
    "remarks",
    "idempotency_key",
    "created_at",
    "updated_at",
    "deleted_at",
    "unique_transaction_id",
    "commission",
    "fee",
    "bonus",
    "loyalty_points",
    "external_transaction_id",
    "internal_status",
    "flagged_at",
]

TIMESTAMP_COLUMNS = {"created_at", "updated_at", "deleted_at", "flagged_at"}


def clean_header(name: str) -> str:
    name = name.strip()
    if name.startswith("\ufeff"):
        name = name[1:]
    if name.startswith("ï»¿"):
        name = name[3:]
    return name


def empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


def normalize_timestamp(value: str | None) -> str | None:
    value = empty_to_none(value)
    if not value:
        return None

    for fmt in (
        "%m/%d/%Y %H:%M",
        "%m/%d/%Y %H:%M:%S",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
    ):
        try:
            return datetime.strptime(value, fmt).strftime("%Y-%m-%d %H:%M:%S")
        except ValueError:
            continue

    return value


def run_psql(sql: str) -> subprocess.CompletedProcess[str]:
    env = {**os.environ, "PGPASSWORD": os.environ.get("PGPASSWORD", "admin123")}
    return subprocess.run(
        ["psql", "-h", "localhost", "-U", "postgres", "-d", "bireports", "-v", "ON_ERROR_STOP=1", "-c", sql],
        capture_output=True,
        text=True,
        env=env,
        check=False,
    )


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python import_transactions.py INPUT.csv")
        return 1

    input_path = Path(sys.argv[1])
    rows_out: list[dict[str, str]] = []

    # Excel/BI exports: UTF-8 BOM header + invalid bytes in text fields are common.
    with input_path.open("r", encoding="utf-8-sig", errors="replace", newline="") as infile:
        reader = csv.DictReader(infile)
        if reader.fieldnames:
            reader.fieldnames = [clean_header(name) for name in reader.fieldnames]

        missing = [col for col in COLUMNS if col not in (reader.fieldnames or [])]
        if missing:
            print(f"CSV missing columns: {', '.join(missing)}")
            return 1

        for row in reader:
            cleaned: dict[str, str] = {}
            for col in COLUMNS:
                raw = empty_to_none(row.get(col))
                if col in TIMESTAMP_COLUMNS:
                    cleaned[col] = normalize_timestamp(raw) or ""
                else:
                    cleaned[col] = raw or ""
            rows_out.append(cleaned)

    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        newline="",
        suffix=".csv",
        delete=False,
    ) as tmp:
        writer = csv.DictWriter(tmp, fieldnames=COLUMNS)
        writer.writeheader()
        writer.writerows(rows_out)
        tmp_path = Path(tmp.name)

    print(f"Prepared {len(rows_out)} rows (UTF-8, encoding issues replaced)")

    setup = run_psql(
        """
CREATE TABLE IF NOT EXISTS staging_transactions (LIKE transactions);
TRUNCATE staging_transactions;
TRUNCATE transactions;
""",
    )
    if setup.returncode != 0:
        print(setup.stderr)
        return 1

    copy_path = str(tmp_path).replace("\\", "/")
    copy = subprocess.run(
        [
            "psql",
            "-h",
            "localhost",
            "-U",
            "postgres",
            "-d",
            "bireports",
            "-c",
            f"\\copy staging_transactions FROM '{copy_path}' CSV HEADER",
        ],
        capture_output=True,
        text=True,
        env={**os.environ, "PGPASSWORD": os.environ.get("PGPASSWORD", "admin123")},
    )
    if copy.returncode != 0:
        print(copy.stderr)
        return 1

    insert = run_psql(
        """
INSERT INTO transactions SELECT * FROM staging_transactions;
SELECT COUNT(*) AS imported_rows FROM transactions;
""",
    )
    print(insert.stdout)
    if insert.returncode != 0:
        print(insert.stderr)
        return 1

    tmp_path.unlink(missing_ok=True)
    print("Import complete.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
