# Agent-Legible Verification Output — Sources & Provenance

- **Cluster / origin:** an operator question on 2026-11-18, a seven-day
  transcript census, a source study of the vitest-agent reference checkout,
  an in-repo inventory and a web landscape sweep, all run the same day.
- **Provenance:** [`RESEARCH.md`](../RESEARCH.md) is the synthesis; the four
  reports beside this file carry the evidence.

## 1. Mined source corpus

Locations are relative to the upstream repository root (reference checkout
`.repos/vitest-agent`, upstream HEAD `1cf1ab94` on 2026-11-18). The full cited
list is [`vitest-agent-core.md`](./vitest-agent-core.md).

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `va-dispatch` | Run-shape by outcome dispatch table | vitest-agent | `packages/ui/src/dispatcher/dispatch.ts:41-62` | output contract | port |
| `va-classify-run` | Shape and outcome classifiers | vitest-agent | `packages/ui/src/dispatcher/classify.ts:34-94` | output contract | port |
| `va-cells` | The twelve render cells | vitest-agent | `packages/ui/src/dispatcher/cells/` | output contract | port |
| `va-footer` | Next-step footer rules | vitest-agent | `packages/ui/src/dispatcher/footer.ts:24-82` | output contract | port, pointers reworked |
| `va-classify-test` | History label for one series | vitest-agent | `packages/sdk/src/utils/classify-test.ts:11-26` | history | port |
| `va-history` | Ten-run window tracker | vitest-agent | `packages/engine/src/layers/HistoryTrackerLive.ts:13-41` | history | port, branch partition added |
| `va-signature` | Failure signature | vitest-agent | `packages/engine/src/utils/failure-signature.ts:11-45` | history | port |
| `va-build-report` | Honest-count report builder | vitest-agent | `packages/sdk/src/utils/build-report.ts:324-371` | honest counts | port behind a Vitest adapter |
| `va-stray` | Stray-output recorder | vitest-agent | `packages/sdk/src/utils/stray-output.ts:62-184` | honest counts | port |
| `va-env` | Environment, executor and detail resolvers | vitest-agent | `packages/sdk/src/contracts/` and `packages/plugin/src/plugin.ts` | detection | reference; `@beep/runtime-env` owns detection |
| `va-gfm` | GitHub summary and grouped log output | vitest-agent | `packages/reporter/src/defaultReporter.ts:359-426` | CI | port onto `@beep/cli-kit` |
| `va-schemas` | Report, event and render-state schemas | vitest-agent | `packages/sdk/src/schemas/` | data model | port, widened |
| `va-reporter` | Vitest reporter lifecycle | vitest-agent | `packages/plugin/src/reporter.ts` | Vitest adapter | reference; rebuild smaller |
| `va-persist` | Persist transaction invariant | vitest-agent | `packages/engine/src/utils/persist-transaction.ts:175` | storage | port the invariant |
| `va-migrations` | SQLite schema | vitest-agent | `packages/engine/src/migrations/` | storage | reference; result tables only |
| `va-hooks` | Claude Code hooks and sidecar | vitest-agent | `plugin/hooks/`, `packages/sidecar/` | harness | reference only |

**How these inform this packet:** the dispatch table, the classifiers and the
honest-count rules are the transferable core and are pure. The Vitest
reporter, the SQLite schema and the hooks carry the upstream project's own
product (a TDD workflow) and are read for their invariants, not copied.
Dispositions here are the research-stage reading; `DECISIONS.md` settles
them.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
| --- | --- | --- | --- |
| `spencerbeggs/vitest-agent` | MIT (C. Spencer Beggs) | port-with-attribution | output contract, classifiers, honest-count rules, GitHub summary |
| `vitest-dev/vitest` (two files vendored inside vitest-agent) | MIT (VoidZero Inc. and Vitest contributors) | port-with-attribution; keep both notices on any file derived from them | ported diagnostics |
| `spencerbeggs/effected` | MIT (C. Spencer Beggs) | port-with-attribution; precedent goal `effected-promotion` | kits already promoted to `@beep/*` |
| `nrwl/nx` | MIT | reference-only (pattern) | `summary` output style as a console specification |

License texts were read in the reference checkouts
(`.repos/vitest-agent/LICENSE`, the kit `LICENSE` files) and are restated in
[`vitest-agent-core.md`](./vitest-agent-core.md) section 10.

## 3. External research sources

Every external URL this packet relies on is recorded, with fetch notes and
dates, in [`external-landscape.md`](./external-landscape.md). The sections
that carry the claims used in `RESEARCH.md`:

- Section 1, built-in agent modes (Vitest, Bun, Turborepo, Nx, Biome,
  oxlint, TypeScript 7, Playwright, GitHub Actions).
- Section 2, how tools detect an agent.
- Section 3, dedicated tools and libraries.
- Section 4, interchange schemas (CTRF, JUnit XML, TAP, SARIF, GitHub Checks).
- Section 5, published guidance and harness output limits.
- The closing "Design principles extracted" list.

## 4. In-repo capability references

Paths and line citations are in [`in-repo-inventory.md`](./in-repo-inventory.md).

| Brick | Package / path | Use |
| --- | --- | --- |
| `Doc` and `Render` | `@beep/cli-kit`, `packages/foundation/capability/cli-kit` | reuse |
| Agent and CI detection | `@beep/runtime-env`, `packages/foundation/capability/runtime-env` | reuse |
| `YeetVerdict` | `packages/tooling/tool/cli/src/commands/Yeet/internal/Verdict.ts` | extend |
| `IssueParser`, `QualityIssueIndex` | `packages/tooling/tool/cli/src/commands/Yeet/internal/` | extend |
| Lane-run report | `packages/tooling/tool/cli/src/commands/Quality/` | extend |
| CI-log failure isolator | `packages/tooling/tool/cli/src/commands/Yeet/internal/MonitorLoop.ts` | extend |
| `OutputBound` | `@beep/repo-cli-kit`, `packages/tooling/library/repo-cli-kit` | reuse |
| SQLite driver | `@beep/sqlite`, `packages/drivers/sqlite` | reuse |
| Append-only store precedent | `@beep/agent-memory-store`, `packages/tooling/library/agent-memory-store` | reference |
| Flake quarantine | `packages/tooling/tool/cli/src/commands/Quality/internal/FlakeQuarantine.ts` | reconcile |
| Vitest reporter seam | `packages/tooling/tool/cli/src/commands/Ci/CiCoverage.reporter.ts` | reference |
| Gate-neutral verdict model and renderer | none | NET-NEW |
| Run-history store keyed by gate and subject | none | NET-NEW |
| Vitest adapter | none | NET-NEW |

## 5. Cross-links & provenance

- This packet: [`RESEARCH.md`](../RESEARCH.md), [`CAPTURE.md`](../CAPTURE.md).
- Precedent goal: `goals/effected-promotion` (archived tombstone on `main`;
  full packet in the goals archive).
- Sibling explorations: `explorations/context-rent-telemetry` (parked; the
  cost of always-loaded guidance) and `explorations/ten-minute-certainty`
  (graduated; local and hosted proof time).
