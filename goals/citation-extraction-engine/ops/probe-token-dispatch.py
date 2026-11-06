#!/usr/bin/env python3
"""Observe actual get_citations dispatch and full-class selection in isolation."""
import argparse
import hashlib
import importlib.util
import itertools
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(value):
    return hashlib.sha256(value).hexdigest()


def native(text):
    if text is None:
        return None
    width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--oracle-root", required=True, type=Path)
    p.add_argument("--output", required=True, type=Path)
    args = p.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *v: subprocess.check_output(["git", "-C", str(root), *v], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import find, models
    spec = importlib.util.spec_from_file_location("operations", Path(__file__).with_name("export-operations.py"))
    operations = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(operations)
    normal, _ = operations.make_normalizer(root)
    reporters = [models.Reporter(f"Dispatch{i}", "Dispatch fixture", "state", source) for i, source in enumerate(("reporters", "laws", "journals", "other"))]
    editions = [models.Edition(reporter, reporter.short_name, None, None) for reporter in reporters]
    bindings = [{"id": i, "ref": normal(value)["artifactSha256"], "source": value.reporter.source} for i, value in enumerate(editions)]
    identities = {id(reporter): i for i, reporter in enumerate(reporters)}
    current = None
    lookups = []
    class Document:
        def __init__(self, **kwargs):
            self.words = [current]
            self.citation_tokens = [(0, current)]
        def tokenize(self, **kwargs):
            pass
    def source(reporter):
        lookups.append(identities[id(reporter)])
        return reporter.__dict__["source"]
    def short(document, index):
        token = document.words[index]
        return models.ShortCaseCitation(token, index, exact_editions=token.exact_editions, variation_editions=token.variation_editions)
    def direct(cls):
        return lambda words, index: cls(words[index], index)
    sequences = [list(items) for length in range(4) for items in itertools.product(range(4), repeat=length)]
    definitions = [("CitationToken", exact, variation, False) for exact in sequences for variation in sequences]
    definitions += [("CitationToken", items, list(reversed(items)), True) for items in sequences]
    definitions += [(name, [], [], False) for name in ("Token", "IdToken", "SupraToken", "SectionToken", "ParagraphToken", "StopWordToken", "PlaceholderCitationToken", "CaseReferenceToken")]
    cases = []
    # Only extraction context is stubbed. The original get_citations branch loop
    # and _extract_full_citation set/priority code execute without replacement.
    with patch.object(find, "Document", Document), patch.object(find, "extract_reference_citations", lambda *args: []), patch.object(find, "filter_citations", lambda values: values), patch.object(find, "_extract_shortform_citation", short), patch.object(find, "_extract_id_citation", direct(models.IdCitation)), patch.object(find, "_extract_supra_citation", direct(models.SupraCitation)), patch.object(models.FullCaseCitation, "add_metadata", lambda *args: None), patch.object(models.FullLawCitation, "add_metadata", lambda *args: None), patch.object(models.FullJournalCitation, "add_metadata", lambda *args: None), patch.object(models.Reporter, "source", property(source), create=True):
        for number, (name, exact, variation, is_short) in enumerate(definitions):
            kwargs = {"exact_editions": [editions[i] for i in exact], "variation_editions": [editions[i] for i in variation], "short": is_short} if name == "CitationToken" else {}
            current = getattr(models, name)("1 X 1", 0, 5, {"volume": "1", "reporter": "X", "page": "1"}, **kwargs)
            lookups = []
            try:
                result = find.get_citations("control")
                expected = type(result[0]).__name__ if result else "Skip"
                failure = None
            except ValueError:
                expected, failure = None, "unknown-source"
            template = {"data": native(current.data), "start": current.start, "end": current.end, "groups": {k: native(v) for k, v in current.groups.items()}}
            if cases:
                assert template == token_template
            token_template = template
            cases.append([name, exact, variation, is_short, expected, failure, lookups])
    out = {"schemaVersion": "citation-token-dispatch/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "producerSha256": sha(Path(__file__).read_bytes()), "normalizerSha256": sha(Path(__file__).with_name("export-operations.py").read_bytes()), "sources": {name: sha((root / "eyecite" / name).read_bytes()) for name in ("find.py", "models.py")}, "scope": "Actual source branch/full-class choice with metadata/reference/context/filter phases explicitly stubbed; not full extraction.", "bindings": bindings, "tokenTemplate": token_template, "columns": ["kind", "exact", "variation", "short", "expected", "failure", "lookups"], "cases": cases}
    encoded = lambda value: json.dumps(value, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    fields = []
    for name in sorted(out):
        value = out[name]
        rendered = "[\n" + ",\n".join("    " + encoded(row) for row in value) + "\n  ]" if name == "cases" else encoded(value)
        fields.append("  " + json.dumps(name) + ": " + rendered)
    args.output.write_text("{\n" + ",\n".join(fields) + "\n}\n")
    print(json.dumps({"cases": len(cases), "failures": sum(row[5] is not None for row in cases), "lookups": sum(len(row[6]) for row in cases)}))


if __name__ == "__main__":
    main()
