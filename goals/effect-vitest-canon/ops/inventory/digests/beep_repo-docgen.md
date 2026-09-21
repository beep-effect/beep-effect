# @beep/repo-docgen four-lens digest

Checker creates one in-memory Project per source case; Source.layer and Configuration.layer are Layer.succeed. Parser reuses one Project but explicitly sets concurrent:false at lines103-107 because replacing test.ts invalidates prior nodes. Preserve this serial boundary; do not claim a current race or promise faster per-case reconstruction. The two scope helpers remain open scanner candidates, with pure layer provenance recorded. Configuration uses a scripted FileSystem.makeNoop in a Layer.effect that reads Path; Domain.Process exposes cwd/argv, not a subprocess. No database/container is involved.

Core mixes pure fence parsing with one true native Bun/docgen/tsc integration. It uses a fixed .tmp-docgen directory, launches rm/mkdir/docgen, and awaits pipes/exit. No interruption finalizer owns these children and only markers are removed before reuse. The lifetime and cross-run-directory findings concern different failure paths but should be fixed together; they are not measured leaked children or observed flakes. Read child exit/stderr before marker files so a compiler failure does not become only a missing-file error. Retain real native execution and all harvested-member/exit assertions; fake processes or MemoryFS cannot prove this subject. The support fixture and tsc wrapper are source inputs: the wrapper touches a marker before exec tsc, so the exit assertion remains essential.

SchemaParity passes raw runs12 (eight families) and4 (Printable) to native Arbitrary, bypassing repository floor/seed. Use the existing fcRuns seam with public property registration in P2; preserve all nine schemas, equivalence, rich generation, minimum counts and failure/replay visibility. Replacing the domains or reducing runs is not a remedy. The native CheckOptions reference at rc113146-173 confirms the explicit runs/seed/replay shape. Version compares the actual module-relative package manifest with cwd package.json; preserve package-cwd launch qualification and native identity proof.

The retained Node timing includes100 passing cases across all seven test files. This is actual retained execution evidence for that configuration, including its Bun compatibility plumbing, not proof that bare Node exposes Bun globals. The two support files are audited but not fabricated as reporter test files. No setup-cost profile was captured; retained durations include concurrent case work and cannot be added as independent setup costs.

| Lens | Rows |
| --- | ---: |
| resource | 9 |
| flake | 9 |
| property | 9 |
| observability | 9 |

Severity: 32 info, 3 minor, 1 major. 5 review items and 31 coverage-only rows.

Retained accepted configured Node baseline: 100 cases; reporter span 9947.672607421875 ms; whole command 10.316573552000136 seconds. Node22.22.3/Bun1.4.2/Vitest4.1.11. No load adjustment, new execution or timing acceptance by this lane. A pass does not prove absence of races, coverage or full package proof.

## Top ten files by row count

- packages/tooling/tool/docgen/test/Checker.test.ts: 4 rows, 0 review items.
- packages/tooling/tool/docgen/test/Configuration.test.ts: 4 rows, 0 review items.
- packages/tooling/tool/docgen/test/Core.test.ts: 4 rows, 3 review items.
- packages/tooling/tool/docgen/test/Domain.equivalence.test.ts: 4 rows, 0 review items.
- packages/tooling/tool/docgen/test/Parser.test.ts: 4 rows, 0 review items.
- packages/tooling/tool/docgen/test/SchemaParity.test.ts: 4 rows, 1 review items.
- packages/tooling/tool/docgen/test/fixtures/section-example/src/index.ts: 4 rows, 0 review items.
- packages/tooling/tool/docgen/test/helpers.ts: 4 rows, 0 review items.
- packages/tooling/tool/docgen/test/version.test.ts: 4 rows, 1 review items.

## Top ten files by retained reporter duration

- packages/tooling/tool/docgen/test/Core.test.ts: 2282.672607421875 ms, 14 tests.
- packages/tooling/tool/docgen/test/Checker.test.ts: 959.414306640625 ms, 11 tests.
- packages/tooling/tool/docgen/test/Parser.test.ts: 495.3857421875 ms, 64 tests.
- packages/tooling/tool/docgen/test/SchemaParity.test.ts: 33.187255859375 ms, 5 tests.
- packages/tooling/tool/docgen/test/Configuration.test.ts: 11.196533203125 ms, 4 tests.
- packages/tooling/tool/docgen/test/version.test.ts: 2.445556640625 ms, 1 tests.
- packages/tooling/tool/docgen/test/Domain.equivalence.test.ts: 0.955810546875 ms, 1 tests.

Hosted history: 13 observations across 3 jobs; categories {'coverage-ratchet': 13}. These are coverage-ratchet observations, not unique flakes or unit-test failures. Complete retained provenance/config/host context and slowest cases are retained in the public timing context and hosted history summary. No new failure reproduction is claimed.

P2 proposal order: scope (outer fixture providers and inner native child/output ownership), assertions (preserve polarity and exact operands), property (missing witnesses and floor/seed), flake (directory/process state after scope fix), observability (exit diagnostics before marker reads). Foundation/modeling and tooling/tool wave boundaries remain separate under D13. No P2 work is authorized here.

Root-reviewed P1 inventory; P2 remains gated.

Root reviewed and accepted this package’s P1 rows after source hash, artifact and combined strict-schema validation. Full P1 remains incomplete; Benjamin’s acknowledgement after completeness and Grok review is required before P2.

Evidence: [timing index](../timings/baseline-index.json), [failed timing attempts](../timings/baseline-failures.json), and [hosted history](../hosted-history-summary.json).
