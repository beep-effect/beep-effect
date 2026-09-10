#!/usr/bin/env python3
"""Transcribe run-3 evidence from git show HEAD: without interpreting its wording.

Order: three archived ordering captures; each Turtle subject statement through
its terminating dot; each unique emission site named in the emission-v2 table;
then the run-2 heading-plus-first-block rule on the two declared Markdown files.
Repeated subjects in the Turtle fixture start new statements after each dot.
The report's rdf:type row overlaps the class rows; each source site emits once.

Archived quotes retain their exact wording and coordinates when possible. Drift
recovers the smallest containing window of at most forty lines, as in run 2.
An absent quote is reported and never replaced with rewritten text. The census
prints on both success and partial evidence; missing required evidence exits 1.

Usage: --repo . --out <directory> [--dry-run]. Dry-run never writes output.
Only Python's standard library and PyYAML (the run-2 precedent) are required.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

import yaml

PACKET = "explorations/beep-ci-operational-ontology"
ARCHIVE = f"{PACKET}/ontology/extraction/s4/archives/beep-ci-ops/orun-2026-09-03T02:46:18Z.observations/prose-observations"
ORDERING = ("po-736ad92a1de7", "po-35a69c5bcbf7", "po-d1f555913267")
TURTLE = "apps/labs/ciops/test/fixtures/emission-v2.ttl"
EMITTER = "apps/labs/ciops/src/projection/Turtle.ts"
TERM_REPORT = f"{PACKET}/research/run3-lanes/emission-v2-report.md"
PROSE = (f"{PACKET}/ontology/docs/s7-projection-contract.md",
         f"{PACKET}/research/s7-replay-evidence.md")
HEADING = re.compile(r"^[ ]{0,3}(#{1,6})[ \t]+\S")
FENCE = re.compile(r"^[ ]{0,3}(`{3,}|~{3,})")


def git(repo, *args):
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError("required Git query failed: " + " ".join(args))
    return result.stdout.decode("utf-8")


def norm(text):
    return re.sub(r"\s+", " ", text).strip()


def locate(lines, quote, start, end):
    """Run-2 recovery: preserve declared span, else shortest window then earliest."""
    wanted = norm(quote)
    if 1 <= start <= end <= len(lines) and wanted in norm("".join(lines[start - 1:end])):
        return start, end
    if wanted not in norm("".join(lines)):
        return None
    for width in range(1, 41):
        for offset in range(len(lines) - width + 1):
            if wanted in norm("".join(lines[offset:offset + width])):
                return offset + 1, offset + width
    return None


def section_spans(lines):
    """Run-2 ATX headings outside fences, through the first nonblank body block."""
    headings = []
    fence_character, fence_length = None, 0
    for index, line in enumerate(lines):
        fence = FENCE.match(line)
        if fence:
            marker = fence[1]
            if fence_character is None:
                fence_character, fence_length = marker[0], len(marker)
            elif marker[0] == fence_character and len(marker) >= fence_length:
                fence_character, fence_length = None, 0
            continue
        if fence_character is None and (heading := HEADING.match(line)):
            headings.append((index, len(heading[1])))
    indexes = {i for i, _ in headings}
    spans, empty = [], []
    for position, (index, rank) in enumerate(headings):
        end = next((i for i, r in headings[position + 1:] if r <= rank), len(lines))
        cursor = index + 1
        while cursor < end and (not lines[cursor].strip() or cursor in indexes):
            cursor += 1
        if cursor == end:
            empty.append(index + 1)
            continue
        block_end = cursor + 1
        while block_end < end and lines[block_end].strip() and block_end not in indexes:
            block_end += 1
        spans.append((index + 1, block_end))
    return spans, empty


def turtle_spans(lines):
    """Locate the pinned fixture's subject statements; refuse unsupported tails.

    This is quotation boundary selection, not RDF extraction. Prefix and comment
    lines are skipped outside statements. A standalone final dot closes a block;
    continuation lines stay in that block. No triples are inferred or rewritten.
    """
    spans, start = [], None
    for number, line in enumerate(lines, 1):
        stripped = line.strip()
        if start is None:
            if not stripped or stripped.startswith(("#", "@prefix", "@base")):
                continue
            if not re.match(r"(?:[A-Za-z][\w-]*:[^\s]+|<[^>]+>|_:[^\s]+)\s+", stripped):
                raise ValueError(f"{TURTLE}:{number}: unsupported subject statement")
            start = number
        if re.search(r"\s\.\s*(?:#.*)?$", line):
            spans.append((start, number))
            start = None
    if start is not None:
        raise ValueError(f"{TURTLE}:{start}: unterminated subject statement")
    return spans


def emission_sites(report, lines):
    """Join the pinned term-table spellings to literal emission sites, never JSDoc."""
    table = report.split("## 1. Emitted term table", 1)[1].split("\n## 2.", 1)[0]
    terms = re.findall(r"(?m)^\| `([^`]+)` \| `([^`]+)` \|", table)
    if not terms:
        raise ValueError("emission-v2 term table is absent")
    sites, missing = set(), []
    for term, namespace in terms:
        token = namespace + term
        found = [i for i, line in enumerate(lines, 1)
                 if "`" in line and "${" in line and
                 re.search(r"(?<![\w:-])" + re.escape(token) + r"(?![\w-])", line)]
        if not found:
            missing.append(token)
        sites.update(found)
    return [(i, i) for i in sorted(sites)], missing


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    commit = git(args.repo, "rev-parse", "--verify", "HEAD^{commit}").strip()
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise ValueError("HEAD is not a 40-hex commit")
    blobs = {}
    def lines(path):
        if path not in blobs:
            blobs[path] = git(args.repo, "show", f"HEAD:{path}")
        return blobs[path].splitlines(keepends=True)
    records, census, issues, corrections = {}, collections.OrderedDict(), [], []
    def stats(path):
        return census.setdefault(path, {"selected": 0, "emitted": 0, "duplicates": 0, "unlocatable": 0})
    def emit(path, start, end, quote):
        stat = stats(path)
        stat["selected"] += 1
        span = "".join(lines(path)[start - 1:end])
        if len(quote.strip()) < 10 or norm(quote) not in norm(span):
            stat["unlocatable"] += 1
            issues.append(f"{path}:{start}-{end}: non-substantive or absent verbatim quote")
            return
        payload = [commit, path, start, end, quote]
        digest = hashlib.sha256(json.dumps(payload, sort_keys=True, separators=(",", ":"),
                                          ensure_ascii=False).encode()).hexdigest()
        filename = f"po-{digest[:12]}.yaml"
        record = {"id": f"po:sha256:{digest}", "schema_version": 1,
                  "repository": {"commit": commit, "path": path},
                  "source_span": {"start_line": start, "end_line": end},
                  "quote": quote, "epistemic_status": "quoted_prose"}
        if filename in records:
            if records[filename] != record:
                raise ValueError("12-hex output filename collision")
            stat["duplicates"] += 1
        else:
            records[filename] = record
            stat["emitted"] += 1
    for old_id in ORDERING:
        archived = f"{ARCHIVE}/{old_id}.yaml"
        old = yaml.safe_load("".join(lines(archived)))
        path, span, quote = old["repository"]["path"], old["source_span"], old["quote"]
        start, end = span["start_line"], span["end_line"]
        found = locate(lines(path), quote, start, end)
        if found is None:
            stats(path)["selected"] += 1
            stats(path)["unlocatable"] += 1
            issues.append(f"{old_id}: {path}:{start}-{end}: archived wording absent at HEAD; no replacement emitted")
            continue
        if found != (start, end):
            corrections.append(f"{old_id}: {path}:{start}-{end} -> {found[0]}-{found[1]}")
        emit(path, *found, quote)
    for start, end in turtle_spans(lines(TURTLE)):
        emit(TURTLE, start, end, "".join(lines(TURTLE)[start - 1:end]).strip())
    sites, missing = emission_sites("".join(lines(TERM_REPORT)), lines(EMITTER))
    issues.extend(f"{EMITTER}: no emission site for {token}" for token in missing)
    for start, end in sites:
        emit(EMITTER, start, end, "".join(lines(EMITTER)[start - 1:end]).strip())
    for path in PROSE:
        spans, empty = section_spans(lines(path))
        for number in empty:
            stats(path)["selected"] += 1
            stats(path)["unlocatable"] += 1
            issues.append(f"{path}:{number}: heading has no body block")
        for start, end in spans:
            emit(path, start, end, "".join(lines(path)[start - 1:end]).strip())
    if git(args.repo, "rev-parse", "HEAD").strip() != commit:
        raise ValueError("HEAD changed during transcription; refusing mixed-pin output")
    if not args.dry_run:
        args.out.mkdir(parents=True, exist_ok=True)
        for filename, record in records.items():
            data = (json.dumps(record, ensure_ascii=False, indent=2) + "\n").encode()
            target = args.out / filename
            if target.exists() and target.read_bytes() != data:
                raise ValueError("output would overwrite different evidence")
            target.write_bytes(data)
    print(json.dumps({"mode": "dry-run" if args.dry_run else "write", "commit": commit,
                      "census": census, "total": len(records), "corrections": corrections,
                      "issues": issues}, indent=2))
    return 1 if issues else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        raise SystemExit(f"po_transcriber_run3: {error}") from None
