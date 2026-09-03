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
import re
import sys
from pathlib import Path

from pyoxigraph import RdfFormat, Store

PACKET = Path(__file__).resolve().parents[2]
TESTS = PACKET / "ontology/tests"
FIX = TESTS / "fixtures"
S6 = PACKET / "ontology/extraction/s6"

UNBOUND_ALLOWED = {"cq-013": {"lane", "p50"}}

# Antecedent non-vacuity companions (partner review 2): a zero-rows constraint is
# accepted ONLY when its antecedent population exists in the graph — emptiness must be
# intentional, never accidental. Each ASK must be TRUE against the seed.
ANTECEDENTS = {
    "cq-009": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
        ASK { ?g a ciops:SeatGrant ; ciops:hasGrantState ciops:ActiveGrant ;
                 ciops:hasOriginKey ?o . FILTER(?o != "") }""",
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
        ASK { ?g ciops:usedCostEstimate ?ce . ?ce ciops:p95Ms ?p .
              ?g ciops:hasBudget ?b . ?b ciops:softP95BudgetMs ?m . }""",
}

FIXTURES = [
    ("must-fail/cq004-touched-only.ttl", "cq-004", "rows_ge_1_all_bound"),
    ("must-fail/cq006-invalidated-proof.ttl", "cq-006", "rows_ge_1"),
    ("must-fail/cq006-unrelated-proof.ttl", "cq-006", "rows_ge_1"),
    ("must-fail/cq008-ticket-not-grant.ttl", "cq-008", "rows_eq_0"),
    ("must-fail/cq009-two-grants.ttl", "cq-009", "rows_ge_1"),
    ("must-fail/cq010-oversize.ttl", "cq-010", "rows_ge_1"),
    ("must-fail/cq010-string-tokens.ttl", "cq-010", "rows_ge_1"),
    ("must-fail/cq019-filtered-trust.ttl", "cq-019", "rows_ge_1"),
    ("must-fail/cq019-scope-gap.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq019-schedule-trust.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq019-derived-scope-gap.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq019-step-scope-gap.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq019-dangling-target.ttl", "cq-019", "rows_ge_1_all_bound"),
    ("must-fail/cq022-cross-attempt.ttl", "cq-022", "rows_eq_0"),
    ("must-fail/cq023-starved-request.ttl", "cq-023", "rows_ge_1_all_bound"),
    ("must-fail/cq023-invented-exception.ttl", "cq-023", "rows_ge_1_all_bound"),
    ("must-fail/cq026-p95-overrun.ttl", "cq-026", "rows_ge_1_all_bound"),
    ("must-fail/cq026-string-budget.ttl", "cq-026", "rows_ge_1_all_bound"),
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
        store.load(p.read_bytes(), RdfFormat.TURTLE)
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


def predicate_coverage():
    """Read the generated coverage table without adding PyYAML to this runner."""

    text = (S6 / "PREDICATES.yaml").read_text()
    marker = "\ncoverage:\n"
    if marker not in text:
        raise ValueError("PREDICATES.yaml has no coverage table")
    section = text.split(marker, 1)[1]
    rows = {}
    for match in re.finditer(r"(?ms)^- cq: (CQ-\d+)\n(?P<body>.*?)(?=^- cq: |\Z)", section):
        cid = match.group(1)
        body = match.group("body")
        count = re.search(r"(?m)^  predicate_count: (\d+)$", body)
        ratified = re.search(r"(?m)^  ratified_count: (\d+)$", body)
        full = re.search(r"(?m)^  full_predicate_set_ratified: (true|false)$", body)
        if not count or not ratified or not full:
            raise ValueError(f"incomplete PREDICATES coverage row for {cid}")
        rows[cid.lower()] = {
            "predicate_count": int(count.group(1)),
            "ratified_count": int(ratified.group(1)),
            "full": full.group(1) == "true",
        }
    return rows


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

# --- S6 golden pass -------------------------------------------------------------
# Selection is data, not a hand-maintained CQ allowlist: the generated predicate
# coverage row must be fully ratified and the existing non-vacuity ASK must hold
# in the golden store.  Census and seed are deliberately absent.
try:
    coverage = predicate_coverage()
except (OSError, ValueError) as exc:
    fail(f"golden coverage table unreadable: {exc}")
    coverage = {}
if set(coverage) != set(names):
    fail(
        f"golden coverage keys differ from CQ files: "
        f"missing={sorted(set(names) - set(coverage))}, extra={sorted(set(coverage) - set(names))}"
    )

snapshot_paths = sorted((S6 / "graphs").glob("snapshot-*.ttl"))
if len(snapshot_paths) != 1:
    fail(f"golden store expected one snapshot graph, found {[p.name for p in snapshot_paths]}")
    golden = None
else:
    try:
        golden = load_store(S6 / "graphs/abox.ttl", snapshot_paths[0])
    except Exception as exc:  # noqa: BLE001
        fail(f"golden store failed to load: {exc}")
        golden = None

fully_ratified = 0
golden_executed = 0
golden_antecedent_true = 0
for name in names:
    row = coverage.get(name)
    if row is None:
        continue
    print(
        f"COVERAGE: {name} {row['ratified_count']}/{row['predicate_count']} ratified"
        + (" (full)" if row["full"] else "")
    )
    if not row["full"]:
        continue
    fully_ratified += 1
    antecedent = ANTECEDENTS.get(name)
    if antecedent is None:
        print(f"SKIP: {name} golden antecedent undefined")
        continue
    if golden is None or not bool(golden.query(antecedent)):
        print(f"SKIP: {name} golden antecedent absent")
        continue
    golden_antecedent_true += 1
    golden_executed += 1
    exp = expected_of(name)
    result = query_file(golden, name)
    if exp == "boolean":
        value = bool(result)
        if value is not True:
            fail(f"{name}: golden ASK expected true, got {value}")
        else:
            print(f"PASS: {name} golden ask=true")
        continue
    golden_rows = rows_of(result)
    if exp == "zero_rows":
        if golden_rows:
            fail(f"{name}: golden expected zero rows, got {len(golden_rows)}")
        else:
            print(f"PASS: {name} golden zero rows (antecedent populated)")
        continue
    if not golden_rows:
        fail(f"{name}: golden expected non-empty, got 0 rows")
    else:
        print(f"PASS: {name} golden {len(golden_rows)} row(s)")

if golden is not None:
    probes = [
        (
            "SeatRequest population has enqueuedAt",
            """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
               ASK { ?request a ciops:SeatRequest ; ciops:enqueuedAt ?instant . }""",
            True,
        ),
        (
            "every observedQueueWaitMs is numeric and non-negative",
            """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
               ASK { ?request ciops:observedQueueWaitMs ?wait .
                     FILTER(!isNumeric(?wait) || ?wait < 0) }""",
            False,
        ),
        (
            "hasOriginKey has a non-empty value",
            """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
               ASK { ?subject ciops:hasOriginKey ?origin . FILTER(?origin != \"\") }""",
            True,
        ),
    ]
    for label, ask, expected in probes:
        actual = bool(golden.query(ask))
        if actual != expected:
            fail(f"golden probe {label!r}: expected {expected}, got {actual}")
        else:
            print(f"PASS: golden probe {label}")
print(
    f"GOLDEN: {fully_ratified}/{len(names)} status-covered; "
    f"{golden_antecedent_true} antecedent-populated; {golden_executed} executed"
)

# --- binding-contract carrier (round-3 seat H-08) --------------------------------
# The `# harness binds` convention is EXECUTABLE, not prose: bind_params() is the
# canonical substitution (one single-line tuple, datatype-preserving because the
# caller passes serialized RDF terms, replacing ALL marked blocks), the static checks
# reject convention violations in the committed queries, and the mutation tests prove
# the machinery refuses the round-2 counterexample shapes (batched rows, partial
# multi-block replacement).
BIND_RE = re.compile(r"(VALUES\s*(?:\([^)]*\)|\?\w+)\s*\{)([^}]*)(\}\s*#\s*harness binds)")


def marked_blocks(text):
    return list(BIND_RE.finditer(text))


def block_rows(body):
    rows = re.findall(r"\([^)]*\)", body)
    return rows if rows else ([body.strip()] if body.strip() else [])


def bind_params(text, row):
    if not marked_blocks(text):
        raise ValueError("no marked blocks to bind")
    if not isinstance(row, str) or "\n" in row:
        raise ValueError("exactly one single-line parameter tuple is required")
    return BIND_RE.sub(lambda m: m.group(1) + " " + row + " " + m.group(3), text)


for name in names:
    text = (TESTS / f"{name}.sparql").read_text()
    seen_rows = set()
    for m in marked_blocks(text):
        rows = block_rows(m.group(2))
        if len(rows) != 1:
            fail(f"{name}: marked block carries {len(rows)} rows — the convention is ONE-ROW-ONLY")
        else:
            seen_rows.add(re.sub(r"\s+", " ", rows[0]).strip())
    if len(seen_rows) > 1:
        fail(f"{name}: marked blocks disagree on the committed tuple {sorted(seen_rows)}")

q2 = (TESTS / "cq-002.sparql").read_text()
committed = block_rows(marked_blocks(q2)[0].group(2))[0]
if rows_of(seed.query(bind_params(q2, committed))) != rows_of(seed.query(q2)):
    fail("binding: rebinding cq-002 with its committed tuple changed the result")
else:
    print("PASS: binding rebind-identity (cq-002)")
try:
    bind_params(q2, "ciops:a\nciops:b")
    fail("binding: batched/multi-line tuple was accepted (one-row rule dead)")
except ValueError:
    print("PASS: binding rejects a batched tuple")
q12 = (TESTS / "cq-012.sparql").read_text()
newrow = '("2026-09-01T00:00:00Z"^^xsd:dateTime "2026-09-30T23:59:59Z"^^xsd:dateTime)'
bound12 = bind_params(q12, newrow)
rows12 = {re.sub(r"\s+", " ", block_rows(m.group(2))[0]).strip() for m in marked_blocks(bound12)}
if rows12 == {re.sub(r"\s+", " ", newrow).strip()}:
    seed.query(bound12)  # must stay executable after substitution
    print("PASS: binding replaces ALL marked blocks with one tuple (cq-012)")
else:
    fail(f"binding: partial multi-block replacement — blocks carry {sorted(rows12)}")

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
    if oracle == "rows_eq_0":
        if rows:
            fail(f"{tag}: expected 0 rows (the exclusion must hold), got {len(rows)}")
        else:
            print(f"PASS: {tag} 0 rows (exclusion holds)")
        continue
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
