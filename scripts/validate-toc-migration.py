#!/usr/bin/env python3
"""
scripts/validate-toc-migration.py — T-002 C2/C3/C4. Extends schema/validate.py's
Draft202012Validator pattern (same library, same validator construction) to the real
generated migration output under data/toc-migrated/<sessionId>/, instead of the
fixtures/ directory schema/validate.py checks. Does not fork or reimplement a validator.

For every session directory it validates:
  - source.json      against schema/sources.schema.json      (+ captureMode == "provided", D-008)
  - session.json      against schema/sessions.schema.json
  - each turns.json entry  against schema/turns.schema.json    (+ speakerRef == "unknown", C3)
  - session_page.json against schema/session_pages.schema.json (+ every evidence[].turnId is a
    real id present in that session's turns.json — C4's join check, not just schema shape)
  - each claims.json entry against schema/claims.schema.json   (+ same evidence[].turnId join)

Usage: python scripts/validate-toc-migration.py
"""
import json
import sys
from pathlib import Path

from jsonschema import Draft202012Validator

ROOT = Path(__file__).parent.parent
SCHEMA_DIR = ROOT / "schema"
DATA_DIR = ROOT / "data" / "toc-migrated"


def load(path: Path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_validator(name: str) -> Draft202012Validator:
    schema = load(SCHEMA_DIR / f"{name}.schema.json")
    Draft202012Validator.check_schema(schema)
    return Draft202012Validator(schema)


def report_errors(errors, label: str, ok_flag: list) -> None:
    if errors:
        ok_flag[0] = False
        print(f"FAIL: {label}")
        for e in errors:
            print(f"  - {e.message} at {list(e.path)}")


def main() -> int:
    validators = {
        name: load_validator(name)
        for name in ("sources", "sessions", "turns", "session_pages", "claims")
    }

    if not DATA_DIR.exists():
        print(f"FAIL: {DATA_DIR} does not exist")
        return 1

    session_dirs = sorted(p for p in DATA_DIR.iterdir() if p.is_dir())
    if not session_dirs:
        print(f"FAIL: no session directories found under {DATA_DIR}")
        return 1

    ok = [True]
    session_count = 0
    turn_count = 0
    claim_count = 0

    for sdir in session_dirs:
        session_id = sdir.name
        session_count += 1
        required = ["source.json", "session.json", "turns.json", "session_page.json", "claims.json"]
        missing = [f for f in required if not (sdir / f).exists()]
        if missing:
            ok[0] = False
            print(f"FAIL: {session_id} — missing file(s): {missing}")
            continue

        source = load(sdir / "source.json")
        report_errors(list(validators["sources"].iter_errors(source)), f"{session_id}/source.json", ok)
        if source.get("captureMode") != "provided":
            ok[0] = False
            print(f"FAIL: {session_id}/source.json — captureMode must be 'provided' (D-008), got {source.get('captureMode')!r}")

        session = load(sdir / "session.json")
        report_errors(list(validators["sessions"].iter_errors(session)), f"{session_id}/session.json", ok)
        if session.get("_id") != session_id:
            ok[0] = False
            print(f"FAIL: {session_id}/session.json — _id {session.get('_id')!r} does not match directory name")

        turns = load(sdir / "turns.json")
        turn_ids = set()
        for i, turn in enumerate(turns):
            turn_count += 1
            report_errors(list(validators["turns"].iter_errors(turn)), f"{session_id}/turns.json[{i}]", ok)
            if turn.get("speakerRef") != "unknown":
                ok[0] = False
                print(f"FAIL: {session_id}/turns.json[{i}] — speakerRef must be 'unknown' (no diarization, C3), got {turn.get('speakerRef')!r}")
            turn_ids.add(turn.get("_id"))

        def check_evidence(doc, label):
            for j, e in enumerate(doc.get("evidence", [])):
                if e.get("sessionId") != session_id:
                    ok[0] = False
                    print(f"FAIL: {label} evidence[{j}] — sessionId {e.get('sessionId')!r} != {session_id!r}")
                if e.get("turnId") not in turn_ids:
                    ok[0] = False
                    print(f"FAIL: {label} evidence[{j}] — turnId {e.get('turnId')!r} not found in {session_id}/turns.json (C4 join)")

        page = load(sdir / "session_page.json")
        report_errors(list(validators["session_pages"].iter_errors(page)), f"{session_id}/session_page.json", ok)
        check_evidence(page, f"{session_id}/session_page.json")

        claims = load(sdir / "claims.json")
        for i, claim in enumerate(claims):
            claim_count += 1
            report_errors(list(validators["claims"].iter_errors(claim)), f"{session_id}/claims.json[{i}]", ok)
            check_evidence(claim, f"{session_id}/claims.json[{i}]")

    print()
    print(f"Checked {session_count} session(s), {turn_count} turn(s), {claim_count} claim(s).")
    if ok[0]:
        print("PASS: all toc-migrated documents validate and every evidence[].turnId joins to a real turn.")
        return 0
    print("FAIL: one or more documents failed validation or evidence join — see above.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
