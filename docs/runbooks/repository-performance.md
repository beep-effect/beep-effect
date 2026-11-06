# Repository performance: measure repeated work first

This runbook records the November 2026 efficiency audit and the procedure for
checking its results again. Compiler and Rust lint configuration lives in the
[TypeScript toolchain runbook](typescript-toolchain.md).

## Adopted changes and evidence

Measurements below are local observations on one shared workstation, not hosted
CI guarantees. The JSDoc comparison is one paired full scan; compiler examples
are medians of three alternating runs per configuration. Do not add percentages
from different workloads together.

| Change | Observed result | Correctness evidence |
| --- | --- | --- |
| Load a package's complete JSDoc source set before querying its exports | Full inventory 286.63 → 134.14 seconds; peak RSS 5,914,908 → 4,355,136 KiB (53% less time, 26% less memory) | Inventories identical except `generatedAt`: 187 packages, 3,663 modules, 26,321 exports; existing detector fixtures pass |
| Generate canonical dependency references in test overlays | CLI test check median 1.79 → 1.55 seconds; peak RSS 6,420,996 → 4,758,956 KiB (13% less time, 26% less memory) | All 342 root check tasks pass; both modes report the same deliberate TS2322 diagnostic |
| Same test-reference change in `@beep/colors` | Median 0.11 → 0.05 seconds; peak RSS 461,888 → 309,452 KiB | Same clean diagnostics; dependency source count 191 → 5; small absolute duration limits timing precision |
| Enable JSDoc inventory's existing remote cache in Check | Enables identical-input reuse; realized savings depend on cache hits | Full inventory retained; protected writer environment, PR read-only policy and adapter cleanup tested |
| Select Storybook before browser provisioning | Avoids browser version resolution, cache restore and Chromium/OS setup for unaffected PRs; compare the publishing PR's hosted provisioning steps | Reuses the existing dependency-aware Turbo probe and preserves failures; affected/unaffected selection fixtures pass |
| Accept multiple package names in `quality package-verify` | Avoids one CLI startup per additional package; no whole-repo timing claim | Sequential execution, duplicate names run once, later packages still run after diagnostic failure, final failure retained |
| Attribute generated governance metadata to its coverage consumers | The observed two-file metadata change selected all 190 packages before; the live planner now selects only `@beep/repo-cli` and `@beep/repo-cli-kit` | 304 planning tests pass; unknown inputs, unavailable consumers and coverage machinery changes retain full fallback; no elapsed-time claim |
| Repair Phoenix inventory query with the current GraphQL field alias | Live doctor can read inventory again | Focused tests and live metadata query pass; no collector restart or instrumentation removal |
| Reduce repeated always-loaded agent guidance | Approximately 5.8 KB removed from `AGENTS.md` | Model projection retained; launch recipes and retirement details remain linked from mandatory runbooks |

The test-reference generator updated 172 overlays. It handles both
`tsconfig.test.json` and nested `test/tsconfig.json`, rebasing reference paths
relative to each overlay. It consumes the canonical build project's references,
including changes planned in the same sync. The test program still includes its
own source; this change removes redundant dependency source checking, not all
source checking. Use the normal Turbo-backed checks so dependencies are built.

A separate workstation-only correction removed obsolete instructions to wrap every
Bun/Node invocation in an interactive shell. The measured wrapper added roughly
600 ms per invocation. Direct commands, or an explicit mise shim path when the
binary is missing, retain toolchain selection without prompt/plugin startup.
That local rule is not distributed by this repository.

## Repeat the checks

```sh
bun run beep tsconfig-sync --check
bun run check
bun run beep quality package-verify @beep/repo-cli @beep/repo-ai-metrics
```

For a config-only edit, `--quick` limits package verification to lint and check.
The default still runs the full package audit and docgen. Batching is sequential
and does not increase memory concurrency.

To benchmark JSDoc, run the exact inventory command from the root package's
`jsdoc:inventory:check` script, saving its JSON output outside tracked source.
Measure elapsed time and peak RSS, keep the source tree and package set fixed,
and compare the complete inventories after removing only `generatedAt`.
Changing only a baseline or returning a partial inventory is not equivalent.

To benchmark test references, save the original overlay beside the generated
one, run the same compiler with both configurations in alternating order, and
compare diagnostics and `--listFilesOnly` output. Use a deliberately invalid
assignment as a positive diagnostic control, then remove the fixture. Report
cold build cost separately from warm compiler cost.

## Why earlier work missed these costs

The audit found several distinct causes, not a single model-quality problem:

- Tool boundaries hide repetition. An individual check can be fast while many
  consumers each rebuild or re-read the same dependency graph.
- Written findings do not establish adoption. The source snapshot contained 128
  opportunity ledgers and 344 reflection documents; validating their presence
  does not turn recurring friction into a verified implementation.
- Observability needs its own health checks. A stale local scorecard and a broken
  inventory query did not mean the live tracing service had no data. Last-week
  tracing metadata included 207,466 records, but only 34,845 carried `beep.repo`;
  aggregate traffic cannot be attributed wholesale to this repository.
- Optimizing one stage reveals another. On one exact CI attempt, cheap test
  bodies took 6–46 seconds while the JSDoc step took 471 seconds. On a wider
  attempt, test and property work dominated instead.
- Old advice can survive the problem it solved. The interactive-shell rule was
  one example. Recommending the old Bun archive cache or another CLI lazy-loader
  would have repeated already-settled work.

Before the next optimization, search the relevant opportunity ledgers and
reflections, inspect current source and open ownership, and record one concrete
before/after workload. Link every adopted finding to its implementation and
validation. Record rejected mechanisms too, so another reviewer does not propose
them again without new evidence.

## Sequential review method and dispositions

Each reviewer received the source/evidence brief and completed predecessors'
reports. Reviewers examined source independently before reconciling earlier
findings, to reduce both duplicate work and anchoring. Sequential review improves
coverage but does not replace measurement or independent correctness checks.

The requested seats were Opus 5.5, Fable 5.1, Grok 4.7 at xhigh, Muse Wonder 1.0
at xhigh and Kimi K3.1 Pro at xhigh. Opus, Fable, Grok and Kimi returned reports. Muse's
exact-model attempt returned subscription quota exhaustion before producing a
review; no substitute or paid overage was used. The operator explicitly approved skipping
Muse after that exhaustion. Kimi corroborated the measured improvements, qualified
unsafe cache/history shortcuts, and identified the early Storybook browser gate.

| Finding | Disposition and reason |
| --- | --- |
| Test overlay dependency references | Implemented in the generator and generated overlays; retain own-source checking |
| JSDoc repeated semantic-program construction | Implemented and full output parity measured |
| JSDoc remote-cache omission | Implemented with the existing cache trust policy |
| Broken Phoenix inventory query | Implemented; preserve live/local/remote attribution distinctions |
| Interactive-shell startup tax | Corrected in the local rule with a backup and direct-toolchain probes |
| Repeated always-loaded instructions | Condensed; retain portable pins, laws, model projection and runbook pointers |
| Duplicate reviewer receipt | Fixed in the launcher: save the final response once; use closed stdin and bounded explicit-path searches |
| Repeated package-verification launches | Implemented batching with preserved per-package evidence and failure behavior |
| Stale identity lint profile discovered only by hosted lint | Add a commit-time freshness check when either Biome configuration changes; regenerate with `bun run beep cache profile --write` |
| Generated metadata causing full coverage fallback | Implemented explicit consumer mappings for the Effect Vitest inventory and schema catalog; full fallback remains for unclassified paths |
| Parallel final-check and audit/docgen | Not enabled: memory admission and concurrent output writes need an equivalent-work experiment first |
| Duplicate cheap-gate/law tasks and many Turbo starts | Structural hypothesis; task-level receipt parity must precede skipping or batching gates |
| Cache coverage results | Rejected as a shortcut: current coverage evidence is bound to the run and head |
| Partial JSDoc inventory from committed baseline | Rejected: full-scan equivalence and complete invalidation were not established |
| Storybook affected decision after browser setup | Implemented `ci lane storybook --selection-only` before provisioning; the lane retains its own check |
| Reuse Heavy Admission to skip docs-only shard jobs | Not enabled: adding an admission dependency also delays every code run behind admission setup; required-context and critical-path parity must be measured first |
| Security-only shallow checkout | Bounded candidate; pinned action inputs were inspected, but full same-head scanner/governance parity was not run, so checkout depth remains unchanged |
| Shared PR build with a cache write token | Rejected: would violate cache producer trust; any shared-build design must preserve PR read-only access |
| CI shard rebalance and property-law sharding | Requires test-only durations and fixed-seed/run-count parity; do not mix setup/build time into test weights |
| Shallow checkout as an immediate speedup | Rejected without merge-base proof; fetching the base tip alone does not guarantee an adequate shallow history |
| Disable superseded-run cancellation | Rejected: can spend more resources validating obsolete heads; join cancellation receipts to push cadence first |
| Restore the old Bun archive cache | Rejected: previous measured restore cost exceeded fresh frozen installs |
| Restart or disable telemetry from an empty scorecard | Rejected: live consumers and protective holds exist; coordinate with the current observability owner |
| Merge tool hooks or memoize session-start projections | Requires policy parity and complete invalidation; per-call timing alone does not establish a safe replacement |
| Hard skill byte caps or a blanket decision-tail append ban | Rejected as naive enforcement: large useful references and valid post-marker sections require structural handling |

The CI sample was 183 job rows from 28 recent runs, including in-progress,
skipped and cancelled jobs. It was a convenience sample, not a representative
week. Exact-attempt step evidence came from Check runs `42152538473` and
`42154227336`; latest-attempt endpoints must not be silently joined to older
attempt rows. Local raw review streams and receipts stay in the ignored
`.beep/performance-audit/` directory; credentials, host metadata and raw private
telemetry are excluded from tracked reports.

## Validation at implementation closeout

- Root source/test graph: 342 successful check tasks after generating the overlays.
- Config-only package handoff: all 172 affected packages passed quick verification.
- Full final package handoff: CLI audit 157.4 seconds and docgen 38.3 seconds;
  AI metrics audit 15.6 seconds and docgen 7.2 seconds, all successful.
- CLI suite: 411 test files and 8,699 tests passed; one file and 10 existing
  tests skipped. This includes batch-verification and Storybook-selection cases.
- CI security/selection tests, workflow policy, generated config drift and
  policy-fingerprint checks pass. The focused metrics suite has 17 passing tests.
- Full JSDoc inventory equivalence and the positive compiler diagnostic control
  are retained with the local timing receipts.

These are local checks. Record hosted observations in the publishing PR body
with exact run, attempt, job and step identifiers, workload and cache state.
Updating that evidence in the PR body avoids invalidating an already tested code
head solely to attach timings. Hosted observations are required before claiming
CI time savings; standard job metadata alone does not establish peak memory.
No collectors, cache trust boundaries, required proof scopes, or property-test
run floors were weakened.

## Reversal

Revert the relevant implementation and generated changes together. For test
references, restore the generator before re-running `tsconfig-sync --write`.
For JSDoc caching, remove only this job's cache setup inputs, protected writer
environment and adapter cleanup. For local shell guidance, restore the saved
local rule; no global environment or service configuration was changed.
