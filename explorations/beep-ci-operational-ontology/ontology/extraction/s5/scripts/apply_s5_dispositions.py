"""apply_s5_dispositions — the ONLY writer of the generated S4 statuses
(s5-taxonomy-contract §2; s4-lane-contract §5: statuses transition only through
S5 ratification). Projects DISPOSITIONS.yaml onto CANDIDATES/FACTS/LEDGER:
candidate/open rows take their ratified ruling as status; merged candidates
additionally record merged_into. Idempotent; exits 1 if any candidate/open
status would survive. Run: uv run --with pyyaml python apply_s5_dispositions.py
"""
from pathlib import Path

import yaml

S5 = Path(__file__).resolve().parents[1]
S4 = S5.parent / "s4"
STATUS = {"accepted-via": "accepted", "merged-into": "merged", "rejected": "rejected",
          "parked-run-2": "parked-run-2", "deferred-s6": "deferred-s6"}
NOTE = ("# STATUSES PROJECTED by ../s5/scripts/apply_s5_dispositions.py from the ratified\n"
        "# S5 dispositions (DECISIONS.md sittings 1-4). Do not hand-edit.\n")


def rewrite(path: Path, records, header_grep: str) -> None:
    text = path.read_text()
    head_lines = []
    for line in text.splitlines(keepends=True):
        if line.startswith("#"):
            head_lines.append(line)
        else:
            break
    head = "".join(head_lines)
    if "apply_s5_dispositions" not in head:
        head += NOTE
    path.write_text(head + yaml.safe_dump(records, sort_keys=False, allow_unicode=True, width=110))


def main() -> None:
    disp = yaml.safe_load((S5 / "DISPOSITIONS.yaml").read_text())
    cands = yaml.safe_load((S4 / "CANDIDATES.yaml").read_text())
    facts = yaml.safe_load((S4 / "FACTS.yaml").read_text())
    ledger = yaml.safe_load((S4 / "LEDGER.yaml").read_text())

    crows = disp["candidates"]
    assert len(crows) == len(cands)
    for row in crows:
        c = cands[row["seq"]]
        assert c["candidate"] == row["candidate"], (row["seq"], c["candidate"])
        c["status"] = STATUS[row["ruling"]]
        if row["ruling"] == "merged-into":
            c["merged_into"] = row["merged_into"]

    fact_status = {}
    for fc in disp["fact_classes"]:
        for i in fc["covers"]:
            fact_status[i] = STATUS[fc["ruling"]]
    assert len(fact_status) == len(facts)
    for i, fc in enumerate(facts):
        fc["status"] = fact_status[i]

    lrows = {r["entry"]: r for r in disp["ledger"]}
    for e in ledger:
        e["status"] = STATUS[lrows[e["id"]]["ruling"]]

    for coll, name in ((cands, "CANDIDATES"), (facts, "FACTS"), (ledger, "LEDGER")):
        residue = [x for x in coll if x.get("status") in ("candidate", "open")]
        if residue:
            raise SystemExit(f"{name}: {len(residue)} rows still candidate/open")
    rewrite(S4 / "CANDIDATES.yaml", cands, "CANDIDATES")
    rewrite(S4 / "FACTS.yaml", facts, "FACTS")
    rewrite(S4 / "LEDGER.yaml", ledger, "LEDGER")
    from collections import Counter
    print("candidates:", dict(Counter(c["status"] for c in cands)))
    print("facts:", dict(Counter(f["status"] for f in facts)))
    print("ledger:", dict(Counter(e["status"] for e in ledger)))
    print("S5 completion predicate satisfied: nothing candidate/open remains")


if __name__ == "__main__":
    main()
