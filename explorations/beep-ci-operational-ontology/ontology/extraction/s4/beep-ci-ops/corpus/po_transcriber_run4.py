#!/usr/bin/env python3
"""Transcribe run-4 prose evidence from git show HEAD: without interpreting its wording.

Order: each change-event ledger row from its id line through its first
mechanismChanged line; KPI law sections 2 and 6; S7 contract section 8 (heading
plus first block of 8, 8.1, 8.2 and 8.3, then every later block of 8.3); the
first lane-plan fixture statement per predicate and per rdf:type object; each
literal-domain table row and numbered ruling; the deployed ProofStage line; the
gate, stage-census and merged-preview blocks of the ledger pin manifest and the
attempt-start census of the fleet pin manifest with the last-start line under it.

Every source is located by a needle, never by a line number. A quote is the
verbatim span with outer whitespace removed. A needle that does not match
exactly once, a short quote and a ledger row whose shape is off are reported and
never replaced with rewritten text. The census prints on both success and
partial evidence; any issue exits 1.

Usage: --repo . --out <directory> [--dry-run]. Dry-run never writes output.
Only Python's standard library is required.
"""
from __future__ import annotations

import argparse
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

PACKET = "explorations/beep-ci-operational-ontology"
CORPUS = f"{PACKET}/ontology/extraction/s4/beep-ci-ops/corpus"
LEDGER = f"{PACKET}/research/control-interventions.yaml"
KPI = f"{PACKET}/research/kpi-measurement-rules.md"
KPI_SECTIONS = ("## 2. Membership and partitioning", "## 6. 2026-10-01 amendment (v1.1)")
CONTRACT = f"{PACKET}/ontology/docs/s7-projection-contract.md"
CONTRACT_HEADINGS = ("## 8. ", "### 8.1 ", "### 8.2 ", "### 8.3 ")
CONTRACT_BLOCKS = "### 8.3 "
TURTLE = "apps/labs/ciops/test/fixtures/lane-plan-v1.ttl"
DOMAINS = f"{PACKET}/ontology/docs/literal-domains.md"
STAGE_SOURCE = "packages/tooling/tool/cli/src/internal/repo-run/QualityScheduler.schemas.ts"
STAGE_NEEDLE = "export const ProofStage = LiteralKit("
LEDGER_PIN = f"{CORPUS}/run4-ledger/MANIFEST.yaml"
FLEET_PIN = f"{CORPUS}/run4-fleet/MANIFEST.yaml"
FLEET_TAIL = "last_merged_preview_start:"
HEADING = re.compile(r"^[ ]{0,3}(#{1,6})[ \t]+\S")
FENCE = re.compile(r"^[ ]{0,3}(`{3,}|~{3,})")
ROW_START = re.compile(r"^- id: iv-")
ROW_END = re.compile(r"^  mechanismChanged:")
TABLE_ROW = re.compile(r"^\|[ \t]*`[^`]+`[ \t]*\|")
NUMBERED = re.compile(r"^[0-9]+\. \S")


def git(repo, *args):
    result = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, timeout=30)
    if result.returncode:
        raise ValueError("required Git query failed: " + " ".join(args))
    return result.stdout.decode("utf-8")


def norm(text):
    return re.sub(r"\s+", " ", text).strip()


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


def heading_span(lines, prefix):
    """One heading by its text prefix, through its first block (the run-2 rule)."""
    spans, _ = section_spans(lines)
    found = [(s, e) for s, e in spans if lines[s - 1].startswith(prefix)]
    return found[0] if len(found) == 1 else None


def later_blocks(lines, first):
    """Nonblank blocks after a heading's first block, up to the next heading.

    Refuses a section that holds a code fence: a blank line inside a fence is
    not a block boundary, and this selector does not track fences.
    """
    spans, start = [], None
    for index in range(first[1], len(lines)):
        line = lines[index]
        if HEADING.match(line):
            break
        if FENCE.match(line):
            raise ValueError(f"line {index + 1}: code fence inside an enumerated section")
        if line.strip():
            start = index + 1 if start is None else start
        elif start is not None:
            spans.append((start, index))
            start = None
    else:
        index = len(lines)
    if start is not None:
        spans.append((start, index))
    return spans


def ledger_rows(lines):
    """Each row from its id line through its first mechanismChanged line."""
    starts = [i for i, line in enumerate(lines) if ROW_START.match(line)]
    rows = []
    for position, start in enumerate(starts):
        limit = starts[position + 1] if position + 1 < len(starts) else len(lines)
        end = next((i for i in range(start, limit) if ROW_END.match(lines[i])), None)
        flags = []
        if end is None:
            rows.append((start + 1, None, ["no mechanismChanged line"]))
            continue
        body = lines[start:end + 1]
        for key in ("class", "landedAt"):
            if not any(line.startswith(f"  {key}:") for line in body):
                flags.append(f"{key} outside the span")
        if any(line.startswith("  hypothesis:") for line in body):
            flags.append("span reaches hypothesis")
        rows.append((start + 1, end + 1, flags))
    return rows


def turtle_firsts(lines):
    """First statement per predicate and per rdf:type object; single-predicate statements only."""
    seen, spans = set(), []
    for start, end in turtle_spans(lines):
        text = "".join(lines[start - 1:end])
        tokens = text.split()
        if len(tokens) < 4 or re.search(r";\s*$", text, re.M):
            raise ValueError(f"{TURTLE}:{start}: unsupported multi-predicate statement")
        key = ("type", tokens[2]) if tokens[1] in ("a", "rdf:type") else ("predicate", tokens[1])
        if key not in seen:
            seen.add(key)
            spans.append((start, end))
    return spans


def domain_spans(lines):
    """Each table row whose first cell is a code-spanned domain, and each numbered ruling."""
    rows = [(i + 1, i + 1) for i, line in enumerate(lines) if TABLE_ROW.match(line)]
    items, start = [], None
    for index, line in enumerate(lines + [""]):
        if start is not None and (not line.strip() or NUMBERED.match(line)):
            items.append((start, index))
            start = None
        if NUMBERED.match(line):
            start = index + 1
    return rows, items


def yaml_block(lines, pattern, within=None):
    """One mapping key by pattern, through its last deeper-indented line."""
    low, high = within if within else (1, len(lines))
    found = [i for i in range(low - 1, high) if re.match(pattern, lines[i])]
    if len(found) != 1:
        return None
    start = found[0]
    indent = len(lines[start]) - len(lines[start].lstrip(" "))
    end = start
    for index in range(start + 1, len(lines)):
        line = lines[index]
        if not line.strip():
            continue
        if len(line) - len(line.lstrip(" ")) <= indent:
            break
        end = index
    return start + 1, end + 1


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
    records, census, issues = {}, collections.OrderedDict(), []
    def stats(path):
        return census.setdefault(path, {"selected": 0, "emitted": 0, "duplicates": 0, "unlocatable": 0})
    def missing(path, what):
        stats(path)["selected"] += 1
        stats(path)["unlocatable"] += 1
        issues.append(f"{path}: {what}")
    def emit(path, start, end):
        stat = stats(path)
        stat["selected"] += 1
        span = "".join(lines(path)[start - 1:end])
        quote = span.strip()
        if len(quote) < 10 or norm(quote) not in norm(span):
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
    rows = ledger_rows(lines(LEDGER))
    if not rows:
        missing(LEDGER, "no change-event row")
    for start, end, flags in rows:
        issues.extend(f"{LEDGER}:{start}: {flag}" for flag in flags)
        if end is None:
            stats(LEDGER)["selected"] += 1
            stats(LEDGER)["unlocatable"] += 1
        else:
            emit(LEDGER, start, end)
    for path, prefixes, enumerated in ((KPI, KPI_SECTIONS, KPI_SECTIONS),
                                       (CONTRACT, CONTRACT_HEADINGS, (CONTRACT_BLOCKS,))):
        for prefix in prefixes:
            first = heading_span(lines(path), prefix)
            if first is None:
                missing(path, f"heading {prefix.strip()!r} does not match exactly once with a body block")
                continue
            emit(path, *first)
            if prefix in enumerated:
                for start, end in later_blocks(lines(path), first):
                    emit(path, start, end)
    for start, end in turtle_firsts(lines(TURTLE)):
        emit(TURTLE, start, end)
    table, rulings = domain_spans(lines(DOMAINS))
    if not table:
        missing(DOMAINS, "no domain table row")
    if not rulings:
        missing(DOMAINS, "no numbered ruling")
    for start, end in table + rulings:
        emit(DOMAINS, start, end)
    sites = [i for i, line in enumerate(lines(STAGE_SOURCE), 1) if line.startswith(STAGE_NEEDLE)]
    if len(sites) != 1:
        missing(STAGE_SOURCE, "the ProofStage line does not match exactly once")
    else:
        emit(STAGE_SOURCE, sites[0], sites[0])
    gate = yaml_block(lines(LEDGER_PIN), r"^gate:\s*$")
    stage_census = yaml_block(lines(LEDGER_PIN), r"^  stage_census:\s*$")
    merged = yaml_block(lines(LEDGER_PIN), r"^\s+merged-preview:\s*$", stage_census) if stage_census else None
    starts = yaml_block(lines(FLEET_PIN), r"^attempt_starts_by_stage:\s*$")
    if starts and lines(FLEET_PIN)[starts[1]:starts[1] + 1] and lines(FLEET_PIN)[starts[1]].startswith(FLEET_TAIL):
        starts = (starts[0], starts[1] + 1)
    else:
        starts = None
    for path, block, label in ((LEDGER_PIN, gate, "gate"), (LEDGER_PIN, stage_census, "stage_census"),
                               (LEDGER_PIN, merged, "stage_census merged-preview"),
                               (FLEET_PIN, starts, "attempt_starts_by_stage")):
        if block is None:
            missing(path, f"block {label} does not match exactly once in its expected shape")
        else:
            emit(path, *block)
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
                      "census": census, "total": len(records), "issues": issues}, indent=2))
    return 1 if issues else 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (ValueError, OSError, subprocess.TimeoutExpired) as error:
        raise SystemExit(f"po_transcriber_run4: {error}") from None
