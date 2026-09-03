"""Regenerate the CQ test suite artifacts from competency-questions.yaml (the authority).

Outputs (overwritten in place):
- ontology/tests/cq-*.sparql        one per Must/Should CQ
- ontology/tests/cq-test-manifest.yaml
- ontology/docs/traceability-matrix.csv

Traceability policy (round-1 panel ruling, 2026-08-27): the `ontology_terms` column IS
`required_classes + required_properties` from the YAML, semicolon-joined — never a
hand-curated list (seat B found four rows drifted both directions). `stakeholder_need`
is the source use case's `name`. Rerun this script after ANY edit to
competency-questions.yaml; hand-editing the generated files is a defect.

Usage: python regen_cq_artifacts.py   (run from anywhere; paths resolve from this file)
Requires: pyyaml (uv run --with pyyaml python ...).
"""
import csv
import io
from pathlib import Path

import yaml

PACKET = Path(__file__).resolve().parents[2]
DOCS = PACKET / "ontology/docs"
TESTS = PACKET / "ontology/tests"

cqs = yaml.safe_load((DOCS / "competency-questions.yaml").read_text())
ucs = {u["id"]: u for u in yaml.safe_load((DOCS / "use-cases.yaml").read_text())}

# --- preflight (round-2 seat E: validate the FULL authority before any destructive
# write — a priority typo or duplicate id must abort, never silently drop/overwrite) ---
PRIORITIES = {"must_have", "should_have", "could_have", "wont_have"}
EXPECTED = {"non_empty", "zero_rows", "boolean"}
errors = []
seen_ids, seen_paths = set(), set()
for c in cqs:
    cid = c.get("id", "<missing id>")
    if cid in seen_ids:
        errors.append(f"duplicate CQ id {cid}")
    seen_ids.add(cid)
    if c.get("priority") not in PRIORITIES:
        errors.append(f"{cid}: unknown priority {c.get('priority')!r}")
    if c.get("priority") in ("must_have", "should_have"):
        if c.get("expected_result") not in EXPECTED:
            errors.append(f"{cid}: unknown expected_result {c.get('expected_result')!r}")
        if "\n" in c.get("natural_language", ""):
            errors.append(f"{cid}: natural_language must be single-line (header comment safety)")
        out = f"cq-{cid.split('-')[1]}.sparql"
        if out in seen_paths:
            errors.append(f"{cid}: output path collision on {out}")
        seen_paths.add(out)
if errors:
    raise SystemExit("PREFLIGHT FAILED (no files written):\n  " + "\n  ".join(errors))

testable = [c for c in cqs if c["priority"] in ("must_have", "should_have")]

# --- cq-*.sparql -----------------------------------------------------------------
kept = set()
for c in testable:
    num = c["id"].split("-")[1]
    path = TESTS / f"cq-{num}.sparql"
    kept.add(path.name)
    header = (
        f"# {c['id']}: {c['natural_language']}\n"
        f"# Expected: {c['expected_result']} | priority: {c['priority']} | "
        f"derivation: {c['derivation_method']}\n"
        "# GENERATED from competency-questions.yaml by regen_cq_artifacts.py — do not hand-edit.\n"
    )
    path.write_text(header + c["sparql"].rstrip() + "\n")

for stale in TESTS.glob("cq-*.sparql"):
    if stale.name not in kept:
        stale.unlink()
        print(f"removed stale {stale.name}")

# --- manifest --------------------------------------------------------------------
manifest_lines = [
    "# beep-ci-ops CQ test manifest (GENERATED from competency-questions.yaml by",
    "# regen_cq_artifacts.py — do not hand-edit).",
    # PR #919 added these ratified seed and golden legs; keep the generator authoritative.
    "legs:",
    "  seed:",
    "    graphs: [tests/fixtures/seed.ttl]",
    "    selection: all-manifest-tests",
    "  golden:",
    "    graphs:",
    "      - extraction/s6/graphs/abox.ttl",
    "      - extraction/s6/graphs/snapshot-*.ttl",
    "    excludes:",
    "      - extraction/s6/graphs/census.ttl",
    "      - tests/fixtures/seed.ttl",
    "    coverage: extraction/s6/PREDICATES.yaml#coverage",
    "    selection: full-predicate-set-ratified-and-non-vacuity-antecedent",
    "tests:",
]
for c in testable:
    num = c["id"].split("-")[1]
    manifest_lines += [
        f"  - cq: {c['id']}",
        f"    file: tests/cq-{num}.sparql",
        f"    expected: {c['expected_result']}",
        f"    priority: {c['priority']}",
    ]
(TESTS / "cq-test-manifest.yaml").write_text("\n".join(manifest_lines) + "\n")

# --- traceability matrix ---------------------------------------------------------
buf = io.StringIO()
w = csv.writer(buf, quoting=csv.QUOTE_MINIMAL, lineterminator="\n")
w.writerow(["stakeholder_need", "use_case_id", "cq_id", "ontology_terms", "sparql_test"])
for c in testable:
    num = c["id"].split("-")[1]
    uc = c.get("source_use_case", "")
    need = ucs[uc]["name"] if uc in ucs else ""
    terms = ";".join(c.get("required_classes", []) + c.get("required_properties", []))
    w.writerow([need, uc, c["id"], terms, f"ontology/tests/cq-{num}.sparql"])
(DOCS / "traceability-matrix.csv").write_text(buf.getvalue())

must = sum(1 for c in cqs if c["priority"] == "must_have")
should = sum(1 for c in cqs if c["priority"] == "should_have")
print(f"regenerated {len(testable)} tests ({must} must / {should} should), manifest, traceability matrix")
