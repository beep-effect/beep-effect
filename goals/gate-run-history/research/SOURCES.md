# Gate Run History — Sources & Provenance

- **Source exploration:** `explorations/agent-verification-output` — primary ledger:
  `explorations/agent-verification-output/research/SOURCES.md`
  ([link](../../../explorations/agent-verification-output/research/SOURCES.md)).
- **Port study:** `explorations/agent-verification-output/research/vitest-agent-core.md`
  ([link](../../../explorations/agent-verification-output/research/vitest-agent-core.md)),
  sections 3.2 to 3.4 and 9, every upstream citation made against the reference checkout
  `.repos/vitest-agent` at `1cf1ab94` (2026-11-17).

## 1. Mined source corpus

The rows of the exploration's mined-source table that this goal ports or reads, with the study's
upstream citations. Locations are relative to the upstream repository root.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `va-classify-test` | History label for one series | vitest-agent | `.repos/vitest-agent/packages/sdk/src/utils/classify-test.ts:11-26` | history | port, rules changed per `SPEC.md` |
| `va-history` | Ten-run window tracker | vitest-agent | `.repos/vitest-agent/packages/engine/src/layers/HistoryTrackerLive.ts:13-41` | history | port, branch partition added, window as configuration |
| `va-persist` | Persist transaction invariant | vitest-agent | `.repos/vitest-agent/packages/engine/src/utils/persist-transaction.ts:175` | storage | port the invariant |
| `va-migrations` | SQLite schema | vitest-agent | `.repos/vitest-agent/packages/engine/src/migrations/` (`0003_run_retention.ts:92-155`) | storage | reference; result tables only |
| `va-history-key` | Series key | vitest-agent | `.repos/vitest-agent/packages/engine/src/services/HistoryTracker.ts:26` | history | port; key becomes gate, subject, item key, branch |
| `va-history-store` | History write, prune and reads | vitest-agent | `.repos/vitest-agent/packages/engine/src/layers/DataStoreLive.ts:217,458`, `DataReaderLive.ts:498` | storage | reference |
| `va-flaky-query` | The MCP flaky rule | vitest-agent | `.repos/vitest-agent/packages/engine/src/layers/DataReaderLive.ts:711-730` | history | reference; replaced by the one flaky rule |
| `va-first-open` | Concurrent first open at the WAL switch | vitest-agent | `.repos/vitest-agent/okf/limitations/concurrent-first-open-wal-switch.md:28-52` | storage | reference; becomes a typed retry |
| `va-path` | Data path and shared worktree history | vitest-agent | `.repos/vitest-agent/packages/engine/src/utils/resolve-data-path.ts:69-113`, `resolve-project-key-from-cwd.ts:17-38`, `.repos/vitest-agent/okf/decisions/31-deterministic-xdg-path-resolution.md:117-125` | storage | reference; one file per repository kept, the shared window replaced |

`va-history-key`, `va-history-store`, `va-flaky-query`, `va-first-open` and `va-path` are rows this
goal adds; the exploration's ledger carries the first four rows above.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `spencerbeggs/vitest-agent` | MIT, "Copyright (c) 2026 C. Spencer Beggs" (`LICENSE:1-3`) | port-with-attribution: the dual-copyright `LICENSE` and README `Provenance` and `Attribution` of the packages `goals/gate-report-core` creates | classifier, window tracker, series key, persist invariant |
| `vitest-dev/vitest` (two files vendored inside vitest-agent) | MIT, "Copyright (c) 2021-Present VoidZero Inc. and Vitest contributors" | port-with-attribution; any file derived from them carries both notices | nothing in this goal |
| `spencerbeggs/effected` | MIT, C. Spencer Beggs | port-with-attribution; precedent `goals/effected-promotion` | nothing new; `@beep/xdg` is already promoted and is reused as it is |

License texts were read in the reference checkouts and are restated in the port study,
section 10.

## 3. External research sources

Recorded with URLs in
`explorations/agent-verification-output/research/external-landscape.md`
([link](../../../explorations/agent-verification-output/research/external-landscape.md)). This
goal relies on section 4 (CTRF's definition of flaky: a pass after failed attempts, and its
`baseline`) and design principle 11 (classify against history, not just this run).

## 4. In-repo capability references

| Brick | Package / path | Use |
|-------|----------------|-----|
| SQLite driver (`SqliteClient`, `make`, `makeLayer`, `SqliteError`, `SqliteTestLayer`) | `@beep/sqlite`, `packages/drivers/sqlite` | reuse, as a narrow operational adapter |
| Tooling library on the same driver | `@beep/agent-memory-store`, `packages/tooling/library/agent-memory-store` (`MemoryLog.layer.ts`) | reference |
| XDG directories (`AppDirs`, `AppDirKind`) | `@beep/xdg`, `packages/foundation/capability/xdg` | reuse for the store location |
| Flake quarantine (`FlakeQuarantineIncident`, `FlakeQuarantineArtifact`, `detectNoLocationTs2589Flake`) | `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts` | reconcile |
| Per-task outcome records | `packages/tooling/tool/cli/src/commands/Ci/CiTaskOutcomes.ts` | candidate hosted-report carrier, chosen by `goals/ci-gate-reports` |
| Gate-report model and gate-run library | `goals/gate-report-core` | build on |
| History store keyed by gate, subject, item key and branch | none | NET-NEW |

Paths and line citations for each brick are in
`explorations/agent-verification-output/research/in-repo-inventory.md`
([link](../../../explorations/agent-verification-output/research/in-repo-inventory.md)).

## 5. Cross-links & provenance

- Source exploration packet: `explorations/agent-verification-output/RESEARCH.md`,
  `explorations/agent-verification-output/DECISIONS.md`,
  `explorations/agent-verification-output/BRIEF.md`,
  `explorations/agent-verification-output/MAP.md`.
- Prerequisite goal: `goals/gate-report-core`. Feed for the hosted-main baseline:
  `goals/ci-gate-reports`.
- Precedent goal: `goals/effected-promotion` (archived; the full packet is in the goals archive).
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
