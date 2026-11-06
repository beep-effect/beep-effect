#!/usr/bin/env python3
"""Observe pinned regex V0 categories, verbose whitespace and ASCII folding."""
import argparse
import base64
import hashlib
import importlib.metadata
import importlib.util
import json
import re
from re import _parser
from pathlib import Path
import subprocess
import sys

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", required=True, type=Path)
    parser.add_argument("--data-output", required=True, type=Path)
    parser.add_argument("--cases-output", required=True, type=Path)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *xs: subprocess.check_output(["git", "-C", str(root), *xs], text=True).strip()
    assert (git("rev-parse", "HEAD"), git("rev-parse", "HEAD^{tree}"), git("status", "--porcelain")) == (PIN, TREE, "")
    assert sys.version_info[:3] == (3, 11, 15)
    import regex
    from regex import _regex_core as core
    assert importlib.metadata.version("regex") == "2023.12.25" and regex.DEFAULT_VERSION == regex.V0
    sha = lambda value: hashlib.sha256(value).hexdigest()
    source = Path(__file__).with_name("probe-regex-characters.py")
    spec = importlib.util.spec_from_file_location("classes", source)
    classes = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(classes)
    bodies, intervals, observations = {}, {}, {}
    for name, escape in (("digitClass", "d"), ("spaceClass", "s"), ("wordClass", "w")):
        compiled = regex.compile("\\" + escape, regex.V0)
        points = [point for point in range(0x110000) if compiled.fullmatch(chr(point))]
        body, ranges = classes.class_body(points)
        projected = regex.compile("[" + body + "]", regex.V0)
        assert all(bool(projected.fullmatch(chr(point))) == bool(compiled.fullmatch(chr(point))) for point in range(0x110000))
        bodies[name], intervals[name] = body, ranges
        observations[name] = {"points": len(points), "ranges": len(ranges)}
    verbose = []
    for point in range(0x110000):
        lexer = core.Source(chr(point) + "!")
        lexer.ignore_space = True
        result = lexer.get()
        if lexer.pos == 2 and result == "!":
            verbose.append(point)
    bodies["verboseSpaceClass"], intervals["verboseSpaceClass"] = classes.class_body(verbose)
    observations["verboseSpaceClass"] = {"points": len(verbose), "ranges": len(intervals["verboseSpaceClass"])}
    broad = regex.compile(r"[\x00-\x7f]", regex.I | regex.V0)
    candidates = [point for point in range(0x110000) if broad.fullmatch(chr(point))]
    folds = []
    for point in range(128):
        compiled = regex.compile(regex.escape(chr(point)), regex.I | regex.V0)
        folds.append([candidate for candidate in candidates if compiled.fullmatch(chr(candidate))])
    masks = bytearray()
    stride = (len(candidates) + 7) // 8
    for start in range(128):
        for end in range(start, 128):
            compiled = regex.compile(r"[\x%02x-\x%02x]" % (start, end), regex.I | regex.V0)
            union = set().union(*(folds[point] for point in range(start, end + 1)))
            mask = bytearray(stride)
            for offset, point in enumerate(candidates):
                actual = compiled.fullmatch(chr(point)) is not None
                assert actual == (point in union)
                if actual:
                    mask[offset // 8] |= 1 << (offset % 8)
            masks.extend(mask)
    data = {**bodies, "asciiIgnoreCaseJson": json.dumps(folds, separators=(",", ":"))}
    header = '''/** Generated regex 2023.12.25 V0 observations, not implementation source.
 * Producer: goals/citation-extraction-engine/ops/probe-regex-engine-characters.py.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as S from "effect/Schema";
const $I = $LawPracticeServerId.create("internal/Citation/RegexV0Data");
/** @internal @category models @since 0.0.0 */
export class CitationRegexV0Data extends S.Opaque<CitationRegexV0Data, { readonly brand: unique symbol }>()(
  S.Struct({ digitClass: S.String, spaceClass: S.String, wordClass: S.String, verboseSpaceClass: S.String,
    asciiIgnoreCaseJson: S.String.check(S.isMaxLength(4096))
  }).pipe($I.annoteSchema("CitationRegexV0Data", { description: "Frozen pinned regex V0 character and ASCII literal folding facts; no host Unicode dependency." }))
) {}
/** @internal @category data @since 0.0.0 */
export const citationRegexV0Data = CitationRegexV0Data.make(
'''
    args.data_output.write_text(header + json.dumps(data, ensure_ascii=True, sort_keys=True, indent=2) + "\n);\n")
    worker_cases = []
    def native(text):
        width = 1 if max(map(ord, text), default=0) <= 255 else 2 if max(map(ord, text), default=0) <= 65535 else 4
        return {"width": width, "bytes": b"".join(ord(c).to_bytes(width, "little") for c in text).hex()}
    for pattern, flags, text in [(r"\w+", 0, "\u0301"), (r"\s", 0, "\x1c"), ("i", 2, "\u0131"), ("I", 2, "\u0130"), (r"\d", 0, "\U00011f50")]:
        expected = {}
        for name, engine in (("python-re", re), ("python-regex-v0", regex)):
            match = engine.search(pattern, text, flags)
            expected[name] = [list(match.span())] if match else []
        worker_cases.append({"pattern": native(pattern), "source": native(text), "flags": flags, "patternSha256": sha(b"\x01" + pattern.encode()), "profile": {"groups": 0, "names": {}, "minimumWidthFloor": _parser.parse(pattern,flags).getwidth()[0], "repeatedCaptures": False, "nullableMultiRepeat": False}, "expected": expected})
    out = {"schemaVersion": "citation-regex-engine-characters/v1", "oracleCommit": PIN, "oracleTree": TREE, "python": "3.11.15", "regex": "2023.12.25", "engine": "python-regex-v0", "producerSha256": sha(Path(__file__).read_bytes()), "classProducerSha256": sha(source.read_bytes()), "coreSha256": sha(Path(core.__file__).read_bytes()), "intervals": intervals, "observations": observations, "candidates": candidates, "asciiRangeCount": 8256, "asciiRangeStride": stride, "asciiRangeMasks": base64.b64encode(masks).decode(), "workerCases": worker_cases}
    args.cases_output.write_text(json.dumps(out, sort_keys=True, indent=2) + "\n")
    print(json.dumps({"classes": observations, "asciiCandidates": len(candidates), "asciiRanges": 8256, "comparisons": 8256 * len(candidates)}))


if __name__ == "__main__":
    main()
