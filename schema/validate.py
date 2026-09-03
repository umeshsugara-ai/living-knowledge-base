#!/usr/bin/env python3
"""
schema/validate.py — loads every <collection>.schema.json in schema/, validates its
fixtures/<collection>/valid.json (must pass) and fixtures/<collection>/invalid.json
(must fail), and exits 0 only if every collection behaves as expected. (T-018: fixtures
moved from a flat fixtures/<collection>.valid.json layout to one subdir per collection so
schema/fixtures/ stays under the dirsize budget as collections grow — structure.config.json
dirsize.maxFiles, scripts/lint-dirsize.mjs.)

Usage: python schema/validate.py
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).parent
FIXTURES = ROOT / "fixtures"


def load(path: Path) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def main() -> int:
    schema_files = sorted(ROOT.glob("*.schema.json"))
    if not schema_files:
        print("FAIL: no schema files found under schema/")
        return 1

    ok = True
    for schema_path in schema_files:
        collection = schema_path.stem.replace(".schema", "")
        schema = load(schema_path)
        Draft202012Validator.check_schema(schema)
        validator = Draft202012Validator(schema)

        valid_fixture = FIXTURES / collection / "valid.json"
        invalid_fixture = FIXTURES / collection / "invalid.json"

        if not valid_fixture.exists() or not invalid_fixture.exists():
            print(f"FAIL: {collection} — missing fixture(s)")
            ok = False
            continue

        valid_doc = load(valid_fixture)
        invalid_doc = load(invalid_fixture)

        valid_errors = list(validator.iter_errors(valid_doc))
        invalid_errors = list(validator.iter_errors(invalid_doc))

        if valid_errors:
            print(f"FAIL: {collection}.valid.json unexpectedly failed validation:")
            for e in valid_errors:
                print(f"  - {e.message} at {list(e.path)}")
            ok = False
        elif not invalid_errors:
            print(f"FAIL: {collection}.invalid.json unexpectedly PASSED validation "
                  f"(schema is too permissive)")
            ok = False
        else:
            print(f"OK: {collection} — valid fixture passes, "
                  f"invalid fixture correctly rejected ({len(invalid_errors)} error(s))")

    print()
    if ok:
        print(f"PASS: {len(schema_files)} collection schema(s) validated correctly.")
        return 0
    else:
        print("FAIL: one or more collections did not behave as expected.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
