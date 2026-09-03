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
import importlib.util
import io
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

import yaml
from rdflib import Graph, RDF, URIRef
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
_parser.add_argument("--s6", action="store_true", help="validate the S6 A-Box, predicate, closure, and CQ-leg surface")
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


if _args.s6:
    S6 = PACKET / "ontology/extraction/s6"
    S5 = PACKET / "ontology/extraction/s5"
    S4D = PACKET / "ontology/extraction/s4"
    GRAPHS = S6 / "graphs"
    CI_NS = "https://oip.law/ontology/ci-ops#"
    PROV_NS = "https://oip.law/ontology/ci-ops-prov#"
    MANIFEST_NS = "https://oip.law/ontology/ci-ops-s6-manifest#"
    RDF_NS = str(RDF)
    required_paths = [
        S6 / "PREDICATES.yaml",
        S6 / "POLICY.yaml",
        S6 / "CENSUS.yaml",
        S6 / "ABOX.yaml",
        S6 / "snapshot/raw/MANIFEST.yaml",
        GRAPHS / "abox.ttl",
        GRAPHS / "census.ttl",
        S6 / "shapes/closure.ttl",
        S6 / "shapes/typing.ttl",
        S6 / "scripts/run_shacl.py",
    ]
    for path in required_paths:
        if not path.is_file():
            blocker(f"S6 required artifact missing: {path.relative_to(PACKET)}")
    snapshot_paths = sorted(GRAPHS.glob("snapshot-*.ttl"))
    manifest_graph_paths = sorted(GRAPHS.glob("manifest-*.ttl"))
    if len(snapshot_paths) != 1:
        blocker(f"S6 expected one snapshot graph, found {[path.name for path in snapshot_paths]}")
    if len(manifest_graph_paths) != 1:
        blocker(f"S6 expected one manifest graph, found {[path.name for path in manifest_graph_paths]}")
    if blockers:
        print(f"RESULT: {len(blockers)} blockers, {len(warns)} warns")
        sys.exit(1)

    predicates_doc = yaml.safe_load((S6 / "PREDICATES.yaml").read_text())
    policy = yaml.safe_load((S6 / "POLICY.yaml").read_text())
    abox_doc = yaml.safe_load((S6 / "ABOX.yaml").read_text())
    snapshot_manifest = yaml.safe_load((S6 / "snapshot/raw/MANIFEST.yaml").read_text())
    taxonomy = yaml.safe_load((S5 / "TAXONOMY.yaml").read_text())
    dispositions = yaml.safe_load((S5 / "DISPOSITIONS.yaml").read_text())
    cq_manifest = yaml.safe_load((TESTS / "cq-test-manifest.yaml").read_text())

    predicate_rows = predicates_doc.get("predicates") or []
    predicate_names = [row.get("predicate") for row in predicate_rows]
    if len(predicate_names) != len(set(predicate_names)):
        blocker("PREDICATES.yaml contains duplicate predicate records")
    allowed_statuses = {"ratified", "seed-only", "provisional", "parked-run-2"}
    registry = {}
    for row in predicate_rows:
        predicate = row.get("predicate")
        if row.get("status") not in allowed_statuses:
            blocker(f"predicate {predicate}: illegal status {row.get('status')!r}")
        for field in ("predicate", "status", "term_ref", "domain", "range", "closure", "used_by"):
            if field not in row:
                blocker(f"predicate {predicate}: missing registry field {field}")
        registry[predicate] = row

    def curie(value):
        text = str(value)
        if text == RDF_NS + "type":
            return "rdf:type"
        if text.startswith(CI_NS):
            return "ciops:" + text.removeprefix(CI_NS)
        if text.startswith(PROV_NS):
            return "ciops-prov:" + text.removeprefix(PROV_NS)
        if text.startswith(MANIFEST_NS):
            return "manifest:" + text.removeprefix(MANIFEST_NS)
        return text

    graph_paths = {
        "graphs/abox.ttl": GRAPHS / "abox.ttl",
        "graphs/census.ttl": GRAPHS / "census.ttl",
        "graphs/snapshot-<instant>.ttl": snapshot_paths[0],
        "graphs/manifest-<instant>.ttl": manifest_graph_paths[0],
        "tests/fixtures/seed.ttl": TESTS / "fixtures/seed.ttl",
    }
    parsed_graphs = {}
    for label, path in graph_paths.items():
        try:
            parsed_graphs[label] = Graph().parse(path, format="turtle")
        except Exception as exc:  # noqa: BLE001
            blocker(f"{label} fails Turtle parse: {exc}")
    if blockers:
        print(f"RESULT: {len(blockers)} blockers, {len(warns)} warns")
        sys.exit(1)

    # Typing law and the provisional-namespace quarantine apply to the ratified
    # A-Box/snapshot pair; the companion manifest is metadata, not a CI-ops A-Box.
    ratified_classes = {
        term["term"] for term in taxonomy.get("terms", []) if term.get("kind") == "class"
    }
    if len(ratified_classes) != 18:
        blocker(f"S6 typing expected 18 ratified classes, found {len(ratified_classes)}")
    for label in ("graphs/abox.ttl", "graphs/snapshot-<instant>.ttl"):
        graph = parsed_graphs[label]
        subjects = {subject for subject, _, _ in graph if isinstance(subject, URIRef)}
        for subject in sorted(subjects, key=str):
            types = {obj for obj in graph.objects(subject, RDF.type) if isinstance(obj, URIRef)}
            ratified_types = {
                str(obj).removeprefix(CI_NS)
                for obj in types
                if str(obj).startswith(CI_NS) and str(obj).removeprefix(CI_NS) in ratified_classes
            }
            if not ratified_types:
                blocker(f"{label}: individual {curie(subject)} has no ratified-class rdf:type")
            for obj in types:
                if not str(obj).startswith(CI_NS) or str(obj).removeprefix(CI_NS) not in ratified_classes:
                    blocker(f"{label}: individual {curie(subject)} has unratified type {curie(obj)}")
    for label, graph in parsed_graphs.items():
        if label == "graphs/census.ttl":
            continue
        for triple in graph:
            for term in triple:
                if isinstance(term, URIRef) and str(term).startswith(PROV_NS):
                    blocker(f"{label}: ciops-prov term escaped the census graph ({curie(term)})")

    # Predicate law covers every generated data graph, the seed graph, and every
    # mechanically scanned CQ.  Only abox+snapshot are purity-constrained.
    for label, graph in parsed_graphs.items():
        for predicate in sorted({curie(pred) for pred in graph.predicates()}):
            row = registry.get(predicate)
            if row is None:
                blocker(f"{label}: predicate {predicate} is absent from PREDICATES.yaml")
            elif label in {"graphs/abox.ttl", "graphs/snapshot-<instant>.ttl"} and row.get("status") != "ratified":
                blocker(f"{label}: predicate {predicate} has non-ratified status {row.get('status')}")

    qname = r"(?:rdf:type|a|ciops:[A-Za-z_][A-Za-z0-9_-]*)"
    variable_head_re = re.compile(rf"\?[A-Za-z_][A-Za-z0-9_]*\s+({qname})(?=\s)")
    fixed_head_re = re.compile(
        rf"[{{.}}]\s*ciops:[A-Za-z_][A-Za-z0-9_-]*\s+({qname})(?=\s)"
    )
    continuation_re = re.compile(rf";\s*({qname})(?=\s)")

    def scan_cq(text):
        stripped = re.sub(r"(?m)#.*$", "", text)
        stripped = re.sub(r"(?mi)^\s*PREFIX\s+.*$", "", stripped)
        stripped = re.sub(
            r"(?is)\bVALUES\s+(?:\([^)]*\)|\?[A-Za-z_][A-Za-z0-9_]*)\s*\{[^{}]*\}",
            "",
            stripped,
        )
        found = (
            set(variable_head_re.findall(stripped))
            | set(fixed_head_re.findall(stripped))
            | set(continuation_re.findall(stripped))
        )
        return sorted("rdf:type" if token == "a" else token for token in found)

    coverage_rows = predicates_doc.get("coverage") or []
    coverage_by_cq = {row.get("cq"): row for row in coverage_rows}
    cq_paths = sorted(TESTS.glob("cq-*.sparql"))
    for path in cq_paths:
        cid = "CQ-" + path.stem.split("-")[1]
        scanned = scan_cq(path.read_text())
        for predicate in scanned:
            if predicate not in registry:
                blocker(f"{cid}: predicate {predicate} is absent from PREDICATES.yaml")
        row = coverage_by_cq.get(cid)
        if row is None:
            blocker(f"{cid}: no PREDICATES coverage row")
            continue
        if row.get("predicates") != scanned:
            blocker(f"{cid}: coverage predicate set disagrees with the mechanical gate scan")
        ratified_count = sum(
            1
            for predicate in scanned
            if registry.get(predicate, {}).get("status") == "ratified"
        )
        if row.get("predicate_count") != len(scanned) or row.get("ratified_count") != ratified_count:
            blocker(f"{cid}: coverage counts drifted from registry statuses")
        if bool(row.get("full_predicate_set_ratified")) != (ratified_count == len(scanned)):
            blocker(f"{cid}: full_predicate_set_ratified is inconsistent")
    if set(coverage_by_cq) != {
        "CQ-" + path.stem.split("-")[1] for path in cq_paths
    }:
        blocker("PREDICATES coverage rows are not a bijection with CQ files")

    # Collision-qualified priority members and reserved bare publish.
    abox_graph = parsed_graphs["graphs/abox.ttl"]
    ci = lambda local: URIRef(CI_NS + local)
    if (ci("publish"), RDF.type, ci("AdmissionWorkKind")) not in abox_graph:
        blocker("IRI law: bare ciops:publish is not the AdmissionWorkKind member")
    if (ci("publish"), RDF.type, ci("AdmissionPriorityClass")) in abox_graph:
        blocker("IRI law: bare ciops:publish was reused as an AdmissionPriorityClass member")
    for local in ("AdmissionPriority-publish", "AdmissionPriority-verify"):
        if (ci(local), RDF.type, ci("AdmissionPriorityClass")) not in abox_graph:
            blocker(f"IRI law: qualified priority member ciops:{local} is missing")
    bare_verify = ci("verify")
    if any(bare_verify in triple for triple in abox_graph):
        blocker("IRI law: bare ciops:verify appears in the ratified A-Box")

    # Drift must be empty or carry an explicit steward ruling reference.
    drift = policy.get("drift") or []
    for row in drift:
        if not row.get("ruling_ref"):
            blocker(
                f"policy drift {row.get('subject')}.{row.get('predicate')} has no steward ruling_ref"
            )

    # Manifest leg metadata is mechanical: no per-CQ golden allowlist exists.
    legs = cq_manifest.get("legs") or {}
    seed_leg = legs.get("seed") or {}
    golden_leg = legs.get("golden") or {}
    if seed_leg.get("graphs") != ["tests/fixtures/seed.ttl"] or seed_leg.get("selection") != "all-manifest-tests":
        blocker("CQ manifest seed leg is not the unchanged all-tests seed store")
    if golden_leg.get("graphs") != [
        "extraction/s6/graphs/abox.ttl",
        "extraction/s6/graphs/snapshot-*.ttl",
    ]:
        blocker("CQ manifest golden graph list must be abox.ttl + snapshot-*.ttl")
    if set(golden_leg.get("excludes") or []) != {
        "extraction/s6/graphs/census.ttl",
        "tests/fixtures/seed.ttl",
    }:
        blocker("CQ manifest golden exclusions must be census.ttl and seed.ttl")
    if golden_leg.get("coverage") != "extraction/s6/PREDICATES.yaml#coverage":
        blocker("CQ manifest golden coverage pointer is invalid")
    if golden_leg.get("selection") != "full-predicate-set-ratified-and-non-vacuity-antecedent":
        blocker("CQ manifest golden selection rule is invalid")
    manifest_cqs = {row.get("cq") for row in cq_manifest.get("tests") or []}
    if manifest_cqs != set(coverage_by_cq):
        blocker("CQ manifest tests and PREDICATES coverage rows are not a bijection")

    # A closure declaration is required for a negated predicate only when the
    # CQ is status-covered and its non-vacuity ASK is true in the golden store.
    golden_graph = Graph()
    golden_graph += parsed_graphs["graphs/abox.ttl"]
    golden_graph += parsed_graphs["graphs/snapshot-<instant>.ttl"]
    antecedents = {
        "CQ-009": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
            ASK { ?g a ciops:SeatGrant ; ciops:hasGrantState ciops:ActiveGrant ;
                     ciops:hasOriginKey ?o . FILTER(?o != \"\") }""",
        "CQ-010": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
            ASK { ?wu ciops:admittedBy ?g .
                  ?g ciops:admissionChargeTokens ?ch ; ciops:capacityAtAdmissionTokens ?cap . }""",
        "CQ-019": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
            ASK { ?c a ciops:AffectedComputation ; ciops:hasAffectedOutcome ?o .
                  ?o a ciops:FailOpenOutcome .
                  VALUES ?stype { ciops:VerificationEvidence ciops:ScheduleProposal }
                  ?s a ?stype ; ciops:hasScope ?scope . FILTER (?scope != ciops:FullRepoScope) }""",
        "CQ-023": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
            ASK { ?r a ciops:SeatRequest ; ciops:observedQueueWaitMs ?w ; ciops:governedBy ?p .
                  ?p ciops:starvationBoundMs ?b . }""",
        "CQ-026": """PREFIX ciops: <https://oip.law/ontology/ci-ops#>
            ASK { ?g ciops:usedCostEstimate ?ce . ?ce ciops:p95Ms ?p .
                  ?g ciops:hasBudget ?b . ?b ciops:softP95BudgetMs ?m . }""",
    }
    declared_closed = {
        row.get("predicate")
        for row in snapshot_manifest.get("completeForPredicate") or []
        if row.get("world") == "closed"
    }
    active_golden = []
    for cid, row in coverage_by_cq.items():
        if not row.get("full_predicate_set_ratified"):
            continue
        antecedent = antecedents.get(cid)
        if antecedent is None or not bool(golden_graph.query(antecedent)):
            continue
        active_golden.append(cid)
        query_text = (TESTS / f"cq-{cid.split('-')[1]}.sparql").read_text()
        negated = set()
        for body in re.findall(r"(?is)FILTER\s+NOT\s+EXISTS\s*\{([^{}]*)\}", query_text):
            negated.update(
                predicate.removeprefix("ciops:")
                for predicate in scan_cq(body)
                if predicate.startswith("ciops:")
            )
        for predicate in sorted(negated - declared_closed):
            blocker(f"{cid}: golden negation predicate {predicate} lacks snapshot closure declaration")

    # Null refs are staged warnings.  Projection residue becomes blocking only
    # after every individual/generator ratification reference is filled.
    ratifications = [("policy", (abox_doc.get("policy") or {}).get("ratification"))]
    for enumeration in abox_doc.get("enumerations") or []:
        for member in enumeration.get("members") or []:
            ratifications.append((member.get("individual"), member.get("ratification")))
    ratifications.extend(
        [
            ("census", (abox_doc.get("census") or {}).get("ratification")),
            ("snapshot", (abox_doc.get("snapshot") or {}).get("ratification")),
        ]
    )
    pending_refs = []
    for label, ratification in ratifications:
        if not isinstance(ratification, dict) or ratification.get("mode") not in {"sitting", "generator-digest"}:
            blocker(f"ABOX individual/artifact {label}: invalid ratification record")
            continue
        if ratification.get("ref") is None:
            pending_refs.append(label)
    all_refs_filled = not pending_refs and bool(ratifications)
    if pending_refs:
        warn(f"pending steward sitting: {len(pending_refs)} ABOX ratification refs are null")

    # Generator-digest ratifications are ratifications OF BYTES: the digests the
    # steward ratified must match the artifacts on disk right now (PR #919 review).
    import hashlib as _hashlib

    def _sha12(path):
        return _hashlib.sha256(path.read_bytes()).hexdigest()[:12]

    census_rec = abox_doc.get("census") or {}
    snapshot_rec_early = abox_doc.get("snapshot") or {}
    # The digest FIELDS are mandatory — an ABOX record without them would skip
    # byte binding entirely (PR #919 review).
    for rec, field in (
        (census_rec, "sha256_12"),
        (snapshot_rec_early, "manifest_sha256_12"),
        (snapshot_rec_early, "redacted_sha256_12"),
    ):
        if not rec.get(field):
            blocker(f"ABOX.yaml generator-digest record omits required digest field {field}")
    census_file = S6 / "CENSUS.yaml"
    census_doc = yaml.safe_load(census_file.read_text()) if census_file.is_file() else {}
    census_ttl = S6 / "graphs/census.ttl"
    if not census_doc.get("graph_sha256_12"):
        blocker("CENSUS.yaml carries no census graph digest (graph_sha256_12)")
    elif not census_ttl.is_file():
        blocker("graphs/census.ttl is missing while CENSUS.yaml records its digest")
    elif _sha12(census_ttl) != census_doc["graph_sha256_12"]:
        blocker(
            f"graphs/census.ttl bytes ({_sha12(census_ttl)}) do not match the recorded "
            f"digest {census_doc['graph_sha256_12']} in CENSUS.yaml"
        )
    if census_rec.get("sha256_12") and not census_file.is_file():
        blocker("CENSUS.yaml is missing while ABOX.yaml records its ratified digest")
    if census_file.is_file() and census_rec.get("sha256_12"):
        if _sha12(census_file) != census_rec["sha256_12"]:
            blocker(
                f"CENSUS.yaml bytes ({_sha12(census_file)}) do not match the ratified "
                f"digest {census_rec['sha256_12']} in ABOX.yaml"
            )
    snapshot_rec = abox_doc.get("snapshot") or {}
    manifest_file = S6 / "snapshot/raw/MANIFEST.yaml"
    raw_file = S6 / "snapshot/raw/journal.ndjson"
    if snapshot_rec.get("manifest_sha256_12") and not manifest_file.is_file():
        blocker("snapshot MANIFEST.yaml is missing while ABOX.yaml records its ratified digest")
    if manifest_file.is_file() and snapshot_rec.get("manifest_sha256_12"):
        if _sha12(manifest_file) != snapshot_rec["manifest_sha256_12"]:
            blocker(
                f"snapshot MANIFEST.yaml bytes ({_sha12(manifest_file)}) do not match the "
                f"ratified digest {snapshot_rec['manifest_sha256_12']} in ABOX.yaml"
            )
    if snapshot_rec.get("redacted_sha256_12") and not raw_file.is_file():
        blocker("redacted journal is missing while ABOX.yaml records its ratified digest")
    if raw_file.is_file() and snapshot_rec.get("redacted_sha256_12"):
        if _sha12(raw_file) != snapshot_rec["redacted_sha256_12"]:
            blocker(
                f"redacted journal bytes ({_sha12(raw_file)}) do not match the ratified "
                f"digest {snapshot_rec['redacted_sha256_12']} in ABOX.yaml"
            )
    # The emitted graphs are digest-bound too: a hand-edited or stale graph with
    # valid shapes must still fail the gate (PR #919 review).
    graphs_rec = abox_doc.get("graphs") or {}
    abox_ttl = S6 / "graphs/abox.ttl"
    if not graphs_rec.get("abox_sha256_12"):
        blocker("ABOX.yaml carries no abox graph digest (graphs.abox_sha256_12)")
    elif not abox_ttl.is_file():
        blocker("graphs/abox.ttl is missing while ABOX.yaml records its digest")
    elif _sha12(abox_ttl) != graphs_rec["abox_sha256_12"]:
        blocker(
            f"graphs/abox.ttl bytes ({_sha12(abox_ttl)}) do not match the recorded "
            f"digest {graphs_rec['abox_sha256_12']} in ABOX.yaml"
        )
    manifest_doc = yaml.safe_load(manifest_file.read_text()) if manifest_file.is_file() else {}
    for name_key, sha_key in (("graph", "graph_sha256_12"), ("manifest_graph", "manifest_graph_sha256_12")):
        rel = manifest_doc.get(name_key)
        recorded = manifest_doc.get(sha_key)
        if not recorded:
            blocker(f"snapshot MANIFEST carries no {sha_key} digest")
            continue
        gpath = S6 / rel if rel else None
        # A missing referenced graph is a blocker in its own right — skipping the
        # comparison would accept a stale differently-named graph on disk
        # (PR #919 review).
        if gpath is None or not gpath.is_file():
            blocker(f"snapshot MANIFEST references missing graph {rel!r}")
        elif _sha12(gpath) != recorded:
            blocker(
                f"{rel} bytes ({_sha12(gpath)}) do not match the recorded digest {recorded} "
                f"in the snapshot MANIFEST"
            )
    # Exactly the referenced timestamped graphs may exist — a stray snapshot or
    # manifest graph is unverified evidence.
    referenced = {manifest_doc.get("graph"), manifest_doc.get("manifest_graph")}
    for stray in sorted(GRAPHS.glob("snapshot-*.ttl")) + sorted(GRAPHS.glob("manifest-*.ttl")):
        if f"graphs/{stray.name}" not in referenced:
            blocker(f"stray unreferenced graph on disk: graphs/{stray.name}")
    if all_refs_filled:
        # The historical S5 ruling stays deferred-s6 forever; discharge is the
        # s6_ratification_ref recorded beside it by apply_s6_dispositions.
        deferred_dispositions = [
            f"candidate:{row.get('seq')}"
            for row in dispositions.get("candidates") or []
            if row.get("ruling") == "deferred-s6" and not row.get("s6_ratification_ref")
        ] + [
            f"fact:{row.get('predicate')}"
            for row in dispositions.get("fact_classes") or []
            if row.get("ruling") == "deferred-s6" and not row.get("s6_ratification_ref")
        ]
        s4_candidates = yaml.safe_load((S4D / "CANDIDATES.yaml").read_text())
        s4_facts = yaml.safe_load((S4D / "FACTS.yaml").read_text())
        deferred_projected = [
            f"S4-candidate:{index}"
            for index, row in enumerate(s4_candidates)
            if row.get("status") == "deferred-s6"
        ] + [
            f"S4-fact:{index}"
            for index, row in enumerate(s4_facts)
            if row.get("status") == "deferred-s6"
        ]
        if deferred_dispositions or deferred_projected:
            blocker(
                "all ratification refs are filled but deferred-s6 residue remains: "
                + ", ".join((deferred_dispositions + deferred_projected)[:20])
            )

    # Invoke the SHACL runner.  A current interpreter with pyshacl is preferred;
    # otherwise use the contract command and downgrade only dependency/offline
    # acquisition failures to WARN.
    shacl_script = S6 / "scripts/run_shacl.py"
    shacl_env = None
    if importlib.util.find_spec("pyshacl") is not None:
        shacl_cmd = [sys.executable, str(shacl_script)]
    else:
        user_uv = Path.home() / ".local/bin/uv"
        uv_executable = str(user_uv) if user_uv.is_file() else (shutil.which("uv") or "uv")
        shacl_cmd = [uv_executable, "run", "--with", "pyshacl,rdflib", "python", str(shacl_script)]
        # `validate_packet.py --s6` itself commonly runs under `uv run`.  Clear
        # uv's recursion/temporary-venv markers so the nested contract command
        # resolves from the stable cache instead of the outer ephemeral overlay.
        shacl_env = os.environ.copy()
        shacl_env.pop("UV_RUN_RECURSION_DEPTH", None)
        shacl_env.pop("VIRTUAL_ENV", None)
    shacl_run = subprocess.run(
        shacl_cmd,
        cwd=PACKET,
        capture_output=True,
        text=True,
        env=shacl_env,
    )
    if shacl_run.returncode == 0:
        for line in shacl_run.stdout.splitlines():
            print(f"SHACL: {line}")
    else:
        diagnostic = (shacl_run.stderr + "\n" + shacl_run.stdout).strip()
        unavailable_markers = (
            "No solution found",
            "Failed to download",
            "Network connectivity is disabled",
            "Could not acquire lock",
            "No module named 'pyshacl'",
        )
        if any(marker in diagnostic for marker in unavailable_markers):
            # SHACL conformance is a contract blocker (s6-abox-contract SS4); an
            # environment that cannot run it cannot certify the stage (PR #919
            # review: skip-with-warn was fail-open).
            blocker("SHACL could not run (pyshacl unavailable) — the S6 gate fails closed; run with network or preinstalled pyshacl")
        else:
            tail = diagnostic.splitlines()[-1] if diagnostic else f"exit {shacl_run.returncode}"
            blocker(f"SHACL runner failed: {tail}")

    print(
        f"S6: {len(predicate_rows)} predicates / {len(coverage_rows)} CQ coverage rows / "
        f"{len(active_golden)} active golden legs / {len(drift)} drift rows / "
        f"{len(pending_refs)} pending refs"
    )
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
    # Ratifications resolve from the live governance dir AND the archived
    # per-run governance dirs: auditor run 2 relocated run-1's rat-001..031
    # to extraction/s4/archives/ (the v13 scanner has no archive exemption;
    # see the relocation notes in the run-1 rotation README), so the S5
    # joins bound to those records must follow the relocation.
    rats = {f.stem for f in (BC / "governance/ratifications").glob("rat-*.yaml")}
    rats |= {
        f.stem
        for f in (S4D / "archives").glob("*/orun-*.governance/ratifications/rat-*.yaml")
    }
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
        # never from what the seats submitted (PR #905 review). The proposals
        # S5 consumed are RUN 1's survivors, which auditor run 2 relocated to
        # extraction/s4/archives/ — the live work/proposals dir belongs to
        # later runs and must not leak into the S5-era derivation (this gate
        # already pins run 1's index above for the same reason).
        required = set()
        s5_proposals = S4D / "archives/beep-ci-ops/orun-2026-08-29T08:20:55Z.work/proposals"
        for f in sorted(s5_proposals.glob("otp-*.yaml")):
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
