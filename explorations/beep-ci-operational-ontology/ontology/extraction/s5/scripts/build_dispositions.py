"""build_dispositions — assemble the total S5 loop log (s5-taxonomy-contract §2).

Machine mirror of the steward's scribed rulings (DECISIONS.md, S5 sittings 1-3,
2026-08-30): a first-match decision table over the JOIN rows, the LEDGER docket
projection, the 149 archived §4b unresolved observations, and fact-classes
derived from subject dispositions. Deterministic; DISPOSITIONS.yaml is the
gate's input. Run: uv run --with pyyaml python build_dispositions.py
"""
from pathlib import Path

import yaml

S5 = Path(__file__).resolve().parents[1]
S4 = S5.parent / "s4"
BC = S4 / "beep-ci-ops"
SITTINGS = "DECISIONS.md §'2026-08-30 — S5 sittings 1–2' + sitting 3 (docket policy)"


def rat_for(slug: str) -> str:
    for f in sorted((BC / "governance/ratifications").glob("rat-*.yaml")):
        d = yaml.safe_load(f.read_text())
        if d["proposal_ref"] == f"otp:{slug}:001":
            return f.stem
    raise SystemExit(f"no ratification for otp:{slug}:001")


POLICY_RAT = "rat-017"  # resolved in main() via rat_for("admission-policy")


def candidate_rule(row: dict, lock_rat: str, rcd_rat: str, vo_rat: str) -> dict:
    c, kind, bucket = row["candidate"], row["kind"], row["bucket"]
    if bucket == "accepted-via":
        return {"ruling": "accepted-via", "join_ref": row["join_ref"],
                "justification": f"exact-name join to ratified term {row['term']} (sitting rule: join pass)"}
    if bucket == "leaf-of-ratified-domain":
        return {"ruling": "accepted-via", "join_ref": row["join_ref"],
                "justification": f"leaf of ratified domain {row['term']} (instance_of; sittings 1-2)"}
    if c == "MachineProofLock":
        return {"ruling": "accepted-via", "join_ref": lock_rat,
                "justification": "ratified named individual under ContendedResource (sitting 2d)"}
    if c == "HostedRequiredCheck":
        return {"ruling": "merged-into", "merged_into": "RequiredCheckDesignation", "join_ref": rcd_rat,
                "justification": "§4b reshape source referent (sitting 2b)"}
    if c == "ArchitectureBoundaryRule":
        return {"ruling": "merged-into", "merged_into": "VerificationObligation", "join_ref": vo_rat,
                "justification": "§4b reshape source referent (sitting 2b)"}
    if c == "YeetWeightedAdmissionV1":
        return {"ruling": "deferred-s6", "join_ref": POLICY_RAT,
                "justification": "individual of accepted AdmissionPolicy; the S6 A-Box ratifies it (sitting 2d)"}
    if c == "TurboConfiguration469136d2a872":
        return {"ruling": "rejected", "join_ref": SITTINGS,
                "justification": "corpus-pinned config snapshot is A-Box evidence, not a term (sitting 2d)"}
    if kind == "individual" and c.startswith("@beep/"):
        return {"ruling": "rejected", "join_ref": SITTINGS,
                "justification": "package census: runtime A-Box data the S6 ETL regenerates (sitting 1b)"}
    if kind == "individual":
        return {"ruling": "parked-run-2", "join_ref": SITTINGS,
                "justification": "lane/work-unit individual of conceded domains (sitting 2a)"}
    if kind == "literal-domain-member":
        return {"ruling": "parked-run-2", "join_ref": SITTINGS,
                "justification": f"member of unratified domain {row.get('source_domain')} (sitting 1a)"}
    if kind == "property":
        return {"ruling": "parked-run-2", "join_ref": "§4b 57.75% unresolved-fraction waiver",
                "justification": "measurement/episode vocabulary parked by the ratified waiver (sitting 1c)"}
    return {"ruling": "parked-run-2", "join_ref": SITTINGS,
            "justification": "episode/occurrence/provenance class conceded at §4b (sitting 2c)"}


# QualityScheduler schema spellings of the accepted AdmissionWorkKind leaves —
# the S4 fact subjects use the schema member names, the candidates the literal
# member names (sitting 3: alias, not ambiguity).
SUBJECT_ALIASES = {
    "FullProofWork": "accepted-via", "MergedPreviewWork": "accepted-via",
    "PublishWork": "accepted-via", "ReviewFixWork": "accepted-via",
}
# Subjects that are not candidates at all: TierCiMergeGreen is AssuranceTier
# vocabulary parked at sitting 1a; its requiresLane mandate re-attaches at run 2.
ORPHAN_SUBJECTS = {"TierCiMergeGreen": "parked-run-2"}

DOCKET_MAP = {
    "run-2-obligation": ("parked-run-2", "the suggestion joins the run-2 queue"),
    "standing-constraint": ("accepted-via", "adopted as a standing S5 constraint"),
    "taxonomy-input": ("accepted-via", "adopted as seat-round taxonomy input"),
    "moot": ("rejected", "subject was rejected as A-Box material"),
}


def main() -> None:
    join = yaml.safe_load((S5 / "JOIN.yaml").read_text())
    docket = yaml.safe_load((S5 / "LEDGER-DOCKET.yaml").read_text())
    facts = yaml.safe_load((S4 / "FACTS.yaml").read_text())
    index = yaml.safe_load(
        (BC / "runs/orun-2026-08-29T08:20:55Z.index.yaml").read_text())
    global POLICY_RAT
    POLICY_RAT = rat_for("admission-policy")
    lock_rat = rat_for("machine-proof-lock")
    rcd_rat = rat_for("hosted-required-check-merge-obligation")
    vo_rat = rat_for("architecture-boundary-obligation")

    cand_rows = []
    disp_by_name: dict = {}
    for row in join["rows"]:
        r = candidate_rule(row, lock_rat, rcd_rat, vo_rat)
        cand_rows.append({"seq": row["seq"], "candidate": row["candidate"], "kind": row["kind"], **r})
        disp_by_name.setdefault(row["candidate"], set()).add(r["ruling"])

    ledger_rows = []
    for e in docket["rows"]:
        ruling, why = DOCKET_MAP[e["ruling"]]
        jr = f"con:{e['id']}" if e["ruling"] in ("standing-constraint", "taxonomy-input") else \
             ("LEDGER-DOCKET.yaml " + e["id"])
        ledger_rows.append({"entry": e["id"], "ruling": ruling, "join_ref": jr,
                            "justification": f"docket {e['ruling']}: {why} — {e['reason']}"})

    obs_rows = [{"observation": r["observation"], "ruling": "parked-run-2",
                 "join_ref": "§4b 57.75% unresolved-fraction waiver",
                 "justification": "archived unresolved observation; run 2 must re-open it"}
                for r in index if r["outcome"] == "unresolved"]

    groups: dict = {}
    ambiguous = sorted(n for n, rs in disp_by_name.items() if len(rs) > 1)
    for i, fc in enumerate(facts):
        subj = fc.get("subject")
        rs = disp_by_name.get(subj)
        if rs is None and subj in SUBJECT_ALIASES:
            disp = SUBJECT_ALIASES[subj]
        elif rs is None and subj in ORPHAN_SUBJECTS:
            disp = ORPHAN_SUBJECTS[subj]
        elif rs is None:
            disp = "orphan"
        elif len(rs) > 1:
            # a bare-name subject naming candidates with different fates cannot
            # be attributed mechanically; fail safe to the parked bucket
            disp = "ambiguous-subject"
        else:
            disp = next(iter(rs))
        groups.setdefault((fc.get("predicate"), disp), []).append(i)
    fact_rows = []
    for (pred, disp), idxs in sorted(groups.items(), key=lambda kv: (str(kv[0][0]), str(kv[0][1]))):
        ruling = {"accepted-via": "accepted-via", "merged-into": "accepted-via",
                  "deferred-s6": "deferred-s6", "rejected": "rejected",
                  "parked-run-2": "parked-run-2", "orphan": "orphan",
                  "unknown-term": "parked-run-2", "ambiguous": "parked-run-2"}[disp]
        fact_rows.append({"predicate": pred, "subject_disposition": disp, "ruling": ruling,
                          "covers": idxs,
                          "justification": "derived from the weakest of subject and term-valued-object dispositions (contract §2; PR #905 review)"})
    orphans = [r for r in fact_rows if r["ruling"] == "orphan"]
    assert not orphans, f"unruled orphan fact classes: {[r['predicate'] for r in orphans]}"
    covered = sum(len(r["covers"]) for r in fact_rows)
    assert covered == len(facts), f"fact coverage {covered} != {len(facts)}"

    out = {
        "generated_by": "scripts/build_dispositions.py",
        "contract": "ontology/docs/s5-taxonomy-contract.md",
        "sittings_ref": SITTINGS,
        "counts": {
            "candidates": len(cand_rows), "ledger": len(ledger_rows),
            "observations": len(obs_rows), "fact_classes": len(fact_rows),
            "facts_covered": covered, "orphan_fact_classes": len(orphans),
        },
        "candidates": cand_rows, "ledger": ledger_rows,
        "observations": obs_rows, "fact_classes": fact_rows,
    }
    (S5 / "DISPOSITIONS.yaml").write_text(
        "# GENERATED by scripts/build_dispositions.py — do not hand-edit.\n"
        "# Steward rulings: DECISIONS.md 2026-08-30 (S5 sittings 1–3).\n"
        + yaml.safe_dump(out, sort_keys=False, allow_unicode=True, width=100))
    from collections import Counter
    print("candidates:", dict(Counter(r["ruling"] for r in cand_rows)))
    print("ledger:", dict(Counter(r["ruling"] for r in ledger_rows)))
    print(f"observations: {len(obs_rows)}; fact classes: {len(fact_rows)} covering {covered}; orphan classes: {len(orphans)}")
    for r in orphans[:10]:
        print("  ORPHAN:", r["predicate"], "n=", len(r["covers"]))
    print("ambiguous subjects:", ambiguous)


if __name__ == "__main__":
    main()
