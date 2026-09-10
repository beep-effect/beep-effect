# P0c command-boundary review

Current status: the routing, discovery, persistence, identity/performance,
Drizzle regression and JSDoc corrections below are closed in the handed-off
source. See [the final verification receipt](2026-09-08-p0c-verification.md)
for current acceptance state. The observations below preserve earlier snapshots.

These observations concern a working snapshot, before final handoff. They do not
declare the P0c gate passed. Recheck against final source and generated artifacts.

## Scope and artifact evidence

The first successful command write produced 1,045 census rows: all 1,043 P0a
paths plus the two new effect-vitest test files. No paths were removed and all
139 workspace owner assignments match P0a. The 121 JSONL files contained exactly
the same 5,025 findings as that baseline, with no duplicate IDs. Those outputs
precede the latest detector fixes and must be regenerated before acceptance.

The line count convention differs from P0a: splitting on a newline counts an
extra empty line for newline-terminated files. For example,
`apps/architecture-lab-proof/test/ArchitectureLabProof.test.ts` has 51 lines in
P0a and 52 in the first command census, with identical byte counts. Define and
test the convention explicitly, preferably matching the existing census.

## Performance evidence

The earlier command receipt reports `files=1045 findings=5025 scanMs=59685.2`.
It fails the ten-second gate. The source lane subsequently identified unwanted
ts-morph dependency resolution and is correcting it; that fix needs a fresh
complete CLI measurement before performance can pass.

A read-only microbenchmark of the current membership helper on the first 1,000
decoded baseline rows took about 738 ms for the diff and 375 ms for exception
preservation. At 500 rows it took 158 ms and 78 ms. This is supporting evidence
of repeated membership-key work, not a full-command timing or an extrapolated
acceptance result. Inspect key recomputation inside the shared quadratic diff
and exception lookup if the full default command remains over budget. Preserve
the shared ratchet API and distinct occurrence semantics.

## Final persistence checks

Verify a second row export after the last finding for a package disappears.
The current writer only writes owners present in the new findings; an earlier
owner file can remain stale. Use an isolated output directory and preserve any
unrelated files; a new detector output must not silently retain removed rows.

The prior review's exported JSDoc requirement still applies to the supporting
Scan, Store, Policy, and Syntax modules, including type exports and codecs.
Titled examples on a subset of schema exports do not close that item.

## Concrete command-boundary failures

The orchestrator deliberately interrupted the recovery lane at a review boundary
and ran the exact requested command on stable source hashes. It incorrectly
routed to aggregate quality lint, passing `effect-vitest --census --write --rows`
to Turbo. The introduced cause is missing registration in
`src/internal/cli/LintRouting.ts`. The diagnostic was interrupted after this was
proven; exit 130 is not detector or package-verification acceptance. The same
source lane is authorized to add this required routing entry and focused routing
regression assertions in the existing routing tests.

A separate cache-directory probe writes one owner's rows and then an empty row
set. The prior JSONL still contains the removed finding. This is a reproduced
persistence defect; an unrelated text file remained intact. The fixture and
receipt live under the private cache as `p0c-row-refresh-probe.mjs`.

## Later independent probe receipt

The orchestrator reran the unchanged 15-case rule probe and the unchanged
row-refresh probe against the latest boundary edits. Both exit 0: all 15 rules
pass, the stale package JSONL disappears after an empty export, and the unrelated
text file remains intact. All detector/schema source hashes match before and
after these runs. The receipt is `p0c-boundary-snapshot-receipt.json` in the
private cache. This closes the reproduced row-refresh defect for that snapshot;
full focused-suite, exact CLI timing and package proof are still required.

## Output ownership remains open

A stronger isolated probe additionally seeds `unrelated.jsonl` with a record
from another producer. The current writer deletes it during the first export.
The earlier passing probe covered an unrelated text file only; it did not prove
that all unrelated files survive. The unchanged stronger probe is
`p0c-row-ownership-probe.mjs` in the private cache and currently exits 1 with
`unrelatedJsonlPreserved=false`. Limit cleanup to positively identified output
files owned by this command, preserve other JSONL, and add this regression.
A file extension alone is insufficient ownership evidence.

## Discovery cause confirmed

The exact `FsUtils.globFiles(EffectVitestSourceFileGlobs, ...)` call returns
62,152 paths, not the 1,048 D9 matches. SharedGlob treats its pattern array as
alternatives; the negated node_modules entry therefore admits unrelated paths.
The caller must derive positive include patterns and `GlobOptions.ignore`
patterns from the same schema-owned definition. The shared helper is behaving
as implemented; do not edit it or invent a separate scope definition.

Two cache-only scripts isolate this: `p0c-discovery-cost.mjs` reports the bad
62,152 count (glob about 1,754 ms; ownership about 888 ms), while
`p0c-discovery-split-probe.mjs` reports exactly 1,048 paths (glob about 39 ms;
ownership about 7 ms), with the correct repository root and 139 owners. Both
exit 0; the count difference, not the exit code, proves the integration defect.

Add a fixture exercising the real FsUtils discovery and excluding unrelated
source, lab/packet files, and node_modules. Prior direct-AST scan timings used
the saved census and did not exercise this discovery bug. The exact canonical
command must supply the final count, output and elapsed-time receipt.

## Baseline comparison exposed an optimization regression

The corrected baseline has 5,009 rows versus the earlier 5,025: EV008 removes
16 live-sleep false positives; EV007 unexpectedly removes three real property
assertions; EV006 adds one row and EV010 adds two new integration-test candidates.
The exact delta is `p0c-corrected-baseline-delta.json` in the private cache.

The three EV007 sites are in the Drizzle errors test and have valid import
provenance and test containment. `canonicalMember` mistakenly rewrites the
property name in `fc.assert` using an unrelated namespace import named `assert`.
The unchanged `p0c-drizzle-regression-probe.mjs` expects three and observes zero.
Normalize a bare imported callee only; retain the property-access member name.
Require this regression and restored baseline rows before accepting P0c.
