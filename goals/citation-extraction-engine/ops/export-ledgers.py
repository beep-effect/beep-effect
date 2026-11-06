#!/usr/bin/env python3
"""Project pinned source and independent observations into auditable parity ledgers.

This producer never manufactures target proof or terminal workflow states.
It retains references to the byte-preserving evidence rather than copying it.
"""
import argparse
import ast
import hashlib
import json
from pathlib import Path
import subprocess

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
VERSION = "citation-ledger-projection/v1"
LICENSE = {"id": "BSD-2-Clause", "material": "source-adaptation-and-test-observations",
           "notice": "THIRD_PARTY_NOTICES.md",
           "sha256": "db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"}


def sha(value):
    return hashlib.sha256(value).hexdigest()


def canonical(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def family(row):
    """Seed family ownership is explicit; every source gets its own capability row."""
    module, symbol = row["path"], row["symbol"]
    if module == "eyecite/__init__.py":
        return {"clean_text": "C-001", "get_citations": "C-003", "resolve_citations": "C-016",
                "annotate_citations": "C-019"}[symbol]
    if module == "eyecite/clean.py": return "C-002"
    if module == "eyecite/tokenizers.py": return "C-004"
    if module == "eyecite/regexes.py": return "C-020"
    if module == "eyecite/annotate.py": return "C-017" if symbol.startswith("SpanUpdater") else "C-018"
    if module == "eyecite/resolve.py": return "C-014" if symbol == "resolve_full_citation" else "C-015"
    if module == "eyecite/find.py": return "C-011" if "reference" in symbol else "C-010"
    if module == "eyecite/helpers.py":
        return "C-013" if symbol in ("disambiguate_reporters", "overlapping_citations", "filter_citations") else "C-012"
    if module == "eyecite/utils.py": return "C-021"
    if module == "eyecite/test_factories.py": return "C-023"
    if module == "eyecite/models.py":
        owner = symbol.split(".")[0]
        if owner in ("Reporter", "Edition"): return "C-005"
        if owner in ("Token", "CitationToken", "SectionToken", "SupraToken", "IdToken", "ParagraphToken",
                     "StopWordToken", "PlaceholderCitationToken", "CaseReferenceToken", "TokenExtractor", "Document"): return "C-009"
        if owner == "Resource" or symbol.endswith((".__eq__", ".__hash__", ".corrected_citation", ".corrected_citation_full",
                                                 ".full_span", ".span", ".span_with_pincite", ".matched_text")): return "C-008"
        if owner in ("SupraCitation", "IdCitation", "ReferenceCitation", "UnknownCitation", "ShortCaseCitation"): return "C-007"
        return "C-006"
    raise RuntimeError(f"unclassified capability source: {module}:{symbol}")


def regex_sources(root):
    rows = []
    for path in sorted((root / "eyecite").glob("*.py")):
        relative, text = path.relative_to(root).as_posix(), path.read_text()
        content_hash, tree = sha(path.read_bytes()), ast.parse(text)
        modules = {alias.asname or alias.name for node in ast.walk(tree) if isinstance(node, ast.Import)
                   for alias in node.names if alias.name in ("re", "regex", "hyperscan")}

        class Walk(ast.NodeVisitor):
            def __init__(self): self.scope = []
            def emit(self, node, form, symbol, pattern=None):
                row = {"id": f"{relative}:{node.lineno}:{node.col_offset}:regexFamily:{form}",
                       "kind": "regexFamily", "path": relative, "line": node.lineno,
                       "column": node.col_offset, "symbol": symbol, "sourceSha256": content_hash,
                       "form": form, "expression": ast.get_source_segment(text, node)}
                if pattern is not None: row["patternExpression"] = ast.get_source_segment(text, pattern)
                rows.append(row)
            def visit_ClassDef(self, node):
                self.scope.append(node.name); self.generic_visit(node); self.scope.pop()
            def visit_FunctionDef(self, node):
                self.scope.append(node.name)
                if relative == "eyecite/regexes.py" or (relative == "eyecite/tokenizers.py" and
                    (self.scope[0] == "_populate_reporter_extractors" or node.name == "convert_regex")):
                    self.emit(node, "builder", ".".join(self.scope))
                self.generic_visit(node); self.scope.pop()
            def visit_Assign(self, node):
                if relative == "eyecite/regexes.py":
                    for target in node.targets:
                        if isinstance(target, ast.Name): self.emit(node, "declaration", target.id, node.value)
                self.generic_visit(node)
            def visit_Call(self, node):
                callee = node.func
                if isinstance(callee, ast.Attribute) and isinstance(callee.value, ast.Name) and callee.value.id in modules:
                    form = "escape" if callee.attr == "escape" else "module-call"
                    self.emit(node, form, ".".join([*self.scope, callee.value.id, callee.attr]), node.args[0] if node.args else None)
                elif isinstance(callee, ast.Attribute) and callee.attr in ("finditer", "match", "sub", "compile", "scan"):
                    # Compiled-pattern and native-accelerator method sites remain
                    # visible even when their receiver is not a module alias.
                    self.emit(node, "method-call", ".".join([*self.scope, ast.unparse(callee)]))
                if isinstance(callee, ast.Name) and callee.id == "TokenExtractor":
                    regex = next((kw.value for kw in node.keywords if kw.arg == "regex"), node.args[0] if node.args else None)
                    if regex is not None: self.emit(node, "extractor-constructor", ".".join([*self.scope, "TokenExtractor"]), regex)
                self.generic_visit(node)
        Walk().visit(tree)
    if len({row["id"] for row in rows}) != len(rows): raise RuntimeError("regex family ID collision")
    return sorted(rows, key=lambda row: row["id"])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--output-root", type=Path, required=True)
    args = parser.parse_args()
    root, output = args.oracle_root.resolve(), args.output_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle pin/tree/cleanliness mismatch")
    repo = Path(__file__).resolve().parents[3]
    paths = {"discovery": repo / "goals/citation-extraction-engine/history/evidence/oracle-discovery.json",
             "assertions": repo / "packages/law-practice/use-cases/test/fixtures/eyecite/assertion-cases.json",
             "operations": repo / "packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json"}
    inputs = {key: json.loads(path.read_text()) for key, path in paths.items()}
    discovery, assertions, operations = (inputs[key] for key in ("discovery", "assertions", "operations"))
    for value in inputs.values():
        if value["commit"] != PIN or value["tree"] != TREE: raise RuntimeError("evidence pin mismatch")
    for file in discovery["sourceFiles"]:
        if sha((root / file["path"]).read_bytes()) != file["sha256"]: raise RuntimeError("pinned source hash mismatch")
    if [{key: row[key] for key in ("id", "test", "declarationId", "ordinal", "assertion")} for row in assertions["events"]] != discovery["runtime"]["assertionEvents"]:
        raise RuntimeError("independent event streams differ")
    provenance = {"repository": "https://github.com/freelawproject/eyecite", "commit": PIN, "tree": TREE, "license": LICENSE}
    common = {"generatorVersion": VERSION, "generatorSha256": sha(Path(__file__).read_bytes()),
              "source": provenance, "evidence": {key: {"path": path.relative_to(repo).as_posix(), "sha256": sha(path.read_bytes())}
                                                 for key, path in paths.items()}}
    source_rows, capabilities = [], []
    for row in discovery["sourceRows"]:
        if row["kind"] in ("publicOperation", "modelFamily", "helperFamily"):
            capability_id = "capability::" + row["id"]
            source_rows.append(row | {"capabilityId": capability_id})
            capabilities.append({"id": capability_id, "sourceRowId": row["id"], "familyId": family(row),
                                 "kind": "canonical", "disposition": "required", "workflowState": "audit",
                                 "rationale": "Source-defined observable behavior requires implementation or explicit equivalent subsumption proof.",
                                 "proof": None})
        elif row["kind"] in ("caseDeclaration", "fixture"):
            source_rows.append(row)
        elif row["kind"] not in ("testMethod", "regexCandidate"):
            raise RuntimeError("unclassified source row")
    regexes = regex_sources(root)
    source_rows.extend(regexes)
    source = common | {"schemaVersion": "citation-source-inventory/v1", "rows": source_rows,
                       "testMethods": [row for row in discovery["sourceRows"] if row["kind"] == "testMethod"],
                       "parameterSources": assertions["source"],
                       "declarationExpansions": [{"declarationId": row["id"], "eventIds": [event["id"] for event in assertions["events"]
                                                   if event["declarationId"] == row["id"]]}
                                                 for row in source_rows if row["kind"] == "caseDeclaration"]}
    iterations = {row["id"]: row for row in assertions["iterations"]}
    cases = []
    for row in assertions["events"]:
        if sha(row["payload"].encode()) != row["normalizedSha256"]: raise RuntimeError("assertion payload hash mismatch")
        payload = json.loads(row["payload"])
        iteration_ids = list(dict.fromkeys(item for frame in payload["context"]["frames"] for item in frame["iterationIds"]))
        literal_refs = [{"parameterId": iterations[item]["literalParameterId"], "itemOrdinal": iterations[item]["indexWithinParent"]}
                        for item in iteration_ids if "literalParameterId" in iterations[item]]
        cases.append({"id": row["id"], "kind": "canonical", "disposition": "required", "workflowState": "audit",
                      "declarationId": row["declarationId"], "test": row["test"], "ordinal": row["ordinal"],
                      "assertion": row["assertion"], "observation": {"file": "assertion-cases.json", "id": row["id"],
                                                                        "normalizedSha256": row["normalizedSha256"]},
                      "inputProjection": "payload.context.values; payload.operands; payload.keywordArguments",
                      "expectedProjection": "payload.relation; payload.passed",
                      "iterationIds": iteration_ids, "literalItems": literal_refs,
                      "targetTest": None, "proof": None})
    fixture_rows = [row | {"license": LICENSE, "repository": provenance["repository"], "commit": PIN,
                          "bytes": (root / row["path"]).stat().st_size} for row in source_rows if row["kind"] == "fixture"]
    canonical_cases = common | {"schemaVersion": "citation-canonical-cases/v1", "capabilities": capabilities,
                               "cases": cases, "fixtures": fixture_rows,
                               "operationObservations": [{"id": row["id"], "sourceSiteId": row["sourceSiteId"],
                                                          "operation": row["operation"], "test": row["test"],
                                                          "normalizedSha256": row["normalizedSha256"]} for row in operations["cases"]]}
    patterns = []
    for artifact_hash, artifact in sorted(operations["artifacts"].items()):
        if artifact["kind"] != "tokenizer-extractors": continue
        if sha(artifact["payload"].encode()) != artifact_hash: raise RuntimeError("tokenizer artifact hash mismatch")
        for index, extractor in enumerate(json.loads(artifact["payload"])):
            fields = extractor["fields"]
            patterns.append({"id": f"{artifact_hash}::{index}", "artifactSha256": artifact_hash, "index": index,
                             "patternSha256": sha(fields["regex"].encode()), "flags": fields["flags"],
                             "constructor": fields["constructor"]["callable"], "workflowState": "audit", "proof": None})
    regex_report = common | {"schemaVersion": "citation-regex-inventory/v1",
                             "families": [{"id": row["id"], "form": row["form"], "workflowState": "audit", "proof": None}
                                          for row in regexes], "extractorInstances": patterns,
                             "scope": "Source families and expanded tokenizer instances; no JavaScript regex safety proof yet."}
    output.mkdir(parents=True, exist_ok=True)
    for name, value in [("source-inventory.json", source), ("canonical-cases.json", canonical_cases), ("regex-inventory.json", regex_report)]:
        # One record per line keeps expanded pattern/case evidence reviewable.
        arrays = {key: item for key, item in value.items() if isinstance(item, list)}
        head = {key: item for key, item in value.items() if key not in arrays}
        text = json.dumps(head, ensure_ascii=False, indent=2)[:-2]
        for key, items in arrays.items():
            text += ",\n  " + canonical(key) + ": [\n"
            text += ",\n".join("    " + canonical(item) for item in items)
            text += "\n  ]"
        output.joinpath(name).write_text(text + "\n}\n")
    print(f"source={len(source_rows)}; capabilities={len(capabilities)}; cases={len(cases)}; regexFamilies={len(regexes)}; extractorInstances={len(patterns)}")


if __name__ == "__main__":
    main()
