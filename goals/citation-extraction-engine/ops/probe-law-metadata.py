#!/usr/bin/env python3
"""Execute pinned add_law_metadata and retain field updates and regex routes."""
import argparse
import hashlib
import importlib.metadata
import json
from pathlib import Path
import subprocess
import sys
from unittest.mock import patch

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"
BINDINGS = "4b91de078a8cd6fedcd2c01fb98f3ef525497d207340265f4ff1318b5cea564d"


def native(text):
    if text is None:
        return None
    largest = max(map(ord, text), default=0)
    width = 1 if largest <= 255 else 2 if largest <= 65535 else 4
    return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--binding-corpus", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    sys.path.insert(0, str(root))
    from eyecite import helpers, models, regexes
    assert importlib.metadata.version("regex") == "2023.12.25"
    sha = lambda data: hashlib.sha256(data).hexdigest()
    captured = args.binding_corpus.read_bytes()
    assert sha(captured) == BINDINGS
    patterns = json.loads(captured)["patterns"]
    law, year = patterns[4], patterns[5]
    assert law["pattern"] == native(regexes.POST_LAW_CITATION_REGEX) and year["pattern"] == native(regexes.YEAR_REGEX)
    helpers._highest_valid_year = 2027
    tails = ["", " ", "unrelated", "(a)", "(a)(1)(xiii)", "(a) and (b)", "(a) et seq.",
             " (West 2020)", " (West Supp. 2020)", " (Consol. 2020)", " (January 2, 2020)", " (Jan. 2 2020)",
             " (1599)", " (1600)", " (2027)", " (2028)", " (1993-94)", " (٢٠٢٠)", " (\U00011f52\U00011f50\U00011f52\U00011f50)",
             " (West 2020) (note)", " (West 2020) (2021 note)", " (West 2020) (note) (other)",
             " (West 2020) ((nested) note)", " (West 2020) ()", " (West 2020) (é界\U0001f600)",
             " (West 2020) (\ud835\udfce)", " (West 2020) (" + "x" * 301 + ")"]
    vectors = [[("Text", t)] for t in tails]
    vectors += [[("Text", " (West "), ("Text", "2020)"), ("Text", " (note)")],
                [("ParagraphToken", "\n\n"), ("Text", " (West 2020)")], [("IdToken", "Id."), ("Text", " (2020)")],
                [("Token", None)], [("Text", "(a)"), ("ParagraphToken", "\n\n"), ("Text", " (2020)")]]
    rows = []
    search_original, match_original = helpers.re.search, helpers.re.match
    for vector_id, vector in enumerate(vectors):
        for prior_year in (None, 1998):
            for span_end in (5, 37):
                token = models.CitationToken("1 X 1", 0, 5, {"volume": "1", "reporter": "X", "page": "1"})
                words = [token] + [text if kind == "Text" else getattr(models, kind)(text, 0, 0) for kind, text in vector]
                citation = models.FullLawCitation(token, 0, span_end=span_end, full_span_end=777, year=prior_year,
                    metadata={"pin_cite": "SEED", "publisher": "SEED", "day": "SEED", "month": "SEED", "parenthetical": "SEED", "year": "SEED", "pin_cite_span_start": 11})
                calls = []
                def search(pattern, text, flags=0):
                    calls.append("law")
                    return search_original(pattern, text, flags=flags)
                def match(pattern, text, flags=0):
                    calls.append("parenthetical-year")
                    return match_original(pattern, text, flags=flags)
                with patch.object(helpers.re, "search", search), patch.object(helpers.re, "match", match):
                    assert helpers.add_law_metadata(citation, words) is None
                assert citation.metadata.pin_cite_span_start == 11 and calls.count("law") == 1
                values = {out: native(getattr(citation.metadata, name)) for out, name in (("pinCite", "pin_cite"), ("publisher", "publisher"),
                          ("day", "day"), ("month", "month"), ("parenthetical", "parenthetical"), ("year", "year"))}
                rows.append({"id": len(rows), "smoke": prior_year == 1998 and span_end == 37 and vector_id in (0, 4, 7, 12, 15, 19, 20, 21, 25, 28),
                    "request": {"words": [{"kind": "CitationToken", "data": native(token.data)}] + [{"kind": k, "data": native(t)} for k, t in vector],
                                "index": 0, "spanEnd": span_end, "year": prior_year},
                    "patch": {"fullSpanEnd": citation.full_span_end, "year": citation.year, "metadata": values}, "calls": calls})
    out = {"schemaVersion": "citation-law-metadata/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "regex": "2023.12.25",
           "producerSha256": sha(Path(__file__).read_bytes()), "helpersSha256": sha((root / "eyecite/helpers.py").read_bytes()), "bindingCorpusSha256": BINDINGS,
           "configuration": {"lawPattern": law["pattern"], "yearPattern": year["pattern"], "lawBindings": law["bindings"], "yearBindings": year["bindings"], "highestValidYear": 2027}, "cases": rows}
    args.output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"cases": len(rows), "calls": sum(len(r["calls"]) for r in rows), "smokeCases": sum(r["smoke"] for r in rows), "smokeCalls": sum(len(r["calls"]) for r in rows if r["smoke"])}))


if __name__ == "__main__":
    main()
