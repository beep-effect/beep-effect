"""apply_s6_dispositions — project the S6 sitting onto S4/S5 statuses.

Default --check mode proves the exact transition set without writing: candidate
seq-247 YeetWeightedAdmissionV1 and the seven deferred policy fact classes.
--apply DISCHARGES the deferral: the historical S5 rulings stay deferred-s6
(the scribe of what S5 decided), each row gains an s6_ratification_ref, and the
projected S4 statuses flip to accepted.  Refuses to run until ABOX.yaml carries
a non-null policy sitting reference.  Idempotent after projection.

Run check: uv run --with pyyaml python apply_s6_dispositions.py
Run apply: uv run --with pyyaml python apply_s6_dispositions.py --apply
"""

from __future__ import annotations

import argparse
from pathlib import Path

import yaml

from _common import S4, S5, S6, load_yaml

TARGET_FACTS = {
    "capacityMaxTokens",
    "slotSizeGib",
    "reserveGib",
    "hardFloorGib",
    "heartbeatSeconds",
    "publishAgingSeconds",
    "reviewFixClassCap",
}
NOTE = (
    "# S6 STATUSES PROJECTED by ../s6/scripts/apply_s6_dispositions.py after the\n"
    "# steward sitting recorded in ABOX.yaml. Do not hand-edit these transitions.\n"
)


def rewrite(path: Path, data) -> None:
    """Preserve generated headers and add the S6 projection receipt once."""

    original = path.read_text()
    header = "".join(
        line
        for line in original.splitlines(keepends=True)
        if line.startswith("#")
    )
    if "apply_s6_dispositions" not in header:
        header += NOTE
    path.write_text(
        header
        + yaml.safe_dump(data, sort_keys=False, allow_unicode=True, width=100)
    )


def main() -> None:
    parser = argparse.ArgumentParser(description="check or apply the S6 disposition projection")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--check", action="store_true", help="report the transition set without writing (default)")
    mode.add_argument("--apply", action="store_true", help="apply after every required sitting ref is non-null")
    args = parser.parse_args()

    dispositions = load_yaml(S5 / "DISPOSITIONS.yaml")
    candidates = load_yaml(S4 / "CANDIDATES.yaml")
    facts = load_yaml(S4 / "FACTS.yaml")
    abox = load_yaml(S6 / "ABOX.yaml")

    candidate_rows = [
        row
        for row in dispositions["candidates"]
        if row.get("seq") == 247 and row.get("candidate") == "YeetWeightedAdmissionV1"
    ]
    if len(candidate_rows) != 1:
        raise SystemExit(f"expected candidate seq-247 exactly once, found {len(candidate_rows)}")
    candidate = candidate_rows[0]
    if candidate.get("ruling") != "deferred-s6":
        raise SystemExit(f"candidate seq-247 has illegal S6 state {candidate.get('ruling')!r}")
    if candidates[247].get("candidate") != "YeetWeightedAdmissionV1":
        raise SystemExit("S4 candidate index 247 no longer names YeetWeightedAdmissionV1")
    if candidates[247].get("status") not in {"deferred-s6", "accepted"}:
        raise SystemExit(f"S4 candidate seq-247 has illegal status {candidates[247].get('status')!r}")

    fact_classes = {
        row["predicate"]: row
        for row in dispositions["fact_classes"]
        if row.get("predicate") in TARGET_FACTS
    }
    if set(fact_classes) != TARGET_FACTS:
        raise SystemExit(f"S6 fact transition set mismatch: {sorted(fact_classes)}")
    indexes = []
    for name in sorted(TARGET_FACTS):
        row = fact_classes[name]
        if row.get("ruling") != "deferred-s6":
            raise SystemExit(f"{name} has illegal S6 ruling {row.get('ruling')!r}")
        covers = row.get("covers") or []
        if len(covers) != 1:
            raise SystemExit(f"{name} must cover one S4 fact, found {covers}")
        index = covers[0]
        indexes.append(index)
        if facts[index].get("predicate") != name:
            raise SystemExit(f"{name} cover index {index} points at {facts[index].get('predicate')}")
        if facts[index].get("status") not in {"deferred-s6", "accepted"}:
            raise SystemExit(f"S4 fact {index} has illegal status {facts[index].get('status')!r}")
    if len(set(indexes)) != 7:
        raise SystemExit(f"S6 fact covers are not unique: {indexes}")

    ref = (abox.get("policy") or {}).get("ratification", {}).get("ref")
    pending_candidate = "s6_ratification_ref" not in candidate
    pending_facts = sorted(
        name for name, row in fact_classes.items() if "s6_ratification_ref" not in row
    )
    print(
        "candidate seq-247: "
        + ("deferred-s6 -> discharged (ruling stays historical)" if pending_candidate else "already discharged")
    )
    print(
        f"fact classes: {len(pending_facts)} deferred-s6 -> discharged; "
        f"S4 fact indexes: {sorted(indexes)}"
    )
    print(f"policy sitting ref: {ref if ref is not None else 'PENDING'}")

    if not args.apply:
        print("CHECK: no files changed")
        return
    if ref is None:
        raise SystemExit("--apply refused: ABOX.yaml policy ratification.ref is still null")

    # The S5 rulings are the historical scribe of what S5 decided — deferred-s6
    # stays. S6's discharge is its own record: the ref beside the ruling, and the
    # accepted status on the projected S4 surfaces.
    candidate["s6_ratification_ref"] = ref
    candidates[247]["status"] = "accepted"
    candidates[247]["s6_ratification_ref"] = ref
    for name, row in fact_classes.items():
        row["s6_ratification_ref"] = ref
        for index in row["covers"]:
            facts[index]["status"] = "accepted"
            facts[index]["s6_ratification_ref"] = ref
    rewrite(S5 / "DISPOSITIONS.yaml", dispositions)
    rewrite(S4 / "CANDIDATES.yaml", candidates)
    rewrite(S4 / "FACTS.yaml", facts)
    print("APPLIED: 1 candidate and 7 fact classes discharged to accepted status")


if __name__ == "__main__":
    main()
