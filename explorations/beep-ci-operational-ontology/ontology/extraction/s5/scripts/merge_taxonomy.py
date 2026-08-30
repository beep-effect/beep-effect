"""merge_taxonomy — combine the S5 assembly-seat fragments into TAXONOMY.yaml
(s5-taxonomy-contract §2). Mechanical: concatenates the three term fragments,
attaches constraint_refs from the weaver's bindings, and records the weaver's
waived set. Divergences with the blinded seat are the steward's, not this
script's. Run: uv run --with pyyaml python merge_taxonomy.py
"""
from pathlib import Path

import yaml

S5 = Path(__file__).resolve().parents[1]
BC = S5.parent / "s4" / "beep-ci-ops"
W = S5 / "work-s5"

# Accepted leaf candidates use the literal member spellings; the instances seat
# emitted the QualityScheduler schema spellings (the sitting-3 alias ruling).
LEAF_RENAMES = {"FullProofWork": "full-proof", "MergedPreviewWork": "merged-preview",
                "PublishWork": "publish", "ReviewFixWork": "review-fix"}
# Members the seat enumerated from a ratified domain that were never S4
# candidates: dropped here, docketed for the ratification sitting.
DROP_UNACCEPTED = {"PublishPriority", "VerifyPriority",
                   # sitting 4b: re-ruled parked-run-2 (join category artifact)
                   "HardFloorException"}
# sitting 4a: both contested subsumption edges dropped — blinded and adversary
# independently concur against assembly; re-proposable at run 2/S8 with evidence
DROP_PARENT_EDGES = {"ScheduleProposal", "VerificationEvidence"}

OWL_TO_KIND = {"class": "class", "object_property": "property", "data_property": "property",
               "named_individual": "individual", "individual": "individual"}
# Class placement for ratified individuals whose seats omitted them. The two
# lane individuals were ratified as VerificationLane procedure-specification
# individuals but VerificationLane itself was never ratified (§4b gap) — the
# least-invention placement per their own definitions is WorkUnitSpecification,
# flagged placement_pending_ratification for the sitting.
DERIVED_INSTANCE_OF = {
    "DocgenAffectedWorkUnit": ("WorkUnitSpecification", False),
    "FallowAuditLane": ("WorkUnitSpecification", True),
    "FallowHealthLane": ("WorkUnitSpecification", True),
}


def derive_from_otp(name: str) -> dict:
    """Mechanical fallback record for a required term a seat omitted — derived
    entirely from its ratified proposal; flagged for the ratification sitting."""
    for f in sorted((BC / "work/proposals").glob("otp-*.yaml")):
        if "review" in f.name:
            continue
        d = yaml.safe_load(f.read_text())
        if d["term"]["local_name"] == name:
            rec = {"term": name,
                   "kind": OWL_TO_KIND.get(d["term"].get("owl_entity_kind"), "class"),
                   "parents": [], "rigidity": (d.get("ontoclean") or {}).get("rigidity"),
                   "identity_ref": d.get("identity_card_ref"),
                   "parameters": [], "derived_from_otp": True}
            if name in DERIVED_INSTANCE_OF:
                cls, pending = DERIVED_INSTANCE_OF[name]
                rec["instance_of"] = cls
                if pending:
                    rec["placement_pending_ratification"] = True
            return rec
    raise SystemExit(f"required term {name} has no ratified proposal to derive from")


# Adversary-round fidelity fixes (validity-audited findings; ratification
# sitting ratifies them with the rest):
# - member records carry their OWN ratified identity cards where they exist;
# - domain-worksheet leaves are marked with the §4b amortized identity basis;
# - measurement parameters keep their OTP-defining observation boundaries;
# - publish records the reserved/uninstantiated status con:admission-scheduler-I05 demands;
# - constraints whose discharge needs parked vocabulary are waived to run 2.
IDENTITY_REF_FIXES = {
    "CallerControlled": "ic:turbo-cache:020",
    "LocalOnly": "ic:turbo-cache:021",
    "LocalWriteRemoteRead": "ic:turbo-cache:022",
}
DOMAIN_MEMBERSHIP_LEAVES = {"full-proof", "merged-preview", "publish", "review-fix",
                            "ActiveGrant", "ReleasedGrant"}
PARAMETER_RANGE_FIXES = {
    "capacityAtAdmissionTokens": "domain=AdmissionSnapshot (immediately pre-grant boundary); range=xsd:integer",
    "observedQueueWaitMs": "domain=SeatRequest at an AdmissionSnapshot observation boundary; range=xsd:integer",
}
RUN2_WAIVED_CONSTRAINTS = {
    "con:literalkits-I19": "mode-to-surface members are parked vocabulary; discharge at run 2",
    "con:yeet-internals-I01": "YeetProofTier/AssuranceTierId domains are parked; the mapping discharges at run 2",
    "con:literalkits-I04": "matrix-row denotation is the docketed run-2 leg of this dual ruling",
    "con:admission-scheduler-I04": "publishAgingSeconds/starvationBoundMs live in parked measurement vocabulary; discharge at run 2",
}


def main() -> None:
    terms = []
    dropped = []
    for name in ("assembly-classes", "assembly-properties", "assembly-instances"):
        for t in yaml.safe_load((W / f"{name}.yaml").read_text())["terms"]:
            if t.get("term") in DROP_UNACCEPTED:
                dropped.append(t["term"])
                continue
            if t.get("term") in LEAF_RENAMES:
                t["aliases"] = [t["term"]]
                t["term"] = LEAF_RENAMES[t["term"]]
            terms.append(t)
    # required-set fallback: derive any accepted term every seat omitted
    disp = yaml.safe_load((S5 / "DISPOSITIONS.yaml").read_text())
    required = {r["candidate"] for r in disp["candidates"] if r["ruling"] == "accepted-via"}
    for f in sorted((BC / "work/proposals").glob("otp-*.yaml")):
        if "review" not in f.name:
            required.add(yaml.safe_load(f.read_text())["term"]["local_name"])
    have = {t["term"] for t in terms}
    derived = sorted(required - have)
    for name in derived:
        terms.append(derive_from_otp(name))
    weave = yaml.safe_load((W / "assembly-constraints.yaml").read_text())
    by_term = {}
    for b in weave.get("bindings", []):
        by_term.setdefault(b["term"], []).append(b["constraint"])
    for t in terms:
        refs = sorted(set((t.get("constraint_refs") or []) + by_term.get(t["term"], []))
                      - set(RUN2_WAIVED_CONSTRAINTS))
        t.pop("constraint_refs", None)
        if refs:
            t["constraint_refs"] = refs
        name = t["term"]
        if name in IDENTITY_REF_FIXES:
            t["identity_ref"] = IDENTITY_REF_FIXES[name]
        if name in DOMAIN_MEMBERSHIP_LEAVES:
            t["identity_basis"] = "domain-membership (§4b amortized worksheet convention)"
        if name in PARAMETER_RANGE_FIXES:
            for prm in t.get("parameters") or []:
                if prm.get("property") == name:
                    prm["range"] = PARAMETER_RANGE_FIXES[name]
        if name == "publish":
            t["status_annotations"] = ["reserved", "uninstantiated-by-current-admission-call-sites"]
        if name in DROP_PARENT_EDGES:
            t.pop("parents", None)
        if t.get("kind") in ("individual", "literal-domain-member"):
            # sitting 4b: rigidity is a class-level OntoClean notion
            t.pop("rigidity", None)
    out = {
        "generated_by": "scripts/merge_taxonomy.py",
        "contract": "ontology/docs/s5-taxonomy-contract.md",
        "term_count": len(terms),
        "dropped_unaccepted": sorted(dropped),
        "derived_from_otp": derived,
        "waived_constraints": sorted(set(
            [x.get("constraint") for x in weave.get("waived_constraints_proposed") or []]
            + list(RUN2_WAIVED_CONSTRAINTS))),
        "waiver_reasons": RUN2_WAIVED_CONSTRAINTS,
        "terms": terms,
    }
    (S5 / "TAXONOMY.yaml").write_text(
        "# GENERATED by scripts/merge_taxonomy.py from the seat fragments in work-s5/.\n"
        "# Steward ratification pending; divergences with the blinded seat are docketed.\n"
        + yaml.safe_dump(out, sort_keys=False, allow_unicode=True, width=100))
    print(f"taxonomy: {len(terms)} terms; dropped: {sorted(dropped)}; derived: {derived}; weaver waived: {out['waived_constraints']}")


if __name__ == "__main__":
    main()
