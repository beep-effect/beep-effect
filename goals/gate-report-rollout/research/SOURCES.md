# Gate Report Rollout — Sources & Provenance

- **Source exploration:** `explorations/agent-verification-output` — primary ledger:
  [`explorations/agent-verification-output/research/SOURCES.md`](../../../explorations/agent-verification-output/research/SOURCES.md).
  This file carries the rows this goal uses; the primary ledger stays the full record.

## 1. Mined source corpus

Upstream rows from the primary ledger that this goal relies on. Locations are relative to the
reference checkout `.repos/vitest-agent` (upstream HEAD `1cf1ab94` on 2026-11-18); citations are
in `explorations/agent-verification-output/research/vitest-agent-core.md`.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `va-build-report` | Honest-count report builder | vitest-agent | `packages/sdk/src/utils/build-report.ts:324-371` | honest counts | rules reused through core for aggregates and adapters |
| `va-dispatch` | Run-shape by outcome dispatch table | vitest-agent | `packages/ui/src/dispatcher/dispatch.ts:41-62` | output contract | consumed through core's renderer |
| `va-footer` | Next-step footer rules | vitest-agent | `packages/ui/src/dispatcher/footer.ts:24-82` | output contract | per-gate pointer table gains lint, build and Yeet rows |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `spencerbeggs/vitest-agent` | MIT (C. Spencer Beggs) | port-with-attribution, done in `gate-report-core` | nothing new; this goal adds adapters to the ported core |

## 3. External research sources

URLs and fetch notes are in
[`explorations/agent-verification-output/research/external-landscape.md`](../../../explorations/agent-verification-output/research/external-landscape.md).
The sections this goal uses:

- Section 1, Biome reporters (`sarif`/`rdjson` as machine input; experimental `json` avoided) and
  the oxlint `agent` format and its automatic selection.
- Section 1, TypeScript 7 / tsgo: text output only.
- Section 5, harness output limits (head-and-tail excerpt near 10,000 characters), which bound
  heartbeat volume and the aggregate console.
- "Design principles extracted", items 1 to 6 and 12.

## 4. In-repo capability references

Paths and line citations:
[`explorations/agent-verification-output/research/in-repo-inventory.md`](../../../explorations/agent-verification-output/research/in-repo-inventory.md),
sections 1, 2, 7 and 8d. Baseline numbers:
[`explorations/agent-verification-output/research/transcript-audit.md`](../../../explorations/agent-verification-output/research/transcript-audit.md),
"How agents already cope" and "What is in the output that survives filtering".

| Brick | Package / path | Use |
| --- | --- | --- |
| Lane catalog | `packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts`, `GithubCheckLaneSpec` | extend: adapter kind per lane |
| CI lanes | `packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`, `CI_LANE_ID_VALUES` | extend |
| Typed lint findings | `packages/tooling/tool/cli/src/commands/Laws/*.model.ts`, `Lint/` | reuse as event sources |
| `YeetVerdict` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts` | extend as consumer |
| `QualityIssueIndex`, `qualityIssuesFromStepResult` | `packages/tooling/tool/cli/src/commands/Yeet/Yeet.schemas.ts`, `Yeet/internal/IssueParser.ts` | extend as consumer |
| Lane-run report | `QualityTaskLaneRunReport` in `packages/tooling/tool/cli/src/commands/Quality/Quality.schemas.ts` | extend as consumer |
| Package verify renderer | `packages/tooling/tool/cli/src/commands/Quality/internal/PackageVerify.ts` | extend |
| Gate table | `GateTableReport` in `packages/tooling/tool/cli/src/commands/Yeet/internal/GateTable.ts` | extend |
| Job wait | `ProofJobWaitOptions` in `packages/tooling/tool/cli/src/commands/Yeet/internal/ProofJob.ts` | extend |
| Readiness monitor | `reportMonitorObservation` in `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` | extend |
| Turbo run summaries | `taskOutcomesOf` in `packages/tooling/tool/cli/src/commands/Ci/CiTaskOutcomes.ts` | reuse for build-shaped units |
| GitHub budget ledger | `packages/tooling/tool/cli/src/internal/github/GithubLedger.service.ts` | measure block-mode spend |
| Heartbeat, block until changed, lane-to-adapter registry | none | NET-NEW |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/agent-verification-output/RESEARCH.md`,
  `explorations/agent-verification-output/DECISIONS.md`,
  `explorations/agent-verification-output/BRIEF.md`,
  `explorations/agent-verification-output/MAP.md`.
- Sibling goals: `goals/gate-report-core` (required), `goals/gate-run-history`,
  `goals/ci-gate-reports`, `goals/gate-output-switch-on`, `goals/agent-output-census`.
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
