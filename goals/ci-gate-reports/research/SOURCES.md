# CI Gate Reports — Sources & Provenance

- **Source exploration:** `explorations/agent-verification-output` — primary ledger:
  [`explorations/agent-verification-output/research/SOURCES.md`](../../../explorations/agent-verification-output/research/SOURCES.md).
  This file carries the rows this goal uses; the primary ledger stays the full record.

## 1. Mined source corpus

Upstream rows from the primary ledger that this goal relies on. Locations are relative to the
reference checkout `.repos/vitest-agent` (upstream HEAD `1cf1ab94` on 2026-11-18); citations are
in
[`explorations/agent-verification-output/research/vitest-agent-core.md`](../../../explorations/agent-verification-output/research/vitest-agent-core.md),
sections 2.6 and 7.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `va-gfm` | GitHub summary and grouped log output | vitest-agent | `.repos/vitest-agent/packages/reporter/src/defaultReporter.ts:359-426` | CI | port onto `@beep/cli-kit` `Render.markdown` and `Render.githubLog` |
| `va-gfm` (grouped log) | Collapsed `::group::` block | vitest-agent | `.repos/vitest-agent/packages/reporter/src/githubLog.ts:89-127` | CI | port; one group per unit |
| `va-classify-test` | History label for one series | vitest-agent | `.repos/vitest-agent/packages/sdk/src/utils/classify-test.ts:11-26` | history | not ported here; the CI series key `(workflow, job, step)` feeds it through `gate-run-history` |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `spencerbeggs/vitest-agent` | MIT (C. Spencer Beggs) | port-with-attribution; files derived from `va-gfm` carry the attribution `gate-report-core` sets | GitHub summary and grouped-log shape |

## 3. External research sources

URLs and fetch notes are in
[`explorations/agent-verification-output/research/external-landscape.md`](../../../explorations/agent-verification-output/research/external-landscape.md).
The sections this goal uses:

- Section 1, "GitHub Actions: annotations, summaries, problem matchers, logs API": 10 errors, 10
  warnings and 10 notices per step and 50 per job; `GITHUB_STEP_SUMMARY` 1 MiB per step and 20
  summaries shown per job; Checks API 50 annotations per request and 65,535 characters per
  summary; the per-job logs endpoint's one-minute redirect.
- Section 4, GitHub Checks annotations as a capped, lossy sink.
- Section 5, harness output limits (head-and-tail excerpt near 10,000 characters).
- "Design principles extracted", items 3, 4, 5 and 10.

## 4. In-repo capability references

Paths and line citations:
[`explorations/agent-verification-output/research/in-repo-inventory.md`](../../../explorations/agent-verification-output/research/in-repo-inventory.md),
sections 2 and 4. Baseline numbers:
[`explorations/agent-verification-output/research/transcript-audit.md`](../../../explorations/agent-verification-output/research/transcript-audit.md),
"How agents already cope" (CI logs row) and "What the turns cost".

| Brick | Package / path | Use |
| --- | --- | --- |
| CI-log failure isolator | `isolateYeetMonitorJobLogFailure`, `stripYeetMonitorLogDecoration` in `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` | extend: export the route |
| Turbo summary to step summary | `packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts` (`append-turbo-summary`) | extend: sibling command |
| Per-task outcome records | `TaskOutcomeRecord` in `packages/tooling/tool/cli/src/commands/Ci/CiTaskOutcomes.ts`; reader `packages/tooling/tool/cli/src/commands/Ci/RouteCorpus.ts` | carrier candidate |
| Document renderer | `Render` in `packages/foundation/capability/cli-kit/src/Render.ts` | reuse |
| Annotations | `GithubAnnotation` in `packages/foundation/capability/cli-kit/src/GithubAnnotation.ts` | reuse |
| Workflow-command neutralizing | `packages/foundation/modeling/github-commands/src/CommandNeutralizer.ts` | reuse |
| Check documents, GFM writer | `packages/foundation/modeling/github-reporting/src/` | reuse |
| Step-summary sink | `ActionOutputs` in `packages/drivers/github-actions/src/ActionOutputs.ts` | reuse |
| GitHub client and budget ledger | `packages/drivers/github/src/GitHubClient.ts`, `packages/tooling/tool/cli/src/internal/github/GithubLedger.service.ts` | reuse |
| Artifact retention lint | `packages/tooling/tool/cli/src/commands/Ci/CiGovernance.ts` | reuse |
| CI projection, report upload and lookup, CI-job adapter, failing-region command | none | NET-NEW |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/agent-verification-output/RESEARCH.md`,
  `explorations/agent-verification-output/DECISIONS.md`,
  `explorations/agent-verification-output/BRIEF.md`,
  `explorations/agent-verification-output/MAP.md`.
- Sibling goals: `goals/gate-report-core` (required), `goals/gate-run-history` (consumes the
  feed), `goals/gate-report-rollout`, `goals/gate-output-switch-on`, `goals/agent-output-census`.
- Related packets: `goals/github-budget-ledger` (the ledger this goal's requests land in),
  `goals/github-state-worker` (paused; a shared PR-state reader).
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
