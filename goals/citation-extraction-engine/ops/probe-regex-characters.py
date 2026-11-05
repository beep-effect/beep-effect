#!/usr/bin/env python3
"""Freeze observable CPython re character classes for the pinned tokenizer."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
import unicodedata

PIN = "04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"
TREE = "a35a58fac03400f71a93a93485b77f1d56f2b02f"


def sha(raw):
    return hashlib.sha256(raw).hexdigest()


def class_body(points):
    ranges = []
    for point in points:
        if ranges and ranges[-1][1] + 1 == point:
            ranges[-1][1] = point
        else:
            ranges.append([point, point])
    def literal(point):
        if point < 32 or point == 127 or chr(point) in "\\[]^-":
            return "\\x" + format(point, "02x")
        return chr(point)
    return "".join(literal(a) if a == b else literal(a) + "-" + literal(b) for a, b in ranges), ranges


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--oracle-root", type=Path, required=True)
    parser.add_argument("--data-output", type=Path, required=True)
    parser.add_argument("--cases-output", type=Path, required=True)
    args = parser.parse_args()
    root = args.oracle_root.resolve()
    git = lambda *values: subprocess.check_output(["git", "-C", str(root), *values], text=True).strip()
    if git("rev-parse", "HEAD") != PIN or git("rev-parse", "HEAD^{tree}") != TREE or git("status", "--porcelain"):
        raise SystemExit("oracle source pin mismatch")
    if sys.version_info[:3] != (3, 11, 15) or unicodedata.unidata_version != "14.0.0":
        raise SystemExit("Python/Unicode version mismatch")
    bodies = {}
    observations = {}
    intervals = {}
    for name, escape in (("digitClass", "d"), ("spaceClass", "s"), ("wordClass", "w")):
        source = re.compile("\\" + escape)
        points = [point for point in range(0x110000) if source.fullmatch(chr(point))]
        body, ranges = class_body(points)
        candidate = re.compile("[" + body + "]")
        if any(bool(candidate.fullmatch(chr(point))) != bool(source.fullmatch(chr(point))) for point in range(0x110000)):
            raise SystemExit("class projection mismatch")
        bodies[name] = body
        intervals[name] = ranges
        observations[name] = {"points": len(points), "ranges": len(ranges),
                              "utf16Units": len(body.encode("utf-16-le")) // 2, "sha256": sha(body.encode())}
    if [observations[name]["points"] for name in bodies] != [660, 29, 133548]:
        raise SystemExit("character counts drifted")
    ascii_letters = re.compile("[a-z]", re.I)
    insensitive = [point for point in range(0x110000) if ascii_letters.fullmatch(chr(point))]
    if len(insensitive) != 56 or [point for point in insensitive if point > 127] != [0x130, 0x131, 0x17f, 0x212a]:
        raise SystemExit("ASCII ignore-case class drifted")
    cases = []
    for pattern, flags, inputs in [
        (r"(?P<value>\d+\s+\w+)", 0, ["12 name", "١٢\x85café", "12\ufeffname", "12 e\u0301"]),
        (r"(?P<identifier>id.)$", 2, ["id.", "İD\r", "ıD\u2028", "ID\u2029", "id\n", "id.\n", "id.\r"]),
        (r"([^a-zA-Z0-9]+)", 2, ["ſKİı!", "\x85§", "a-b"]),
        (r"(?P<reporter>ch\[.,])", 0, ["ch[.,]", "ch[X,]", "ch[\r,]", "ch[\u2028,]", "ch[\n,]"]),
        (r"^(?P<value>x{,3})$", 0, ["", "x", "xxx", "xxxx", "xxx\n", "xxx\r"]),
        (r"(?P<maybe>a)?(b)", 0, ["b ab", "a", "bb"]),
    ]:
        compiled = re.compile(pattern, flags)
        for text in inputs:
            matches = [{"values": [match[group] for group in range(compiled.groups + 1)],
                        "spans": [list(match.span(group)) for group in range(compiled.groups + 1)],
                        "named": match.groupdict()} for match in compiled.finditer(text)]
            cases.append({"pattern": pattern, "flags": flags, "text": text, "matches": matches})
    header = '''/**
 * Generated observed CPython 3.11.15 re character classes (Unicode 14).
 * Producer: goals/citation-extraction-engine/ops/probe-regex-characters.py.
 * No Python implementation source is copied.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import * as S from "effect/Schema";
const $I = $LawPracticeServerId.create("internal/Citation/PythonRegexData");
/** @internal @category models @since 0.0.0 */
export class CitationPythonRegexData extends S.Opaque<CitationPythonRegexData, { readonly brand: unique symbol }>()(
  S.Struct({ unicodeVersion: S.tag("14.0.0"), digitClass: S.String, spaceClass: S.String, wordClass: S.String }).pipe(
    $I.annoteSchema("CitationPythonRegexData", { description: "Frozen exact class bodies observed from the pinned tokenizer's CPython re engine, independent of host Unicode properties." })
  )
) {}
/** @internal @category models @since 0.0.0 */
export const citationPythonRegexData = CitationPythonRegexData.make('''
    # S.tag supplies the discriminator default in .make.
    args.data_output.write_text(header + json.dumps(bodies, ensure_ascii=True, indent=2) + ");\n")
    report = {"schemaVersion": "citation-regex-character-facts/v1", "oracleCommit": PIN, "oracleTree": TREE,
              "pythonVersion": "3.11.15", "unicodeVersion": "14.0.0", "producerSha256": sha(Path(__file__).read_bytes()),
              "licenseSha256": sha((root / "LICENSE").read_bytes()), "lockSha256": sha((root / "uv.lock").read_bytes()),
              "sources": {name: sha((root / name).read_bytes()) for name in ("eyecite/models.py", "eyecite/tokenizers.py")},
              "classBodies": bodies, "intervals": intervals, "observations": observations, "asciiIgnoreCasePoints": insensitive,
              "cases": cases,
              "scope": "Exhaustive single-code-point CPython re class facts and ASCII ignore-case observations; not full pattern or family qualification."}
    args.cases_output.write_text(json.dumps(report, ensure_ascii=True, indent=2) + "\n")
    if git("status", "--porcelain"):
        raise SystemExit("oracle source changed")
    print(json.dumps(observations))


if __name__ == "__main__":
    main()
