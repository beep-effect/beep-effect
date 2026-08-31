"""build_predicates — assemble the S6 predicate registry and CQ coverage.

Sources are the ratified S5 taxonomy, the S5 fact-class rulings selected by the
S6 contract, closed-world.yaml, seed.ttl, every committed CQ, and the S6 census
and manifest vocabularies.  The CQ scan is intentionally mechanical: it finds
direct QName predicates after a triple subject or semicolon and normalizes `a`
to rdf:type.  It does not expand variable predicates, property paths, SERVICE
clauses, or generated query text.  The committed CQ suite uses none of those in
predicate position.  Deterministic and idempotent.

Run: uv run --with pyyaml python build_predicates.py
"""

from __future__ import annotations

import re
from collections import defaultdict

from _common import DOCS, S4, S5, S6, TESTS, load_yaml, write_generated_yaml

CI = "ciops:"
RDF_TYPE = "rdf:type"

POLICY_PARAMETERS = {
    "capacityMaxTokens": ("AdmissionPolicy", "xsd:integer"),
    "slotSizeGib": ("AdmissionPolicy", "xsd:decimal"),
    "reserveGib": ("AdmissionPolicy", "xsd:decimal"),
    "hardFloorGib": ("AdmissionPolicy", "xsd:decimal"),
    "heartbeatSeconds": ("AdmissionPolicy", "xsd:integer"),
    "publishAgingSeconds": ("AdmissionPolicy", "xsd:integer"),
    "reviewFixClassCap": ("AdmissionPolicy", "xsd:integer"),
}
FACT_CLASS_PREDICATES = {"admissionTokenWeight", *POLICY_PARAMETERS}
SNAPSHOT_CLOSED = {
    "enqueuedAt",
    "admissionChargeTokens",
    "observedQueueWaitMs",
    "hasOriginKey",
    "hasGrantState",
}
ABOX_PREDICATES = {RDF_TYPE, *(CI + name for name in FACT_CLASS_PREDICATES)}
SNAPSHOT_PREDICATES = {
    RDF_TYPE,
    "ciops:enqueuedAt",
    "ciops:admissionChargeTokens",
    "ciops:observedQueueWaitMs",
    "ciops:hasOriginKey",
}
MANIFEST_PREDICATES = {
    "manifest:hasClosureDeclaration": ("manifest:SnapshotManifest", "manifest:ClosureDeclaration"),
    "manifest:completeForPredicate": ("manifest:ClosureDeclaration", "rdf:Property"),
    "manifest:world": ("manifest:ClosureDeclaration", "xsd:string"),
    "manifest:completeWithin": ("manifest:ClosureDeclaration", "xsd:string"),
    "manifest:source": ("manifest:ClosureDeclaration", "xsd:string"),
    "manifest:freshness": ("manifest:ClosureDeclaration", "xsd:string"),
}

QNAME = r"(?:rdf:type|a|ciops:[A-Za-z_][A-Za-z0-9_-]*)"
VARIABLE_HEAD_RE = re.compile(rf"\?[A-Za-z_][A-Za-z0-9_]*\s+({QNAME})(?=\s)")
FIXED_HEAD_RE = re.compile(
    rf"[{{.}}]\s*ciops:[A-Za-z_][A-Za-z0-9_-]*\s+({QNAME})(?=\s)"
)
TURTLE_HEAD_RE = re.compile(
    rf"^ciops:[A-Za-z_][A-Za-z0-9_-]*\s+({QNAME})(?=\s)",
    re.MULTILINE,
)
CONTINUATION_PREDICATE_RE = re.compile(rf";\s*({QNAME})(?=\s)")


def normalize(found: set[str]) -> list[str]:
    """Normalize Turtle/SPARQL `a` to the registered rdf:type spelling."""

    return sorted(RDF_TYPE if token == "a" else token for token in found)


def scan_cq_predicates(text: str) -> list[str]:
    """Mechanically collect direct predicates from one committed CQ."""

    without_comments = re.sub(r"(?m)#.*$", "", text)
    without_directives = re.sub(r"(?mi)^\s*PREFIX\s+.*$", "", without_comments)
    without_values = re.sub(
        r"(?is)\bVALUES\s+(?:\([^)]*\)|\?[A-Za-z_][A-Za-z0-9_]*)\s*\{[^{}]*\}",
        "",
        without_directives,
    )
    found = set(VARIABLE_HEAD_RE.findall(without_values))
    found.update(FIXED_HEAD_RE.findall(without_values))
    found.update(CONTINUATION_PREDICATE_RE.findall(without_values))
    return normalize(found)


def scan_turtle_predicates(text: str) -> list[str]:
    """Collect predicates from the house-formatted committed seed Turtle."""

    without_comments = re.sub(r"(?m)#.*$", "", text)
    without_directives = re.sub(r"(?mi)^\s*@prefix\s+.*$", "", without_comments)
    found = set(TURTLE_HEAD_RE.findall(without_directives))
    found.update(CONTINUATION_PREDICATE_RE.findall(without_directives))
    return normalize(found)


def taxonomy_domain_range(term: dict) -> tuple[str, str]:
    """Split the ratified taxonomy's human-readable domain/range carrier."""

    params = term.get("parameters") or []
    if len(params) != 1:
        raise SystemExit(f"taxonomy property {term.get('term')}: expected one parameter record")
    carrier = str(params[0].get("range") or "")
    match = re.match(r"domain=(.+?);\s*range=(.+)$", carrier)
    if not match:
        raise SystemExit(f"taxonomy property {term.get('term')}: cannot split range carrier {carrier!r}")
    return match.group(1).strip(), match.group(2).strip()


def main() -> None:
    taxonomy = load_yaml(S5 / "TAXONOMY.yaml")
    dispositions = load_yaml(S5 / "DISPOSITIONS.yaml")
    closed_world = load_yaml(DOCS / "closed-world.yaml")
    if len(closed_world) != 14:
        raise SystemExit(f"expected 14 closed-world declarations, found {len(closed_world)}")

    taxonomy_properties = {
        term["term"]: term for term in taxonomy["terms"] if term.get("kind") == "property"
    }
    if len(taxonomy_properties) != 7:
        raise SystemExit(f"expected 7 ratified taxonomy properties, found {len(taxonomy_properties)}")

    fact_classes = {
        row["predicate"]: row
        for row in dispositions["fact_classes"]
        if row.get("predicate") in FACT_CLASS_PREDICATES
    }
    if set(fact_classes) != FACT_CLASS_PREDICATES:
        missing = sorted(FACT_CLASS_PREDICATES - set(fact_classes))
        raise SystemExit(f"S5 fact-class surface is missing {missing}")
    if fact_classes["admissionTokenWeight"].get("ruling") != "accepted-via":
        raise SystemExit("admissionTokenWeight is not accepted-via in S5 dispositions")
    for name in POLICY_PARAMETERS:
        if fact_classes[name].get("ruling") != "deferred-s6":
            raise SystemExit(f"{name} is not deferred-s6 in S5 dispositions")

    parked_terms: dict[str, list[int]] = defaultdict(list)
    for row in dispositions["candidates"]:
        if row.get("kind") == "property" and row.get("ruling") == "parked-run-2":
            parked_terms[row["candidate"]].append(row["seq"])

    records: dict[str, dict] = {}
    used_by: dict[str, set[str]] = defaultdict(set)

    def ensure(
        predicate: str,
        *,
        status: str | None = None,
        term_ref: str | None = None,
        domain: str = "unknown",
        range_: str = "unknown",
    ) -> dict:
        local = predicate.split(":", 1)[1] if ":" in predicate else predicate
        if status is None:
            if predicate.startswith("ciops-prov:") or predicate.startswith("manifest:"):
                status = "provisional"
            elif local in taxonomy_properties or local in FACT_CLASS_PREDICATES or predicate == RDF_TYPE:
                status = "ratified"
            elif local in parked_terms:
                status = "parked-run-2"
                term_ref = term_ref or f"DISPOSITIONS.yaml#candidate-seq-{min(parked_terms[local])}"
            else:
                status = "seed-only"
        closure = local if local in closed_names else "open"
        current = records.get(predicate)
        candidate = {
            "predicate": predicate,
            "status": status,
            "term_ref": term_ref,
            "domain": domain,
            "range": range_,
            "closure": closure,
        }
        if current is None:
            records[predicate] = candidate
        else:
            for key in ("status", "term_ref", "domain", "range", "closure"):
                incoming = candidate[key]
                if current[key] in (None, "unknown", "open") and incoming not in (None, "unknown", "open"):
                    current[key] = incoming
                elif incoming not in (None, "unknown", "open") and current[key] != incoming:
                    raise SystemExit(
                        f"predicate {predicate}: conflicting {key} {current[key]!r} vs {incoming!r}"
                    )
        return records[predicate]

    closure_rows = {row["predicate"]: row for row in closed_world}
    closed_names = {
        row["predicate"] for row in closed_world if row.get("world") == "closed"
    } | SNAPSHOT_CLOSED

    ensure(
        RDF_TYPE,
        status="ratified",
        term_ref="RDF 1.1 rdf:type",
        domain="rdfs:Resource",
        range_="rdfs:Class",
    )
    used_by[RDF_TYPE].update(
        {"graphs/abox.ttl", "graphs/census.ttl", "graphs/manifest-<instant>.ttl", "graphs/snapshot-<instant>.ttl"}
    )

    for name, term in sorted(taxonomy_properties.items()):
        domain, range_ = taxonomy_domain_range(term)
        predicate = CI + name
        ensure(
            predicate,
            status="ratified",
            term_ref=f"TAXONOMY.yaml#{name}",
            domain=domain,
            range_=range_,
        )
        used_by[predicate].add("TAXONOMY.yaml")

    ensure(
        "ciops:admissionTokenWeight",
        status="ratified",
        term_ref="DISPOSITIONS.yaml#fact-class-admissionTokenWeight",
        domain="AdmissionWorkKind",
        range_="xsd:integer",
    )
    used_by["ciops:admissionTokenWeight"].update({"POLICY.yaml", "graphs/abox.ttl"})
    for name, (domain, range_) in POLICY_PARAMETERS.items():
        predicate = CI + name
        ensure(
            predicate,
            status="ratified",
            term_ref="DECISIONS.md#2026-08-30-S6-sitting-1",
            domain=domain,
            range_=range_,
        )
        used_by[predicate].update({"POLICY.yaml", "graphs/abox.ttl"})

    for name, row in sorted(closure_rows.items()):
        predicate = CI + name
        ensure(predicate)
        used_by[predicate].add("closed-world.yaml")
        if row.get("world") != "closed" and name not in SNAPSHOT_CLOSED:
            records[predicate]["closure"] = "open"

    seed_path = TESTS / "fixtures/seed.ttl"
    for predicate in scan_turtle_predicates(seed_path.read_text()):
        ensure(predicate)
        used_by[predicate].add("tests/fixtures/seed.ttl")

    cq_predicates: dict[str, list[str]] = {}
    for path in sorted(TESTS.glob("cq-*.sparql")):
        cid = "CQ-" + path.stem.split("-")[1]
        cq_predicates[cid] = scan_cq_predicates(path.read_text())
        for predicate in cq_predicates[cid]:
            ensure(predicate)
            used_by[predicate].add(cid)

    ensure(
        "ciops-prov:dependsOnWorkspace",
        status="provisional",
        term_ref="DECISIONS.md#2026-08-30-S6-sitting-1-census-home",
        domain="ciops-prov:WorkspacePackage",
        range_="ciops-prov:WorkspacePackage",
    )
    used_by["ciops-prov:dependsOnWorkspace"].add("graphs/census.ttl")
    for predicate, (domain, range_) in MANIFEST_PREDICATES.items():
        ensure(
            predicate,
            status="provisional",
            term_ref="s6-abox-contract.md#closure-companion-graph",
            domain=domain,
            range_=range_,
        )
        used_by[predicate].add("graphs/manifest-<instant>.ttl")

    for predicate in ABOX_PREDICATES:
        ensure(predicate)
        used_by[predicate].add("graphs/abox.ttl")
    for predicate in SNAPSHOT_PREDICATES:
        ensure(predicate)
        used_by[predicate].add("graphs/snapshot-<instant>.ttl")

    predicate_rows = []
    for predicate in sorted(records):
        row = dict(records[predicate])
        row["used_by"] = sorted(used_by[predicate])
        predicate_rows.append(row)

    status_by_predicate = {row["predicate"]: row["status"] for row in predicate_rows}
    coverage = []
    for cid in sorted(cq_predicates):
        predicates = cq_predicates[cid]
        ratified = [p for p in predicates if status_by_predicate[p] == "ratified"]
        unratified = [
            {"predicate": p, "status": status_by_predicate[p]}
            for p in predicates
            if status_by_predicate[p] != "ratified"
        ]
        coverage.append(
            {
                "cq": cid,
                "predicate_count": len(predicates),
                "ratified_count": len(ratified),
                "full_predicate_set_ratified": len(ratified) == len(predicates),
                "predicates": predicates,
                "unratified": unratified,
            }
        )

    out = {
        "generated_by": "scripts/build_predicates.py",
        "contract": "ontology/docs/s6-abox-contract.md",
        "scan": {
            "mode": "direct-triple-qname-regex",
            "normalizes_a_to": RDF_TYPE,
            "limitations": [
                "does not expand variable predicates or property paths",
                "does not inspect SERVICE clauses or runtime-generated query text",
                "matches direct triple heads and semicolon predicate continuations only",
            ],
        },
        "predicate_count": len(predicate_rows),
        "coverage_count": len(coverage),
        "predicates": predicate_rows,
        "coverage": coverage,
    }
    write_generated_yaml(
        S6 / "PREDICATES.yaml",
        out,
        "build_predicates.py",
        "Sources: ratified S5 taxonomy/fact rulings, closure contract, seed, CQs, and S6 graph vocabularies.",
        "CQ scan limitation: direct QName triple predicates only; see scan.limitations below.",
    )
    full = sum(1 for row in coverage if row["full_predicate_set_ratified"])
    print(f"predicates: {len(predicate_rows)}; CQ coverage: {full}/{len(coverage)} fully ratified")


if __name__ == "__main__":
    main()
