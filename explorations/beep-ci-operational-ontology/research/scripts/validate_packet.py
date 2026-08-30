"""Mechanical validator for the beep-ci-operational-ontology packet (the committed
carrier of the pre-S4 "round 0" checks — round-2 seats F+G: a validator cited by the
lane contract must exist in the tree, not in a session scratchpad).

Zero-judgment referential/syntax gates over the S4 frozen-input surface. Exit 1 on any
BLOCKER; prints BLOCKER/WARN/OK lines. KNOWN LIMITS (round-2 seat G): this checker
proves parse + referential integrity, NOT query semantics — SPARQL-vs-NL fidelity,
vacuity, and adversarial graphs are run_cq_suite.py's job; it also derives
traceability expectations from the same YAML it validates, so it cannot see
requireds-vs-query drift (e.g. an untyped ?subject wider than required_classes).

Run: uv run --with pyyaml,rdflib python validate_packet.py            (packet mode)
     uv run --with pyyaml,rdflib python validate_packet.py --s4-lane <file>
                                                                       (lane mode —
     validates ONE S4 extraction-lane output against the lane contract §6: telemetry
     completeness, two-kind admission fields with Must/Should-only decision citations,
     source_domain on literal-domain-members, statuses, counts, evidence paths.
     Round-3 I-08: this mode is real; unknown arguments are an argparse error.)
"""
import argparse
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


_parser = argparse.ArgumentParser(description="beep-ci-ops packet / S4-lane validator")
_parser.add_argument("--s4-lane", metavar="FILE", help="validate one S4 lane output file instead of the packet")
_parser.add_argument("--s5", action="store_true", help="validate the S5 dispositions surface against s5-taxonomy-contract.md")
_args = _parser.parse_args()

if _args.s4_lane:
    lane_path = Path(_args.s4_lane)
    if not lane_path.exists():
        blocker(f"--s4-lane file not found: {lane_path}")
        print(f"RESULT: {len(blockers)} blockers, {len(warns)} warns")
        sys.exit(1)
    lane = yaml.safe_load(lane_path.read_text()) or {}
    _cqs = yaml.safe_load((DOCS / "competency-questions.yaml").read_text())
    _prio = {c["id"]: c["priority"] for c in _cqs}
    _gloss_terms = {r["term"] for r in csv.DictReader(io.StringIO((DOCS / "pre-glossary.csv").read_text()))}
    tel = lane.get("telemetry") or {}
    for key in ("lane", "runner", "model", "reasoning_effort", "prompt_version", "corpus_commit",
                "started", "finished", "frozen_inputs", "candidate_count", "fact_count", "issue_count"):
        if key not in tel:
            blocker(f"telemetry missing '{key}'")
    frozen = tel.get("frozen_inputs") or []
    frozen_paths = {e.get("path") for e in frozen if isinstance(e, dict)}
    for p in sorted({f"ontology/docs/{n}" for n in (
            "competency-questions.yaml", "pre-glossary.csv", "literal-domains.md", "orsd.md", "scope.md")} - frozen_paths):
        blocker(f"telemetry frozen_inputs missing {p}")
    for e in frozen:
        if isinstance(e, dict) and not re.fullmatch(r"[0-9a-f]{12}", str(e.get("sha256_12", ""))):
            blocker(f"frozen input {e.get('path')} lacks a 12-hex sha256_12")
    if not re.fullmatch(r"[0-9a-f]{12}|[0-9a-f]{40}", str(tel.get("corpus_commit", ""))):
        blocker(f"corpus_commit {tel.get('corpus_commit')!r} is not a 12/40-hex commit")
    issues = lane.get("issues") or []
    cands = lane.get("candidates") or []
    facts = lane.get("facts") or []
    for field, seq in (("candidate_count", cands), ("fact_count", facts), ("issue_count", issues)):
        if tel.get(field) != len(seq):
            blocker(f"telemetry {field}={tel.get(field)} but the list holds {len(seq)}")
    cand_names = {c.get("candidate") for c in cands}

    def _check_decision_cites(rec, label):
        cited = rec.get("cq_justification") or []
        if not cited:
            blocker(f"{label}: empty cq_justification")
        for cid in cited:
            if cid not in _prio:
                blocker(f"{label}: cites unknown {cid}")
            elif _prio[cid] not in ("must_have", "should_have"):
                blocker(f"{label}: cites {cid} ({_prio[cid]}) — decision admissions need a Must/Should CQ (round-3 W-10)")

    for c in cands:
        label = f"candidate {c.get('candidate')!r}"
        kind = c.get("admission_kind")
        if kind == "decision":
            _check_decision_cites(c, label)
        elif kind == "semantic-support":
            sup = c.get("supports") or []
            if not sup:
                blocker(f"{label}: semantic-support with empty supports")
            for n in sup:
                if n not in _gloss_terms and n not in cand_names:
                    blocker(f"{label}: supports {n!r} — neither a glossary term nor a same-output candidate")
        else:
            blocker(f"{label}: admission_kind must be decision|semantic-support, got {kind!r}")
        if c.get("kind") == "literal-domain-member" and not c.get("source_domain"):
            blocker(f"{label}: literal-domain-member without source_domain")
        if c.get("status") != "candidate":
            blocker(f"{label}: status must be 'candidate', got {c.get('status')!r}")
    for fc in facts:
        label = f"fact {fc.get('subject')}.{fc.get('predicate')}"
        _check_decision_cites(fc, label)
        if fc.get("status") != "candidate":
            blocker(f"{label}: status must be 'candidate', got {fc.get('status')!r}")
    for i in issues:
        if i.get("status") != "open":
            blocker(f"issue {i.get('id')}: status must be 'open', got {i.get('status')!r}")
    repo_root = PACKET.parents[1]
    evid_path_re = re.compile(r"^([^:\s]+):")
    for rec in [*cands, *facts, *issues]:
        ev = rec.get("evidence")
        for line in (ev if isinstance(ev, list) else [ev] if ev else []):
            m = evid_path_re.match(str(line))
            if m and not (repo_root / m.group(1)).exists():
                blocker(f"evidence path missing from tree: {m.group(1)}")
    print(f"LANE {tel.get('lane')!r}: {len(cands)} candidates / {len(facts)} facts / {len(issues)} issues")
    print(f"RESULT: {len(blockers)} blockers, {len(warns)} warns")
    sys.exit(1 if blockers else 0)


if _args.s5:
    S5 = PACKET / "ontology/extraction/s5"
    S4D = PACKET / "ontology/extraction/s4"
    BC = S4D / "beep-ci-ops"
    RULINGS = {"accepted-via", "merged-into", "rejected", "parked-run-2", "deferred-s6"}
    disp = yaml.safe_load((S5 / "DISPOSITIONS.yaml").read_text())
    join = yaml.safe_load((S5 / "JOIN.yaml").read_text())
    cands = yaml.safe_load((S4D / "CANDIDATES.yaml").read_text())
    facts = yaml.safe_load((S4D / "FACTS.yaml").read_text())
    ledger = yaml.safe_load((S4D / "LEDGER.yaml").read_text())
    cons = yaml.safe_load((S5 / "CONSTRAINTS.yaml").read_text())
    index = yaml.safe_load((BC / "runs/orun-2026-08-29T08:20:55Z.index.yaml").read_text())
    rats = {f.stem for f in (BC / "governance/ratifications").glob("rat-*.yaml")}
    con_ids = {c["id"] for c in cons.get("constraints", [])}
    ledger_ids = {e["id"] for e in ledger}
    # constraints reference real ledger entries
    for c in cons.get("constraints", []):
        if c.get("source") not in ledger_ids:
            blocker(f"constraint {c.get('id')} sources unknown ledger entry {c.get('source')}")
    # candidate totality: seq bijection with CANDIDATES.yaml, rulings in vocab
    rows = disp.get("candidates") or []
    seqs = [r.get("seq") for r in rows]
    if sorted(seqs) != list(range(len(cands))):
        blocker(f"candidate rows are not a seq-bijection with CANDIDATES.yaml ({len(rows)} rows / {len(cands)} candidates)")
    jrows = {r["seq"]: r for r in join.get("rows", [])}
    for r in rows:
        if r.get("ruling") not in RULINGS:
            blocker(f"candidate seq={r.get('seq')} has unknown ruling {r.get('ruling')!r}")
        j = jrows.get(r.get("seq"))
        if j is None or j.get("candidate") != r.get("candidate"):
            blocker(f"candidate seq={r.get('seq')} does not match JOIN row identity")
        elif j.get("kind") != r.get("kind"):
            blocker(f"candidate seq={r.get('seq')}: kind {r.get('kind')!r} disagrees with JOIN kind {j.get('kind')!r}")
        if r.get("ruling") == "deferred-s6" and r.get("kind") != "individual":
            blocker(f"candidate seq={r.get('seq')}: deferred-s6 is legal only for individuals")
        if r.get("ruling") == "merged-into" and not r.get("merged_into"):
            blocker(f"candidate seq={r.get('seq')}: merged-into without a target term")
        jr = str(r.get("join_ref") or "")
        if jr.startswith("rat-") and jr not in rats:
            blocker(f"candidate seq={r.get('seq')} join_ref {jr} is not a ratification on disk")
    # ledger totality
    lrows = disp.get("ledger") or []
    if {r.get("entry") for r in lrows} != ledger_ids or len(lrows) != len(ledger):
        blocker(f"ledger rows are not a bijection with LEDGER.yaml ({len(lrows)} vs {len(ledger)})")
    for r in lrows:
        if r.get("ruling") not in RULINGS:
            blocker(f"ledger {r.get('entry')}: unknown ruling {r.get('ruling')!r}")
        jr = str(r.get("join_ref") or "")
        if jr.startswith("con:") and jr not in con_ids:
            blocker(f"ledger {r.get('entry')} join_ref {jr} is not in CONSTRAINTS.yaml")
    # archived unresolved observations: exact set, parked-run-2 only
    unresolved = {x["observation"] for x in index if x.get("outcome") == "unresolved"}
    orows = disp.get("observations") or []
    if {r.get("observation") for r in orows} != unresolved or len(orows) != len(unresolved):
        blocker(f"observation rows are not the archived unresolved set ({len(orows)} vs {len(unresolved)})")
    for r in orows:
        if r.get("ruling") != "parked-run-2":
            blocker(f"observation {str(r.get('observation'))[:24]}: only parked-run-2 is legal (ratified waiver)")
    # fact classes partition all facts
    seen = set()
    for r in disp.get("fact_classes") or []:
        if r.get("ruling") not in RULINGS:
            blocker(f"fact class {r.get('predicate')}/{r.get('subject_disposition')}: unknown ruling {r.get('ruling')!r}")
        for i in r.get("covers") or []:
            if i in seen:
                blocker(f"fact index {i} covered twice")
            seen.add(i)
    if seen != set(range(len(facts))):
        blocker(f"fact classes cover {len(seen)} of {len(facts)} facts")
    # taxonomy (present only after the seat round)
    tax_path = S5 / "TAXONOMY.yaml"
    if not tax_path.exists():
        warn("TAXONOMY.yaml absent — pre-seat stage; the completion gate requires it")
    else:
        tax = yaml.safe_load(tax_path.read_text())
        term_list = tax.get("terms", [])
        names = [t.get("term") for t in term_list]
        for n in sorted({x for x in names if names.count(x) > 1}):
            blocker(f"taxonomy term {n} appears more than once")
        terms = {t.get("term"): t for t in term_list}
        accepted_terms = set(terms)
        # REQUIRED set derives from the ratified proposals + accepted dispositions,
        # never from what the seats submitted (PR #905 review)
        required = set()
        for f in sorted((BC / "work/proposals").glob("otp-*.yaml")):
            if "review" not in f.name:
                required.add(yaml.safe_load(f.read_text())["term"]["local_name"])
        allowed_extra = set()
        for r in rows:
            if r.get("ruling") == "accepted-via":
                required.add(r.get("candidate"))
            elif r.get("ruling") in ("merged-into", "deferred-s6", "rejected", "parked-run-2"):
                allowed_extra.add(r.get("candidate"))
        for n in sorted(required - accepted_terms):
            blocker(f"taxonomy is missing required accepted term {n}")
        for n in sorted(accepted_terms - required):
            blocker(f"taxonomy term {n} is not an accepted term"
                    + (" (its candidate was not accepted)" if n in allowed_extra else ""))
        kind_by_name = {}
        for r in rows:
            kind_by_name.setdefault(r.get("candidate"), set()).add(r.get("kind"))
        for t in term_list:
            kind = t.get("kind")
            for field in ("term", "kind"):
                if not t.get(field):
                    blocker(f"taxonomy record missing required field {field}: {t}")
            if kind in ("class", "property"):
                for field in ("rigidity", "identity_ref"):
                    if not t.get(field):
                        blocker(f"taxonomy {t.get('term')}: {field} is required for a {kind}")
            src_kinds = kind_by_name.get(t.get("term"))
            if src_kinds and kind not in src_kinds and kind is not None:
                blocker(f"taxonomy {t.get('term')}: kind {kind} disagrees with the S4 candidate kind {sorted(src_kinds)}")
        for t in term_list:
            kind = t.get("kind")
            for parent in t.get("parents") or []:
                if parent not in accepted_terms:
                    blocker(f"taxonomy {t.get('term')}: parent {parent} is not an accepted term")
                    continue
                if kind != "class" or terms[parent].get("kind") != "class":
                    blocker(f"taxonomy {t.get('term')}: parents is class-subsumption only")
            io = t.get("instance_of")
            if kind in ("individual", "literal-domain-member") and not io:
                blocker(f"taxonomy {t.get('term')}: individuals need instance_of")
            if io and io not in accepted_terms:
                blocker(f"taxonomy {t.get('term')}: instance_of {io} is not accepted")
            elif io and terms[io].get("kind") != "class":
                blocker(f"taxonomy {t.get('term')}: instance_of target {io} must be a class")
            for prm in t.get("parameters") or []:
                name = str(prm.get("property") or "")
                if (name.endswith("Ms") or name.endswith("Millis") or "token" in name.lower())                         and prm.get("range_kind") not in ("recorded-value",):
                    blocker(f"taxonomy {t.get('term')}.{name}: measurement parameters are recorded-value data properties (ratified precedent)")
        # acyclicity
        color = {}
        def dfs(n, stack):
            if n in stack:
                blocker(f"taxonomy subsumption cycle through {n}")
                return
            if color.get(n):
                return
            stack.add(n)
            for parent in (terms.get(n, {}).get("parents") or []):
                dfs(parent, stack)
            stack.discard(n)
            color[n] = True
        for t in terms:
            dfs(t, set())
        referenced = set()
        for t in tax.get("terms", []):
            referenced.update(t.get("constraint_refs") or [])
        for cid in con_ids - referenced - set(tax.get("waived_constraints") or []):
            blocker(f"constraint {cid} is neither referenced by TAXONOMY nor explicitly waived")
    print(f"S5: {len(rows)} candidates / {len(lrows)} ledger / {len(orows)} observations / "
          f"{len(disp.get('fact_classes') or [])} fact classes / {len(con_ids)} constraints")
    print(f"RESULT: {len(blockers)} blockers, {len(warns)} warns")
    sys.exit(1 if blockers else 0)


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

# admission law (TWO-KIND, final-grill round 2; hardened round 3 after seats I-03 +
# H-09 proved two FALSE LICENSES): a term is licensed as a DECISION TERM — required by
# a MUST/SHOULD CQ or used as an EXACT QName token in a testable query (substring
# matching licensed `dependsOn` off `dependsOnTransitive`; all-priority roots licensed
# the Could-only `estimatedFailureProbability`) — or as a SEMANTIC-SUPPORT TERM whose
# glossary notes name the decision term(s) it serves via `supports=A|B`, licensed by
# reachability from CQ roots iterated to fixpoint. An unlicensed T-Box term is now a
# BLOCKER, not a warning.
sparql_blob = "\n".join((c.get("sparql") or "") for c in testable.values())
qname_tokens = set(re.findall(r"ciops:([A-Za-z_][A-Za-z0-9_-]*)", sparql_blob))
testable_required = set()
for c in testable.values():
    testable_required.update(c.get("required_classes", []))
    testable_required.update(c.get("required_properties", []))
licensed = testable_required | {t for t in gloss if t in qname_tokens}
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
        blocker(f"admission-law: glossary {r['category']} '{t}' (src {r['source_cq']}) is neither Must/Should-licensed nor support-licensed (exact-token reachability from CQ roots)")

# literal-domain member audit (round-3 H-09/W-09): each DOMAIN's glossary class must
# be licensed (blocker); each MEMBER is exercised by exact QName use in a testable
# query, by the seed, or carries an inline `*(supports: ...)` annotation directly
# after it — the rest are aggregated into one S5-visibility warn (the licensed
# DOMAIN, not the member, is the admission unit).
DOMAIN_CLASS_ALIAS = {"ScopeKind": "Scope", "AssuranceTierId": "AssuranceTier", "ContendedResourceId": "ContendedResource"}
domain_rows = re.findall(
    r"^\|\s*`([A-Za-z]+)`\s*\|\s*(.+?)\s*\|", (DOCS / "literal-domains.md").read_text(), re.M
)
seed_text = (TESTS / "fixtures/seed.ttl").read_text()
unexercised = []
for domain, member_cell in domain_rows:
    if domain == "Domain":
        continue
    cls = DOMAIN_CLASS_ALIAS.get(domain, domain)
    if cls not in licensed:
        blocker(f"literal-domain '{domain}' has no licensed glossary class ('{cls}')")
    members = list(re.finditer(r"`([A-Za-z]+)`", member_cell))
    for i, mm in enumerate(members):
        member = mm.group(1)
        seg_end = members[i + 1].start() if i + 1 < len(members) else len(member_cell)
        annotated = "supports:" in member_cell[mm.end():seg_end]
        if member in qname_tokens or f"ciops:{member}" in seed_text or annotated:
            continue
        unexercised.append(f"{domain}.{member}")
if unexercised:
    warn(f"literal-domain members unexercised (no testable QName / seed use / supports annotation; S5 visibility): {', '.join(unexercised)}")

# binding-convention statics (round-3 H-08): every `# harness binds` block in the
# generated queries carries exactly ONE row, and multi-block queries carry the SAME
# committed tuple in every block.
bind_re = re.compile(r"VALUES\s*(?:\([^)]*\)|\?\w+)\s*\{([^}]*)\}\s*#\s*harness binds")
for f in sparql_files:
    tuples = set()
    for body in bind_re.findall(f.read_text()):
        rows = re.findall(r"\([^)]*\)", body) or ([body.strip()] if body.strip() else [])
        if len(rows) != 1:
            blocker(f"{f.name}: marked binding block carries {len(rows)} rows (one-row rule)")
        else:
            tuples.add(re.sub(r"\s+", " ", rows[0]).strip())
    if len(tuples) > 1:
        blocker(f"{f.name}: marked blocks disagree on the committed tuple")

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
