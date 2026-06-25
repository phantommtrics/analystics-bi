"""
Fix and import request_approvals CSV into PostgreSQL.

Handles approval_request_data exported as Python dicts ('key': None),
valid JSON arrays, and rows with broken nested JSON (stores NULL for those).

Usage:
  python scripts/import_request_approvals.py INPUT.csv
"""

from __future__ import annotations

import ast
import csv
import json
import os
import subprocess
import sys
import tempfile
from pathlib import Path

JSON_COLUMN = "approval_request_data"
COLUMNS = [
    "id",
    "approveable_type",
    "approveable_id",
    "approval_type",
    "access_channel",
    "action",
    "status",
    "remarks",
    JSON_COLUMN,
    "created_by",
    "created_at",
    "updated_at",
    "approved_by",
]


def normalize_json(raw: str) -> str | None:
    raw = raw.strip()
    if not raw:
        return None

    try:
        return json.dumps(json.loads(raw), ensure_ascii=False)
    except json.JSONDecodeError:
        pass

    try:
        return json.dumps(ast.literal_eval(raw), ensure_ascii=False)
    except (SyntaxError, ValueError):
        pass

    return None


def empty_to_none(value: str | None) -> str | None:
    if value is None:
        return None
    value = value.strip()
    return value if value else None


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
        print("Usage: python import_request_approvals.py INPUT.csv")
        return 1

    input_path = Path(sys.argv[1])
    fixed_rows: list[dict[str, str | None]] = []
    skipped_json = 0

    with input_path.open("r", encoding="utf-8-sig", newline="") as infile:
        reader = csv.DictReader(infile)
        for line_no, row in enumerate(reader, start=2):
            normalized = normalize_json(row.get(JSON_COLUMN) or "")
            if (row.get(JSON_COLUMN) or "").strip() and normalized is None:
                skipped_json += 1
                if skipped_json <= 10:
                    print(
                        f"Warning line {line_no}: could not parse {JSON_COLUMN}; importing as NULL",
                    )

            fixed_rows.append(
                {
                    **{col: empty_to_none(row.get(col)) for col in COLUMNS if col != JSON_COLUMN},
                    JSON_COLUMN: normalized,
                },
            )

    if skipped_json > 10:
        print(f"... and {skipped_json - 10} more rows with NULL JSON payload")

    with tempfile.NamedTemporaryFile(
        "w",
        encoding="utf-8",
        newline="",
        suffix=".csv",
        delete=False,
    ) as tmp:
        writer = csv.DictWriter(tmp, fieldnames=COLUMNS, extrasaction="ignore")
        writer.writeheader()
        for row in fixed_rows:
            writer.writerow({col: row.get(col) or "" for col in COLUMNS})
        tmp_path = Path(tmp.name)

    print(f"Prepared {len(fixed_rows)} rows ({skipped_json} with NULL JSON payload)")

    setup = run_psql(
        """
CREATE TABLE IF NOT EXISTS staging_request_approvals (
  id text,
  approveable_type text,
  approveable_id text,
  approval_type text,
  access_channel text,
  action text,
  status text,
  remarks text,
  approval_request_data text,
  created_by text,
  created_at text,
  updated_at text,
  approved_by text
);
TRUNCATE staging_request_approvals;
TRUNCATE request_approvals;
""",
    )
    if setup.returncode != 0:
        print(setup.stderr)
        return 1

    copy_path = str(tmp_path).replace("\\", "/")
    copy = subprocess.run(
        ["psql", "-h", "localhost", "-U", "postgres", "-d", "bireports", "-c", f"\\copy staging_request_approvals FROM '{copy_path}' CSV HEADER"],
        capture_output=True,
        text=True,
        env={**os.environ, "PGPASSWORD": os.environ.get("PGPASSWORD", "admin123")},
    )
    if copy.returncode != 0:
        print(copy.stderr)
        return 1

    insert = run_psql(
        """
INSERT INTO request_approvals (
  id, approveable_type, approveable_id, approval_type, access_channel, action,
  status, remarks, approval_request_data, created_by, created_at, updated_at, approved_by
)
SELECT
  NULLIF(id, '')::bigint,
  NULLIF(approveable_type, ''),
  NULLIF(approveable_id, '')::bigint,
  NULLIF(approval_type, ''),
  NULLIF(access_channel, ''),
  NULLIF(action, ''),
  NULLIF(status, ''),
  NULLIF(remarks, ''),
  CASE
    WHEN NULLIF(approval_request_data, '') IS NULL THEN NULL
    ELSE approval_request_data::json
  END,
  NULLIF(created_by, '')::bigint,
  NULLIF(created_at, '')::timestamp,
  NULLIF(updated_at, '')::timestamp,
  NULLIF(approved_by, '')::bigint
FROM staging_request_approvals;

SELECT COUNT(*) AS imported_rows FROM request_approvals;
SELECT COUNT(*) AS rows_with_json FROM request_approvals WHERE approval_request_data IS NOT NULL;
SELECT COUNT(*) AS update_profile_rows FROM request_approvals WHERE approval_type = 'UpdateProfile';
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
