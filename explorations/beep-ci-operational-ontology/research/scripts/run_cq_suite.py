"""Executing CQ fixture harness (round-2 deliverable).

The round-2 adversaries proved the gap wasn't reasoning effort but the missing ENGINE:
parse-only checks certified queries with real semantic bugs (BIND scoping, invalidated
discharge, aggregate bias). This runner executes every generated Must/Should test
against the seeded A-Box and then replays every recorded counterexample as a must-fail
fixture — review findings become permanent executable invariants (the partner review's
closing principle). Extended by the post-grill application pass: the scheduling-trio +
starvation CQs, the CQ-010 tri-split reshape, and CQ-019's now-enforced closed
scope-provenance (both arms antecedent-guarded).

Oracles:
- non_empty  -> >= 1 solution AND every projected variable bound in every row
               (allowance: cq-013 may leave ?lane/?p50 unbound — the visible-coverage-
               hole repair); plus cq-012's counts must MATCH on the seed.
- zero_rows  -> exactly 0 solutions.
- boolean    -> the VALUE must equal the seed expectation (true), not merely be boolean.
Fixture oracles: rows_ge_1 [all_bound], ask_false, counts_mismatch.

Run: uv run --with pyoxigraph python run_cq_suite.py    (exit 1 on any failure)
"""
import sys
from pathlib import Path

from pyoxigraph import Store

PACKET = Path(__file__).resolve().parents[2]
TESTS = PACKET / "ontology/tests"
FIX = TESTS / "fixtures"

UNBOUND_ALLOWED = {"cq-013": {"lane", "p50"}}

# Antecedent non-vacuity companions (partner review 2): a zero-rows constraint is
# accepted ONLY when its antecedent population exists in the graph — emptiness must be
# intentional, never accidental. Each ASK must be TRUE against the seed.
ANTECEDENTS = {
    "cq-009": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
        ASK { ?g ciops:hasGrantState ciops:ActiveGrant ; ciops:occupiesCheckout ?c ;
                 ciops:hasWorkKind ciops:FullProofWork . }""",
    "cq-010": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
        ASK { ?wu ciops:admittedBy ?g .
              ?g ciops:admissionChargeTokens ?ch ; ciops:capacityAtAdmissionTokens ?cap . }""",
    # cq-019 requires BOTH populations: a fail-open computation (arm 1) AND a typed
    # subject with a narrowed scope (arm 2) — else either arm's zero rows is vacuous.
    "cq-019": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
        ASK { ?c a ciops:AffectedComputation ; ciops:hasAffectedOutcome ?o .
              ?o a ciops:FailOpenOutcome .
              VALUES ?stype { ciops:VerificationEvidence ciops:ScheduleProposal }
              ?s a ?stype ; ciops:hasScope ?scope .
              FILTER (?scope != ciops:FullRepoScope) }""",
    "cq-023": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
        ASK { ?r a ciops:SeatRequest ; ciops:observedQueueWaitMs ?w ; ciops:governedBy ?p .
              ?p ciops:starvationBoundMs ?b . }""",
    "cq-026": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
        ASK { ?wu ciops:admittedBy ?g ; ciops:hasCostEstimate ?ce . ?ce ciops:p95Ms ?p .
              ?g ciops:hasBudget ?b . ?b ciops:softP95BudgetMs ?m . }""",
}

FIXTURES = [
    ("must-fail/cq004-touched-only.ttl", "cq-004", "rows_ge_1_all_bound"),
    ("must-fail/cq006-invalidated-proof.ttl", "cq-006", "rows_ge_1"),
    ("must-fail/cq006-unrelated-proof.ttl", "cq-006", "rows_ge_1"),
    ("must-fail/cq009-two-grants.ttl", "cq-009", "rows_ge_1"),
    ("must-fail/cq010-oversize.ttl", "cq-010", "rows_ge_1"),
    ("must-fail/cq019-filtered-trust.ttl", "cq-019", "rows_ge_1"),
    ("must-fail/cq019-scope-gap.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq019-schedule-trust.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq023-starved-request.ttl", "cq-023", "rows_ge_1_all_bound"),
    ("must-fail/cq026-p95-overrun.ttl", "cq-026", "rows_ge_1_all_bound"),
    ("must-fail/cq015-no-mount.ttl", "cq-015", "ask_false"),
    ("must-fail/cq012-incomplete-episode.ttl", "cq-012", "counts_mismatch"),
]

failures = []


def fail(msg):
    failures.append(msg)
    print(f"FAIL: {msg}")


def load_store(*ttl_paths):
    store = Store()
    for p in ttl_paths:
        store.load(p.read_bytes(), "text/turtle")
    return store


def query_file(store, name):
    return store.query((TESTS / f"{name}.sparql").read_text())


def rows_of(result):
    out = []
    for sol in result:
        row = {}
        for v in result.variables:
            term = sol[v]
            row[v.value] = term
        out.append(row)
    return out


def expected_of(name):
    header = (TESTS / f"{name}.sparql").read_text().splitlines()[1]
    return header.split("Expected: ")[1].split(" |")[0]


# --- seed pass -------------------------------------------------------------------
seed = load_store(FIX / "seed.ttl")
names = sorted(p.stem for p in TESTS.glob("cq-*.sparql"))
for name in names:
    exp = expected_of(name)
    res = query_file(seed, name)
    if exp == "boolean":
        val = bool(res)
        if val is not True:
            fail(f"{name}: seed ASK expected true, got {val}")
        else:
            print(f"PASS: {name} seed ask=true")
        continue
    rows = rows_of(res)
    if exp == "zero_rows":
        if rows:
            fail(f"{name}: seed expected zero rows, got {len(rows)}")
            continue
        ant = ANTECEDENTS.get(name)
        if ant is not None and not bool(seed.query(ant)):
            fail(f"{name}: zero rows is VACUOUS — antecedent population absent from seed")
            continue
        print(f"PASS: {name} seed zero rows (antecedent populated — non-vacuous)")
        continue
    # non_empty
    if not rows:
        fail(f"{name}: seed expected non-empty, got 0 rows")
        continue
    allowed = UNBOUND_ALLOWED.get(name, set())
    unbound = [
        (i, v)
        for i, row in enumerate(rows)
        for v, term in row.items()
        if term is None and v not in allowed
    ]
    if unbound:
        fail(f"{name}: seed rows carry unbound variables {unbound[:4]} (seat E oracle)")
        continue
    if name == "cq-012":
        row = rows[0]
        dec, win = row.get("decomposedEpisodes"), row.get("windowEpisodes")
        if dec is None or win is None or dec.value != win.value:
            fail(f"cq-012: seed counts mismatch decomposed={dec} window={win}")
            continue
    print(f"PASS: {name} seed {len(rows)} row(s), all bound")

# --- must-fail fixture pass ------------------------------------------------------
for rel, name, oracle in FIXTURES:
    store = load_store(FIX / rel)
    res = query_file(store, name)
    tag = f"{rel} -> {name}"
    if oracle == "ask_false":
        val = bool(res)
        if val is False:
            print(f"PASS: {tag} ask=false")
        else:
            fail(f"{tag}: expected ask false, got {val}")
        continue
    rows = rows_of(res)
    if oracle in ("rows_ge_1", "rows_ge_1_all_bound"):
        if not rows:
            fail(f"{tag}: expected >=1 row (violation/obligation must surface), got 0")
            continue
        if oracle == "rows_ge_1_all_bound":
            unbound = [(i, v) for i, row in enumerate(rows) for v, t in row.items() if t is None]
            if unbound:
                fail(f"{tag}: rows unbound {unbound} (the round-1 BIND bug pattern)")
                continue
        print(f"PASS: {tag} {len(rows)} row(s)")
    elif oracle == "counts_mismatch":
        if not rows:
            fail(f"{tag}: expected one aggregate row, got 0")
            continue
        row = rows[0]
        dec, win = row.get("decomposedEpisodes"), row.get("windowEpisodes")
        if dec is None or win is None:
            fail(f"{tag}: counts unbound (decomposed={dec}, window={win})")
        elif dec.value == win.value:
            fail(f"{tag}: counts EQUAL ({dec.value}) — incomplete episode invisible again")
        else:
            print(f"PASS: {tag} counts mismatch visible ({dec.value} != {win.value})")

print(f"\nRESULT: {len(failures)} failure(s) across {len(names)} seed tests + {len(FIXTURES)} fixtures")
sys.exit(1 if failures else 0)
