"""Mechanical validator for the beep-ci-operational-ontology packet (the committed
carrier of the pre-S4 "round 0" checks — round-2 seats F+G: a validator cited by the
lane contract must exist in the tree, not in a session scratchpad).

Zero-judgment referential/syntax gates over the S4 frozen-input surface. Exit 1 on any
BLOCKER; prints BLOCKER/WARN/OK lines. KNOWN LIMITS (round-2 seat G): this checker
proves parse + referential integrity, NOT query semantics — SPARQL-vs-NL fidelity,
vacuity, and adversarial graphs are run_cq_suite.py's job; it also derives
traceability expectations from the same YAML it validates, so it cannot see
requireds-vs-query drift (e.g. an untyped ?subject wider than required_classes).

Run: uv run --with pyyaml,rdflib python validate_packet.py
"""
import csv
import io
import re
import sys
from pathlib import Path

import yaml
from rdflib.plugins.sparql import prepareQuery

PACKET = Path(__file__).resolve().parents[2]
DOCS = PACKET / "ontology/docs"
TESTS = PACKET / "ontology/tests"
NS = "https://oip.law/ontology/ci-ops#"

blockers, warns = [], []


def blocker(msg):
    blockers.append(msg)
    print(f"BLOCKER: {msg}")


def warn(msg):
    warns.append(msg)
    print(f"WARN: {msg}")


# --- 1. parse the YAML surfaces -------------------------------------------------
cqs = yaml.safe_load((DOCS / "competency-questions.yaml").read_text())
ucs = yaml.safe_load((DOCS / "use-cases.yaml").read_text())
manifest = yaml.safe_load((TESTS / "cq-test-manifest.yaml").read_text())
print(f"OK: parsed {len(cqs)} CQs, {len(ucs)} use cases, {len(manifest['tests'])} manifest entries")

cq_by_id = {c["id"]: c for c in cqs}
uc_ids = {u["id"] for u in ucs}
if len(cq_by_id) != len(cqs):
    blocker("duplicate CQ ids")

# --- 2. per-CQ structural checks ------------------------------------------------
testable = {}
for c in cqs:
    cid, prio = c["id"], c["priority"]
    if prio in ("must_have", "should_have"):
        testable[cid] = c
        for field in ("sparql", "expected_result", "sample_answer", "derivation_method", "type"):
            if field not in c:
                blocker(f"{cid} ({prio}) missing field {field}")
        tf = TESTS / f"cq-{cid.split('-')[1]}.sparql"
        if not tf.exists():
            blocker(f"{cid} ({prio}) has no test file {tf.name}")
    elif prio in ("could_have",):
        if (TESTS / f"cq-{cid.split('-')[1]}.sparql").exists():
            warn(f"{cid} (could_have) has a test file; suite policy is Must/Should only")
    elif prio == "wont_have":
        if (TESTS / f"cq-{cid.split('-')[1]}.sparql").exists():
            blocker(f"{cid} (wont_have) has a test file")
        if "rationale" not in c and "reason" not in c and "out_of_scope" not in c:
            warn(f"{cid} (wont_have) records no rationale/out_of_scope")
    src = c.get("source_use_case")
    if src and src not in uc_ids:
        blocker(f"{cid} source_use_case {src} not in use-cases.yaml")

# --- 3. manifest <-> files bijection --------------------------------------------
man_by_cq = {}
for e in manifest["tests"]:
    man_by_cq[e["cq"]] = e
    f = PACKET / "ontology" / e["file"]
    if not f.exists():
        blocker(f"manifest points at missing file {e['file']}")
    c = cq_by_id.get(e["cq"])
    if c is None:
        blocker(f"manifest entry {e['cq']} has no CQ")
        continue
    if e.get("expected") != c.get("expected_result"):
        blocker(f"{e['cq']} manifest expected={e.get('expected')} != YAML expected_result={c.get('expected_result')}")
    if e.get("priority") != c.get("priority"):
        blocker(f"{e['cq']} manifest priority={e.get('priority')} != YAML priority={c.get('priority')}")
for cid in testable:
    if cid not in man_by_cq:
        blocker(f"{cid} (testable) missing from manifest")
sparql_files = sorted(TESTS.glob("cq-*.sparql"))
man_files = {e["file"].split("/")[-1] for e in manifest["tests"]}
for f in sparql_files:
    if f.name not in man_files:
        blocker(f"orphan test file {f.name} not in manifest")

# --- 4. SPARQL syntax + namespace + YAML<->file drift ---------------------------
prefix_re = re.compile(r"PREFIX\s+ciops:\s*<([^>]+)>")


def strip_query(text):
    lines = [ln for ln in text.splitlines() if not ln.strip().startswith("#")]
    return re.sub(r"\s+", " ", "\n".join(lines)).strip()


for f in sparql_files:
    text = f.read_text()
    try:
        prepareQuery(text)
    except Exception as exc:  # noqa: BLE001
        blocker(f"{f.name} fails to parse: {exc}")
        continue
    m = prefix_re.search(text)
    if not m:
        blocker(f"{f.name} has no ciops PREFIX")
    elif m.group(1) != NS:
        blocker(f"{f.name} ciops namespace is {m.group(1)}, expected {NS}")
    cid = "CQ-" + f.stem.split("-")[1]
    c = cq_by_id.get(cid)
    if c and "sparql" in c:
        try:
            prepareQuery(c["sparql"])
        except Exception as exc:  # noqa: BLE001
            blocker(f"{cid} inline YAML sparql fails to parse: {exc}")
        if strip_query(c["sparql"]) != strip_query(text):
            warn(f"{f.name} drifts from {cid}'s inline YAML sparql")
print(f"OK: {len(sparql_files)} SPARQL files parsed")

# --- 5. pre-glossary coverage both directions -----------------------------------
gloss_rows = list(csv.DictReader(io.StringIO((DOCS / "pre-glossary.csv").read_text())))
gloss = {}
for r in gloss_rows:
    if r["term"] in gloss:
        blocker(f"glossary duplicate term {r['term']}")
    gloss[r["term"]] = r
    src = r["source_cq"]
    if src and src not in cq_by_id and src not in uc_ids:
        blocker(f"glossary term {r['term']} sources unknown {src}")

classes = {t for t, r in gloss.items() if r["category"] == "class"}
props = {t for t, r in gloss.items() if r["category"] == "property"}
required = set()
for c in cqs:
    for t in c.get("required_classes", []):
        required.add(t)
        if t not in classes:
            blocker(f"{c['id']} requires class {t} not in glossary")
    for t in c.get("required_properties", []):
        required.add(t)
        if t not in props:
            blocker(f"{c['id']} requires property {t} not in glossary")

# admission law (TWO-KIND, final-grill round 2): a term is licensed as a DECISION TERM
# (required by / used in a testable CQ) or as a SEMANTIC-SUPPORT TERM whose glossary
# notes name the decision term(s) it serves via `supports=A|B` — licensed by
# reachability from CQ roots, iterated to fixpoint so support chains resolve.
sparql_blob = "\n".join((c.get("sparql") or "") for c in testable.values())
licensed = set(required) | {t for t in gloss if f"ciops:{t}" in sparql_blob}
supports_re = re.compile(r"supports=([A-Za-z0-9_|]+)")
supports = {}
for t, r in gloss.items():
    m = supports_re.search(r.get("notes") or "")
    if m:
        names = m.group(1).split("|")
        for n in names:
            if n not in gloss:
                blocker(f"glossary term {t} supports unknown term '{n}'")
        supports[t] = names
changed = True
while changed:
    changed = False
    for t, names in supports.items():
        if t not in licensed and any(n in licensed for n in names):
            licensed.add(t)
            changed = True
for t, r in gloss.items():
    if r["category"] == "individual":
        continue
    if t not in licensed:
        warn(f"admission-law: glossary {r['category']} '{t}' (src {r['source_cq']}) is neither CQ-licensed nor support-licensed (supports= reachability from CQ roots)")

# --- 6. traceability matrix ------------------------------------------------------
trace = list(csv.DictReader(io.StringIO((DOCS / "traceability-matrix.csv").read_text())))
traced = set()
for r in trace:
    cid = r["cq_id"]
    traced.add(cid)
    if cid not in cq_by_id:
        blocker(f"traceability row references unknown {cid}")
    if r["use_case_id"] not in uc_ids:
        blocker(f"traceability row {cid} references unknown {r['use_case_id']}")
    tp = PACKET / r["sparql_test"].removeprefix("ontology/") if r["sparql_test"].startswith("ontology/") else None
    full = PACKET / "ontology" / r["sparql_test"].removeprefix("ontology/")
    if r["sparql_test"] and not full.exists():
        blocker(f"traceability row {cid} test path missing: {r['sparql_test']}")
    for t in r["ontology_terms"].split(";"):
        t = t.strip()
        if t and t not in gloss:
            blocker(f"traceability row {cid} term '{t}' not in glossary")
for cid in testable:
    if cid not in traced:
        blocker(f"{cid} (testable) absent from traceability matrix")

# --- 7. use-case related_cqs referential ----------------------------------------
for u in ucs:
    for cid in u.get("related_cqs", []):
        if cid not in cq_by_id:
            blocker(f"{u['id']} related_cqs references unknown {cid}")

# --- 8. stale namespace / stray strings across the ontology dir ------------------
for f in (PACKET / "ontology").rglob("*"):
    if f.is_file() and "beep-effect.dev" in f.read_text(errors="ignore"):
        blocker(f"stale namespace domain in {f.relative_to(PACKET)}")

# --- summary ---------------------------------------------------------------------
must = sum(1 for c in cqs if c["priority"] == "must_have")
should = sum(1 for c in cqs if c["priority"] == "should_have")
print(f"\nSuite: {len(cqs)} CQs ({must} must / {should} should), {len(sparql_files)} tests, "
      f"{len(classes)} classes / {len(props)} properties / "
      f"{sum(1 for r in gloss.values() if r['category'] == 'individual')} individuals")
print(f"RESULT: {len(blockers)} blockers, {len(warns)} warns")
sys.exit(1 if blockers else 0)
