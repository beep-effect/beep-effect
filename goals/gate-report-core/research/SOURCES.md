# Gate Report Core — Sources & Provenance

- **Source exploration:** `explorations/agent-verification-output` — primary ledger:
  `explorations/agent-verification-output/research/SOURCES.md`
  ([link](../../../explorations/agent-verification-output/research/SOURCES.md)).
- **Port study:** `explorations/agent-verification-output/research/vitest-agent-core.md`
  ([link](../../../explorations/agent-verification-output/research/vitest-agent-core.md)), every
  upstream citation made against the reference checkout `.repos/vitest-agent` at `1cf1ab94`
  (2026-11-17).

## 1. Mined source corpus

The rows of the exploration's mined-source table that this goal ports or reads. Locations are
relative to the upstream repository root. `va-classify-test`, `va-history`, `va-persist` and
`va-migrations` belong to `goals/gate-run-history`; `va-gfm` belongs to `goals/ci-gate-reports`.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `va-schemas` | Report, event and render-state schemas | vitest-agent | `packages/sdk/src/schemas/` (`AgentReport.ts:33-88`, `Common.ts:37-186`, `RunEvent.ts:82-262`, `RenderState.ts:61-194`) | data model | port, widened |
| `va-dispatch` | Run-shape by outcome dispatch table | vitest-agent | `packages/ui/src/dispatcher/dispatch.ts:41-62` | output contract | port |
| `va-classify-run` | Shape and outcome classifiers | vitest-agent | `packages/ui/src/dispatcher/classify.ts:34-94` | output contract | port |
| `va-cells` | The twelve render cells | vitest-agent | `packages/ui/src/dispatcher/cells/` | output contract | port, grown to twenty |
| `va-footer` | Next-step footer rules | vitest-agent | `packages/ui/src/dispatcher/footer.ts:24-82` | output contract | port, pointers become repo CLI commands |
| `va-signature` | Failure signature | vitest-agent | `packages/engine/src/utils/failure-signature.ts:11-45` | honest counts | port, without the acorn function boundary |
| `va-build-report` | Honest-count report builder | vitest-agent | `packages/sdk/src/utils/build-report.ts:324-371` | honest counts | port behind a Vitest adapter |
| `va-stray` | Stray-output recorder | vitest-agent | `packages/sdk/src/utils/stray-output.ts:62-184` | honest counts | port; install point in the adapter |
| `va-env` | Environment, executor and detail resolvers | vitest-agent | `packages/engine/src/layers/EnvironmentDetectorLive.ts:8-31`, `ExecutorResolverLive.ts:12-21`, `DetailResolverLive.ts:5-18` | detection | reference; `@beep/runtime-env` owns detection |
| `va-reporter` | Vitest reporter lifecycle | vitest-agent | `packages/plugin/src/reporter.ts:650-3141` | Vitest adapter | reference; rebuild smaller |
| `va-hooks` | Claude Code hooks and sidecar | vitest-agent | `plugin/hooks/`, `packages/sidecar/` | harness | not ported (`tdd-workflow-no-go`) |

The full port inventory (ported, read for invariants, not ported) is in [`SPEC.md`](../SPEC.md),
"Port inventory".

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `spencerbeggs/vitest-agent` | MIT, "Copyright (c) 2026 C. Spencer Beggs" (`LICENSE:1-3`) | port-with-attribution: dual-copyright `LICENSE`, README `Provenance` and `Attribution` | schemas, reducer, classifiers, honest-count rules, signature, dispatch table and cells |
| `vitest-dev/vitest` (two files vendored inside vitest-agent: `packages/plugin/src/utils/vitest-diagnostics.ts`, `collect-performance-hints.ts`) | MIT, "Copyright (c) 2021-Present VoidZero Inc. and Vitest contributors" | port-with-attribution; any file derived from them carries both notices | nothing in this goal; the rule binds a later port |
| `spencerbeggs/effected` | MIT, C. Spencer Beggs | port-with-attribution; precedent `goals/effected-promotion` | nothing new; the promoted kits (`@beep/cli-kit`, `@beep/runtime-env`) are reused as they are |

License texts were read in the reference checkouts and are restated in the port study,
section 10.

## 3. External research sources

Recorded with URLs and fetch dates in
`explorations/agent-verification-output/research/external-landscape.md`
([link](../../../explorations/agent-verification-output/research/external-landscape.md)). This
goal relies on:

- Section 4, interchange schemas: the CTRF and SARIF fields the model projects to.
- Section 5, harness output limits: Claude Code's 10,000-character head-and-tail excerpt for a
  failing command and Codex's middle truncation, which set the 8,000-character agent budget.
- The closing "Design principles extracted", items 1 to 6, 8, 9 and 12.

## 4. In-repo capability references

| Brick | Package / path | Use |
|-------|----------------|-----|
| `Doc`, `Render`, `CliAudience` | `@beep/cli-kit`, `packages/foundation/capability/cli-kit` | reuse |
| `Audience`, `AudienceKind` | `@beep/runtime-env`, `packages/foundation/capability/runtime-env` | reuse |
| `GitHubMarkdown.ts` | `@beep/github-reporting`, `packages/foundation/modeling/github-reporting` | reference, for the CI goal's Markdown form |
| `tsDiagnosticPattern` in `IssueParser.ts` | `packages/tooling/tool/cli/src/commands/Yeet/internal/IssueParser.ts` | extend: move behind the type-checker adapter |
| `OutputBound` | `@beep/repo-cli-kit`, `packages/tooling/library/repo-cli-kit/src/process/StepExec.ts` | reuse |
| `CoverageRuntimeReporter` | `packages/tooling/tool/cli/src/commands/Ci/CiCoverage.reporter.ts` | reference for the Vitest reporter seam |
| Instrumented Vitest runner | `@beep/test-runner`, `packages/tooling/test-kit/test-runner` | extend or sibling |
| Shared Vitest config | `vitest.shared.ts` | extend: register the adapter |
| Attribution precedent | `packages/foundation/capability/walker/LICENSE`, `packages/foundation/capability/walker/README.md` | pattern |
| Gate-report model, gate-run services, Vitest adapter | none | NET-NEW |

Paths and line citations for each brick are in
`explorations/agent-verification-output/research/in-repo-inventory.md`
([link](../../../explorations/agent-verification-output/research/in-repo-inventory.md)).

## 5. Cross-links & provenance

- Source exploration packet: `explorations/agent-verification-output/RESEARCH.md`,
  `explorations/agent-verification-output/DECISIONS.md`,
  `explorations/agent-verification-output/BRIEF.md`,
  `explorations/agent-verification-output/MAP.md`.
- Sibling goals from the same graduation: `goals/gate-output-switch-on`,
  `goals/agent-output-census`, `goals/gate-run-history`, `goals/gate-report-rollout`,
  `goals/ci-gate-reports`.
- Precedent goal: `goals/effected-promotion` (archived; the full packet is in the goals archive).
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
