"""Query the runtime-verified emission v2 golden with amended CQ-020.

Run after the package tests (which compare this fixture with current emission):
  uv run --with pyoxigraph python apps/labs/ciops/scripts/check-emission-cq.py

Only provisional term spellings and the episode binding are adapted in memory.
The packet CQ, seed, registry, and frozen extraction artifacts stay read-only.
"""

import re
from pathlib import Path
from textwrap import dedent

from pyoxigraph import Literal, NamedNode, RdfFormat, Store

APP = Path(__file__).resolve().parents[1]
REPO = APP.parents[2]
CIOPS = "https://oip.law/ontology/ci-ops#"
PROV = "https://oip.law/ontology/ci-ops-prov#"
RDF_TYPE = NamedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type")
XSD_STRING = NamedNode("http://www.w3.org/2001/XMLSchema#string")

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
query = f"PREFIX ciops-prov: <{PROV}>\n{query}"

store = Store()
store.load((APP / "test/fixtures/emission-v2.ttl").read_bytes(), RdfFormat.TURTLE)


def objects(subject, namespace, predicate):
    return [
        quad.object
        for quad in store.quads_for_pattern(subject, NamedNode(namespace + predicate), None, None)
    ]


episodes = list(store.quads_for_pattern(None, RDF_TYPE, NamedNode(PROV + "VerificationEpisode"), None))
assert len(episodes) == 1, "Exactly one typed episode must anchor the projection"
episode = episodes[0].subject
query, bindings = re.subn(r"VALUES \?ep \{[^}]*\}", f"VALUES ?ep {{ {episode} }}", query)
assert bindings == 1, "Bind exactly the CQ's episode parameter"
rows = list(store.query(query))
assert len(rows) == 2, "CQ-020 must return the two admitted requests, excluding the tail"
assert [int(row["idx"].value) for row in rows] == [0, 1]
assert all(row[name] is not None for row in rows for name in ("proposal", "spec", "step", "idx", "req", "scope"))
assert all(row["scope"] == Literal("admission", datatype=XSD_STRING) for row in rows)
assert [objects(row["req"], PROV, "scheduledUnitRef") for row in rows] == [
    [Literal("admitted-a", datatype=XSD_STRING)],
    [Literal("admitted-b", datatype=XSD_STRING)],
]

proposal = rows[0]["proposal"]
specification = rows[0]["spec"]
assert objects(episode, PROV, "hasCurrentProposal") == [proposal]
assert objects(proposal, PROV, "hasProjectionSpecification") == [specification]
assert len(list(store.quads_for_pattern(None, RDF_TYPE, NamedNode(PROV + "AdmissionProjectionSpecification"), None))) == 1
assert objects(specification, PROV, "policyDigest") == [Literal("policy-digest", datatype=XSD_STRING)]
assert objects(specification, PROV, "journalPrefixDigest") == [Literal("journal-prefix-digest", datatype=XSD_STRING)]
tail = objects(proposal, PROV, "defersSeatRequest")
assert len(tail) == 1
assert objects(tail[0], PROV, "scheduledUnitRef") == [Literal("deferred-c", datatype=XSD_STRING)]
assert objects(tail[0], "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "type") == [NamedNode(CIOPS + "SeatRequest")]
assert not list(store.quads_for_pattern(None, NamedNode(PROV + "schedulesSeatRequest"), tail[0], None))
assert len(list(store.quads_for_pattern(None, NamedNode(PROV + "scheduledUnitRef"), None, None))) == 3
assert not list(store.quads_for_pattern(None, NamedNode(PROV + "hasScope"), None, None))

# A missing specification edge or type must prevent a superficially ordered
# graph from passing the amended query. Check both joins independently.
for subject, predicate, obj in (
    (proposal, NamedNode(PROV + "hasProjectionSpecification"), specification),
    (specification, RDF_TYPE, NamedNode(PROV + "AdmissionProjectionSpecification")),
):
    quad = next(store.quads_for_pattern(subject, predicate, obj, None))
    store.remove(quad)
    assert list(store.query(query)) == [], "Missing specification evidence must break the CQ join"
    store.add(quad)

print("PASS: amended CQ-020 on emission v2: 2 ordered admitted rows (0, 1), 1 step-less deferred request")
print("PASS: typed episode/specification, both digests, all 3 nonce literals, and 2 negative specification joins")
print("Namespace adaptation is provisional instrumentation, not vocabulary ratification.")
