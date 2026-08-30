"""run_shacl — validate S6 closure, typing, and graph parseability.

The closure data graph is graphs/abox.ttl plus exactly one snapshot graph and
its companion manifest graph.  The typing data graph is the ratified A-Box and
snapshot only; provisional manifest metadata and census.ttl are deliberately
excluded.  Census is parsed separately.  The runner also checks that
MANIFEST.yaml and the companion graph carry the exact same closure predicate
set.  Exits non-zero on any violation.

Run: uv run --with pyshacl,rdflib python run_shacl.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from pyshacl import validate
from rdflib import Graph, Namespace, RDF

S6 = Path(__file__).resolve().parents[1]
MANIFEST = Namespace("https://oip.law/ontology/ci-ops-s6-manifest#")


def exactly_one(pattern: str):
    """Resolve one generated graph path or fail with a stable diagnostic."""

    paths = sorted((S6 / "graphs").glob(pattern))
    if len(paths) != 1:
        raise SystemExit(f"expected exactly one graphs/{pattern}, found {[path.name for path in paths]}")
    return paths[0]


def main() -> None:
    abox = S6 / "graphs/abox.ttl"
    census = S6 / "graphs/census.ttl"
    snapshot = exactly_one("snapshot-*.ttl")
    manifest_graph = exactly_one("manifest-*.ttl")
    for path in (abox, census, snapshot, manifest_graph):
        if not path.is_file():
            raise SystemExit(f"missing graph: {path}")

    Graph().parse(census, format="turtle")
    print("PASS: census.ttl parses (provisional graph excluded from typing)")

    typing_data = Graph()
    for path in (abox, snapshot):
        typing_data.parse(path, format="turtle")
    closure_data = Graph()
    for path in (abox, snapshot, manifest_graph):
        closure_data.parse(path, format="turtle")

    manifest_text = (S6 / "snapshot/raw/MANIFEST.yaml").read_text()
    section_match = re.search(
        r"(?ms)^completeForPredicate:\s*\n(?P<body>.*?)(?=^vocabulary_gaps:)",
        manifest_text,
    )
    if not section_match:
        raise SystemExit("MANIFEST.yaml has no completeForPredicate section")
    yaml_predicates = re.findall(
        r"(?m)^- predicate:\s*([A-Za-z_][A-Za-z0-9_-]*)\s*$",
        section_match.group("body"),
    )
    graph_declarations = set(closure_data.subjects(RDF.type, MANIFEST.ClosureDeclaration))
    graph_predicates = {
        str(predicate).removeprefix("https://oip.law/ontology/ci-ops#")
        for declaration in graph_declarations
        for predicate in closure_data.objects(declaration, MANIFEST.completeForPredicate)
    }
    if len(yaml_predicates) != len(set(yaml_predicates)):
        raise SystemExit(f"MANIFEST.yaml repeats a closure predicate: {yaml_predicates}")
    if set(yaml_predicates) != graph_predicates or len(yaml_predicates) != len(graph_declarations):
        raise SystemExit(
            "closure declaration mismatch: "
            f"MANIFEST.yaml={sorted(yaml_predicates)}, graph={sorted(graph_predicates)}"
        )
    print(f"PASS: companion graph encodes all {len(yaml_predicates)} MANIFEST closure declarations")

    failed = False
    for shape_name in ("closure.ttl", "typing.ttl"):
        shapes = Graph().parse(S6 / "shapes" / shape_name, format="turtle")
        data = closure_data if shape_name == "closure.ttl" else typing_data
        conforms, _, report = validate(
            data_graph=data,
            shacl_graph=shapes,
            inference="none",
            abort_on_first=False,
            allow_infos=False,
            allow_warnings=False,
            advanced=True,
        )
        if conforms:
            print(f"PASS: {shape_name} conforms")
        else:
            failed = True
            print(f"FAIL: {shape_name} does not conform")
            print(report.rstrip())
    print(f"RESULT: {'FAIL' if failed else 'PASS'}")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
