"""build_abox — assemble the S6 ratification surface and ratified A-Box.

POLICY.yaml supplies source-pinned facts and deployed enumerations.  CENSUS.yaml
and the snapshot manifest enter ABOX.yaml only as generator/output-digest
summaries.  graphs/abox.ttl contains the policy and enumeration individuals and
uses only predicates marked ratified in PREDICATES.yaml.  Deterministic and
idempotent.

Run: uv run --with pyyaml,rdflib python build_abox.py
"""

from __future__ import annotations

from rdflib import Graph

from _common import S6, corpus_commit, load_yaml, sha256_12, write_generated_yaml

CI_IRI = "https://oip.law/ontology/ci-ops#"
WORK_KIND_IRI = {
    "full-proof": "ciops:full-proof",
    "merged-preview": "ciops:merged-preview",
    "review-fix": "ciops:review-fix",
    "publish": "ciops:publish",
}
PRIORITY_IRI = {
    "publish": "ciops:AdmissionPriority-publish",
    "verify": "ciops:AdmissionPriority-verify",
}
# The sole sanctioned ref value: the scribed steward sitting that ratified every
# individual and both generator-digest bulks on this surface.
SITTING_2 = "DECISIONS.md §'2026-08-30 — S6 sitting 2'"


def fact_record(fact: dict) -> dict:
    """Project a POLICY fact onto the ABOX fact contract."""

    return {
        "subject": fact["subject"],
        "predicate": fact["predicate"],
        "value": fact["value"],
        "value_type": fact["value_type"],
        "source": fact["source"],
        "s4_fact": fact.get("s4_fact"),
        "drift": bool(fact.get("drift")),
    }


def type_fact(subject: str, target: str, source: dict) -> dict:
    """Build an explicit rdf:type fact for the human ratification surface."""

    return {
        "subject": subject,
        "predicate": "rdf:type",
        "value": target,
        "value_type": "iri",
        "source": source,
        "s4_fact": None,
        "drift": False,
    }


def literal(value: object, value_type: str) -> str:
    """Render one typed numeric Turtle literal."""

    if value_type not in {"xsd:integer", "xsd:decimal"}:
        raise SystemExit(f"unsupported A-Box literal datatype {value_type}")
    return f'"{value}"^^{value_type}'


def main() -> None:
    policy = load_yaml(S6 / "POLICY.yaml")
    census_path = S6 / "CENSUS.yaml"
    census = load_yaml(census_path)
    manifest_path = S6 / "snapshot/raw/MANIFEST.yaml"
    manifest = load_yaml(manifest_path)
    predicates = load_yaml(S6 / "PREDICATES.yaml")
    status = {row["predicate"]: row["status"] for row in predicates["predicates"]}

    facts = policy["facts"]
    parameter_facts = [fact_record(row) for row in facts if row["subject"] == "YeetWeightedAdmissionV1"]
    weight_facts = {row["subject"]: fact_record(row) for row in facts if row["predicate"] == "admissionTokenWeight"}
    if len(parameter_facts) != 7 or len(weight_facts) != 4:
        raise SystemExit(
            f"POLICY.yaml must supply 7 policy facts and 4 unique weight facts, got "
            f"{len(parameter_facts)} and {len(weight_facts)}"
        )

    enumerations = {row["domain"]: row for row in policy["enumerations"]}
    work_members = enumerations["AdmissionWorkKind"]["members"]
    priority_members = enumerations["AdmissionPriority"]["members"]
    if {row["value"] for row in work_members} != set(WORK_KIND_IRI):
        raise SystemExit("AdmissionWorkKind members drifted from the four IRI-law members")
    if {row["value"] for row in priority_members} != set(PRIORITY_IRI):
        raise SystemExit("AdmissionPriority members drifted from publish/verify")

    dispositions_path = S6.parent / "s5/DISPOSITIONS.yaml"
    disposition_lines = [
        index
        for index, line in enumerate(dispositions_path.read_text().splitlines(), start=1)
        if line.strip() == "candidate: YeetWeightedAdmissionV1"
    ]
    if len(disposition_lines) != 1:
        raise SystemExit(
            f"expected one YeetWeightedAdmissionV1 disposition source line, found {disposition_lines}"
        )
    policy_source = {
        "file": "explorations/beep-ci-operational-ontology/ontology/extraction/s5/DISPOSITIONS.yaml",
        "line": disposition_lines[0],
    }
    policy_type = type_fact("YeetWeightedAdmissionV1", "AdmissionPolicy", policy_source)
    policy_individual = {
        "individual": "ciops:YeetWeightedAdmissionV1",
        "instance_of": "ciops:AdmissionPolicy",
        "source": policy_source,
        "ratification": {"mode": "sitting", "ref": SITTING_2},
        "facts": [policy_type, *parameter_facts],
    }

    work_individuals = []
    for member in work_members:
        name = member["value"]
        type_row = type_fact(name, "AdmissionWorkKind", member["source"])
        weight = weight_facts[name]
        work_individuals.append(
            {
                "individual": WORK_KIND_IRI[name],
                "instance_of": "ciops:AdmissionWorkKind",
                "source": member["source"],
                "ratification": {"mode": "sitting", "ref": SITTING_2},
                "facts": [type_row, weight],
            }
        )

    priority_individuals = []
    for member in priority_members:
        name = member["value"]
        type_row = type_fact(
            PRIORITY_IRI[name].removeprefix("ciops:"),
            "AdmissionPriorityClass",
            member["source"],
        )
        priority_individuals.append(
            {
                "individual": PRIORITY_IRI[name],
                "instance_of": "ciops:AdmissionPriorityClass",
                "source": member["source"],
                "ratification": {"mode": "sitting", "ref": SITTING_2},
                "facts": [type_row],
            }
        )

    census_bytes = census_path.read_bytes()
    manifest_bytes = manifest_path.read_bytes()
    out = {
        "generated_by": "scripts/build_abox.py",
        "contract": "ontology/docs/s6-abox-contract.md",
        "corpus_commit": corpus_commit(),
        "policy": policy_individual,
        "enumerations": [
            {"domain": "AdmissionWorkKind", "members": work_individuals},
            {"domain": "AdmissionPriorityClass", "members": priority_individuals},
        ],
        "census": {
            "artifact": "CENSUS.yaml",
            "count": census["count"],
            "edge_count": census["edge_count"],
            "sha256_12": sha256_12(census_bytes),
            "ratification": {"mode": "generator-digest", "ref": SITTING_2},
        },
        "snapshot": {
            "artifact": "snapshot/raw/MANIFEST.yaml",
            "instant": manifest["snapshot_instant"],
            "redacted_sha256_12": manifest["source"]["redacted_sha256_12"],
            "manifest_sha256_12": sha256_12(manifest_bytes),
            "graph": manifest["graph"],
            "manifest_graph": manifest["manifest_graph"],
            "counts": manifest["counts"],
            "ratification": {"mode": "generator-digest", "ref": SITTING_2},
        },
    }
    write_generated_yaml(
        S6 / "ABOX.yaml",
        out,
        "build_abox.py",
        "RATIFIED by the steward 2026-08-30 (DECISIONS.md, S6 sitting 2) — every ref cites the sitting.",
        "Census and snapshot enter this surface by generator/output digest, not by copied triples.",
    )

    graph_predicates = {
        "rdf:type",
        "ciops:admissionTokenWeight",
        *("ciops:" + fact["predicate"] for fact in parameter_facts),
    }
    unratified = sorted(predicate for predicate in graph_predicates if status.get(predicate) != "ratified")
    if unratified:
        raise SystemExit(f"graphs/abox.ttl would use non-ratified predicates: {unratified}")

    lines = [
        "# GENERATED by scripts/build_abox.py — do not hand-edit.",
        "# Ratified S6 policy and deployed enumeration A-Box.",
        f"@prefix ciops: <{CI_IRI}> .",
        "@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .",
        "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .",
        "",
        "ciops:YeetWeightedAdmissionV1 rdf:type ciops:AdmissionPolicy ;",
    ]
    for index, fact in enumerate(parameter_facts):
        tail = " ." if index == len(parameter_facts) - 1 else " ;"
        lines.append(
            f"    ciops:{fact['predicate']} {literal(fact['value'], fact['value_type'])}{tail}"
        )
    lines.append("")
    for member in work_members:
        name = member["value"]
        fact = weight_facts[name]
        lines.extend(
            [
                f"{WORK_KIND_IRI[name]} rdf:type ciops:AdmissionWorkKind ;",
                f"    ciops:admissionTokenWeight {literal(fact['value'], fact['value_type'])} .",
                "",
            ]
        )
    for member in priority_members:
        lines.append(
            f"{PRIORITY_IRI[member['value']]} rdf:type ciops:AdmissionPriorityClass ."
        )
    abox_path = S6 / "graphs/abox.ttl"
    abox_path.write_text("\n".join(lines).rstrip() + "\n")
    Graph().parse(abox_path, format="turtle")
    print(
        f"abox: 1 policy / {len(work_members)} work kinds / {len(priority_members)} priorities; "
        f"census digest={out['census']['sha256_12']}; snapshot digest={out['snapshot']['manifest_sha256_12']}"
    )


if __name__ == "__main__":
    main()
