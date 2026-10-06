"""Query the admission golden and the lane-plan golden together (P2 Ruling 7).

Run after the package tests (which compare both fixtures with current emission):
  uv run --with pyoxigraph python apps/labs/ciops/scripts/check-lane-plan-cq.py

check-emission-cq.py stays the admission regression. This sibling loads
emission-v2.ttl and lane-plan-v1.ttl into one graph, requires the amended
CQ-020 admission rows unchanged, and runs the provisional lane-plan queries
of contract section 8.3. Counts come from the decoded handoff fixture, never
from a literal. The packet CQ, seed and frozen artifacts stay read-only.

Two self-tests run on every invocation and fail the script if a check stops
biting: forbidden IRIs planted in a foreign namespace (hash and slash forms, in
subject, predicate and object position) must trip the forbidden-term
assertion while look-alike decoys must not, and an admission row whose only
change is its ?spec column must trip the all-column CQ-020 comparison.
"""

import hashlib
import json
import re
from pathlib import Path
from textwrap import dedent

from pyoxigraph import Literal, NamedNode, Quad, RdfFormat, Store

APP = Path(__file__).resolve().parents[1]
REPO = APP.parents[2]
CIOPS = "https://oip.law/ontology/ci-ops#"
PROV = "https://oip.law/ontology/ci-ops-prov#"
RDF_TYPE = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
XSD_STRING = NamedNode("http://www.w3.org/2001/XMLSchema#string")
PREFIXES = f"PREFIX ciops: <{CIOPS}>\nPREFIX ciops-prov: <{PROV}>\n"

# Ratified ordering cluster and rejected names: none may touch a lane-plan node (contract section 8.3).
ORDERING_TERMS = (
    "hasCurrentProposal",
    "hasProjectionSpecification",
    "hasStep",
    "hasScopeTag",
    "stepIndex",
    "schedulesSeatRequest",
    "hasCurrentLanePlan",
    "scheduledLaneRef",
)
ORDERING_TYPES = ("ScheduleStep", "ScheduleProposal", "VerificationLane", "AdmissionProjectionSpecification")
NOWHERE_TERMS = ("schedulesWorkUnit", "hasScope", "Scope")
# Matched by local name, so a forbidden term is caught in any namespace, not only ciops: and ciops-prov:.
NOWHERE_LOCAL_NAME = re.compile(r"[#/](?:" + "|".join(NOWHERE_TERMS) + r")$")


def amended_cq020():
    cq_source = (
        REPO / "explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml"
    ).read_text()
    cq_section = cq_source.split("- id: CQ-020\n", 1)[1].split("\n- id:", 1)[0]
    sparql_block = re.search(r"^  sparql: \|\n((?:    .*\n)+)", cq_section, re.MULTILINE)
    assert sparql_block is not None, "CQ-020 must retain its explicit SPARQL block"
    query = dedent(sparql_block.group(1))
    for term in (
        "hasCurrentProposal",
        "hasProjectionSpecification",
        "AdmissionProjectionSpecification",
        "hasStep",
        "stepIndex",
        "schedulesSeatRequest",
        "hasScopeTag",
    ):
        query = re.sub(rf"\bciops:{term}\b", f"ciops-prov:{term}", query)
    return f"PREFIX ciops-prov: <{PROV}>\n{query}"


def bind_episode(query, episode):
    bound, bindings = re.subn(r"VALUES \?ep \{[^}]*\}", f"VALUES ?ep {{ {episode} }}", query)
    assert bindings == 1, "Bind exactly the CQ's episode parameter"
    return bound


def load_store(goldens):
    loaded = Store()
    for golden in goldens:
        loaded.load((APP / "test/fixtures" / golden).read_bytes(), RdfFormat.TURTLE)
    return loaded


store = load_store(("emission-v2.ttl", "lane-plan-v1.ttl"))
admission_store = load_store(("emission-v2.ttl",))

handoff_bytes = (APP / "test/fixtures/gate-order-handoff-v1.json").read_bytes()
handoff = json.loads(handoff_bytes)
ranked_lanes = [lane["laneId"] for lane in sorted(handoff["lanes"], key=lambda lane: lane["rank"])]
lane_count = len(ranked_lanes)
assert lane_count == len({lane["laneId"] for lane in handoff["lanes"]}), "Fixture lane ids must be unique"


def subjects_of_type(namespace, name):
    return [quad.subject for quad in store.quads_for_pattern(None, RDF_TYPE, NamedNode(namespace + name), None)]


def objects(subject, predicate, graph=store):
    return [quad.object for quad in graph.quads_for_pattern(subject, NamedNode(PROV + predicate), None, None)]


# 1. Amended CQ-020: the admission rows are unchanged, and the lane-plan episode answers nothing.
episodes = subjects_of_type(PROV, "VerificationEpisode")
assert len(episodes) == 2, "One admission episode and one lane-plan episode"
admission_episodes = [episode for episode in episodes if objects(episode, "hasCurrentProposal")]
lane_episodes = [episode for episode in episodes if objects(episode, "hasLanePlan")]
assert len(admission_episodes) == 1 and len(lane_episodes) == 1, "Each document anchors its own episode"
admission_episode, lane_episode = admission_episodes[0], lane_episodes[0]
assert admission_episode != lane_episode, "Lane-plan and admission episode nodes must be disjoint"
assert not objects(admission_episode, "hasLanePlan") and not objects(lane_episode, "hasCurrentProposal")

cq020 = amended_cq020()
rows = list(store.query(bind_episode(cq020, admission_episode)))
assert len(rows) == 2, "CQ-020 must return the two admitted requests, excluding the tail"
assert [int(row["idx"].value) for row in rows] == [0, 1]
assert all(row["scope"] == Literal("admission", datatype=XSD_STRING) for row in rows)
assert [objects(row["req"], "scheduledUnitRef") for row in rows] == [
    [Literal("admitted-a", datatype=XSD_STRING)],
    [Literal("admitted-b", datatype=XSD_STRING)],
]
assert list(store.query(bind_episode(cq020, lane_episode))) == [], "Lane steps are never CQ-020 rows"


def solution_rows(results):
    names = [variable.value for variable in results.variables]
    return [tuple(row[name] for name in names) for row in results]


def assert_admission_rows_equal(graph, reference, episode):
    """Compare every bound CQ-020 column of graph with the reference store's rows."""
    graph_rows = solution_rows(graph.query(bind_episode(cq020, episode)))
    reference_rows = solution_rows(reference.query(bind_episode(cq020, episode)))
    assert graph_rows == reference_rows, "CQ-020 admission rows must equal the admission-only store's"
    return graph_rows


# Every bound column, not only idx/scope/unitRef: adding the lane plan changes no admission row.
combined_rows = assert_admission_rows_equal(store, admission_store, admission_episode)

# 2. Provisional lane steps: one per fixture lane, in rank order, under a typed plan and specification.
step_rows = list(
    store.query(
        PREFIXES
        + f"""
        SELECT ?plan ?spec ?step ?idx ?lane WHERE {{
          {lane_episode} ciops-prov:hasLanePlan ?plan .
          ?plan a ciops-prov:LanePlan ; ciops-prov:hasLanePlanSpecification ?spec ; ciops-prov:hasLaneStep ?step .
          ?spec a ciops-prov:LanePlanSpecification .
          ?step a ciops-prov:LaneStep ; ciops-prov:laneStepIndex ?idx ; ciops-prov:laneIdRef ?lane .
        }} ORDER BY ?idx
        """
    )
)
assert len(step_rows) == lane_count, "Lane-step count must equal the fixture lane count"
assert [int(row["idx"].value) for row in step_rows] == list(range(lane_count))
assert [row["lane"].value for row in step_rows] == ranked_lanes, "Lane steps must follow the handoff rank order"
plan, specification = step_rows[0]["plan"], step_rows[0]["spec"]
assert {row["plan"] for row in step_rows} == {plan} and {row["spec"] for row in step_rows} == {specification}
handoff_sha256 = hashlib.sha256(handoff_bytes).hexdigest()
assert objects(specification, "handoffDigest") == [Literal(handoff_sha256, datatype=XSD_STRING)]
assert objects(specification, "laneOrderRule") == [Literal(handoff["orderRule"], datatype=XSD_STRING)]

# 3. The consecutive precedence chain: count - 1 edges, each from index i to i + 1, in rank order.
edges = list(
    store.query(
        PREFIXES
        + """
        SELECT ?i ?j ?from ?to WHERE {
          ?a ciops-prov:precedesLaneStep ?b .
          ?a ciops-prov:laneStepIndex ?i ; ciops-prov:laneIdRef ?from .
          ?b ciops-prov:laneStepIndex ?j ; ciops-prov:laneIdRef ?to .
        } ORDER BY ?i
        """
    )
)
assert len(edges) == lane_count - 1, "The precedence chain must carry count - 1 edges"
assert [(int(edge["i"].value), int(edge["j"].value)) for edge in edges] == [(i, i + 1) for i in range(lane_count - 1)]
assert [(edge["from"].value, edge["to"].value) for edge in edges] == list(zip(ranked_lanes, ranked_lanes[1:]))

# 4. No ratified ordering term or typing on any lane-plan node, in either namespace.
lane_nodes = {lane_episode, plan, specification} | {row["step"] for row in step_rows}
namespaces = (CIOPS, PROV)
for node in lane_nodes:
    for namespace in namespaces:
        for term in ORDERING_TERMS:
            predicate = NamedNode(namespace + term)
            assert not list(store.quads_for_pattern(node, predicate, None, None)), f"{node} carries {term}"
            assert not list(store.quads_for_pattern(None, predicate, node, None)), f"{node} is the object of {term}"
        for type_name in ORDERING_TYPES:
            ordering_type = NamedNode(namespace + type_name)
            assert not list(store.quads_for_pattern(node, RDF_TYPE, ordering_type, None)), f"{node} is typed {type_name}"
assert not [quad for quad in store.quads_for_pattern(None, None, None, None) if quad.predicate.value.startswith(CIOPS) and quad.subject in lane_nodes]

# 5. schedulesWorkUnit, hasScope and Scope appear nowhere, in any position or namespace.
def assert_no_forbidden_iris(graph):
    iris = {
        term.value
        for quad in graph.quads_for_pattern(None, None, None, None)
        for term in (quad.subject, quad.predicate, quad.object)
        if isinstance(term, NamedNode)
    }
    forbidden = sorted(iri for iri in iris if NOWHERE_LOCAL_NAME.search(iri))
    assert forbidden == [], f"Forbidden terms emitted: {forbidden}"


assert_no_forbidden_iris(store)


# 6. Self-tests: each check above must still reject a planted violation.
FOREIGN = "https://example.org/foreign"
FOREIGN_NODE = NamedNode(f"{FOREIGN}#lane")
# (planted quad, the one forbidden IRI it carries): hash and slash namespaces, every triple position.
FORBIDDEN_TRAPS = (
    (Quad(FOREIGN_NODE, NamedNode(f"{FOREIGN}#hasScope"), Literal("x")), f"{FOREIGN}#hasScope"),
    (Quad(FOREIGN_NODE, RDF_TYPE, NamedNode(f"{FOREIGN}/Scope")), f"{FOREIGN}/Scope"),
    (Quad(NamedNode(f"{FOREIGN}#schedulesWorkUnit"), RDF_TYPE, NamedNode(f"{FOREIGN}#Thing")), f"{FOREIGN}#schedulesWorkUnit"),
)
# Lookalike names that share a forbidden local name as a prefix or suffix; none may trip the check.
FORBIDDEN_DECOYS = (
    Quad(FOREIGN_NODE, NamedNode(f"{FOREIGN}#hasScopeTag"), Literal("x")),
    Quad(FOREIGN_NODE, RDF_TYPE, NamedNode(f"{FOREIGN}#LaneScope")),
    Quad(FOREIGN_NODE, NamedNode(f"{FOREIGN}/ScopeNote"), Literal("x")),
)


def copy_store(source, extra=()):
    probe = Store()
    probe.extend(source.quads_for_pattern(None, None, None, None))
    probe.extend(extra)
    return probe


def assertion_message(check, *args):
    try:
        check(*args)
    except AssertionError as error:
        return str(error)
    raise AssertionError(f"Self-test: {check.__name__} accepted a planted violation")


def self_test_forbidden_iris():
    assert_no_forbidden_iris(copy_store(store, FORBIDDEN_DECOYS))
    for trap, planted_iri in FORBIDDEN_TRAPS:
        message = assertion_message(assert_no_forbidden_iris, copy_store(store, (trap,)))
        assert message == f"Forbidden terms emitted: {[planted_iri]}", f"Self-test: {planted_iri} not reported alone"


def key_columns(graph, episode):
    rows = graph.query(bind_episode(cq020, episode))
    return [(row["idx"], row["scope"], objects(row["req"], "scheduledUnitRef", graph)) for row in rows]


def self_test_admission_columns():
    """Re-point the admission proposal at a renamed specification: only the ?spec column changes."""
    proposal = objects(admission_episode, "hasCurrentProposal")[0]
    spec_predicate = NamedNode(PROV + "hasProjectionSpecification")
    (spec_quad,) = store.quads_for_pattern(proposal, spec_predicate, None, None)
    renamed = NamedNode(spec_quad.object.value + "-self-test")
    spec_type = NamedNode(PROV + "AdmissionProjectionSpecification")
    probe = copy_store(store, (Quad(proposal, spec_predicate, renamed), Quad(renamed, RDF_TYPE, spec_type)))
    probe.remove(spec_quad)
    assert key_columns(probe, admission_episode) == key_columns(admission_store, admission_episode), (
        "Self-test: the renamed specification must leave idx, scope and unitRef unchanged"
    )
    message = assertion_message(assert_admission_rows_equal, probe, admission_store, admission_episode)
    assert message == "CQ-020 admission rows must equal the admission-only store's", f"Self-test: {message}"


self_test_forbidden_iris()
self_test_admission_columns()

print(
    f"PASS: amended CQ-020 admission rows unchanged (2 rows, idx 0, 1, all {len(combined_rows[0])} columns equal "
    f"to the admission-only store; lane episode 0 rows); "
    f"lane plan {lane_count} lane steps in rank order, {len(edges)} precedesLaneStep edges (count - 1), "
    f"0 ratified ordering terms on {len(lane_nodes)} lane-plan nodes, 0 schedulesWorkUnit/hasScope/Scope IRIs in any namespace; "
    f"self-tests: {len(FORBIDDEN_TRAPS)} planted foreign-namespace IRIs caught, {len(FORBIDDEN_DECOYS)} decoys passed, "
    f"a ?spec-only admission row change caught by the all-column CQ-020 comparison"
)
print("Lane-plan terms are provisional ciops-prov: instrumentation (contract section 8.3), not vocabulary ratification.")
