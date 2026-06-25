"""
Convert request_approvals CSV exports where approval_request_data uses
Python dict syntax ('key': None) into valid JSON for PostgreSQL import.

Usage:
  python scripts/fix_request_approvals_csv.py INPUT.csv OUTPUT.csv
"""

from __future__ import annotations

import ast
import csv
import json
import sys
from pathlib import Path

JSON_COLUMN = "approval_request_data"


def python_dict_to_json(raw: str) -> str:
    raw = raw.strip()
    if not raw:
        return ""

    try:
        parsed = json.loads(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except json.JSONDecodeError:
        pass

    try:
        parsed = ast.literal_eval(raw)
        return json.dumps(parsed, ensure_ascii=False)
    except (SyntaxError, ValueError):
        pass

    raise ValueError(f"Unparseable JSON payload: {raw[:120]}...")


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python fix_request_approvals_csv.py INPUT.csv OUTPUT.csv")
        return 1

    input_path = Path(sys.argv[1])
    output_path = Path(sys.argv[2])

    with input_path.open("r", encoding="utf-8-sig", newline="") as infile:
        reader = csv.DictReader(infile)
        if not reader.fieldnames or JSON_COLUMN not in reader.fieldnames:
            print(f"Expected column '{JSON_COLUMN}' in CSV header")
            return 1

        rows: list[dict[str, str]] = []
        for line_no, row in enumerate(reader, start=2):
            raw_json = row.get(JSON_COLUMN) or ""
            if raw_json:
                try:
                    row[JSON_COLUMN] = python_dict_to_json(raw_json)
                except (SyntaxError, ValueError) as error:
                    print(f"Line {line_no}: failed to parse {JSON_COLUMN}: {error}")
                    return 1
            rows.append(row)

    with output_path.open("w", encoding="utf-8", newline="") as outfile:
        writer = csv.DictWriter(outfile, fieldnames=reader.fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {len(rows)} rows to {output_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
