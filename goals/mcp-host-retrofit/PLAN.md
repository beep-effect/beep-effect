# MCP Host Retrofit Plan

## Status

Status: `complete`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Confirm `@beep/mcp-kit`'s shipped `SanitizedSpan`/`ToolAnnotations`/`TierGate` surface; audit both hosts' tool surfaces for any genuine write/gateable tool (tier-gate applicability) and confirm which tool sets lack four-hint annotations. | Kit surface audited. Key finding: `McpServer.toolkit(...)`'s per-tool dispatch closure is registered once at layer-build time with no seam to wrap later invocations from outside — empirically verified (`node_modules/effect/src/unstable/ai/McpServer.ts:673-758`) that wrapping only the outer `Layer.launch`/`server.callTool` call does NOT suppress the leak, because `registerToolkit`'s `Effect.provideContext(services)` does not carry forward a build-time tracer/span override. `StreamingToolkit` (17 tools, native to `nlp-mcp`) had zero four-hint annotations; `NlpToolkit` (25 tools) is ALSO unannotated but lives in `@beep/nlp-processing`, outside this goal's Target Surfaces — flagged as a follow-up, not silently added. Tier-gate: neither `StreamingToolkit` nor `M365Toolkit` has any write/destructive tool; `NlpToolkit`'s `CreateCorpus`/`LearnCorpus`/`DeleteCorpus`/`LearnCustomEntities` ARE stateful, but gating them safely requires `Tool.Destructive` annotations that live in the out-of-scope `nlp-processing` package (an unannotated tool defaults to `destructive:true` in the kit's `TierGate`, so gating without those annotations would break every existing read tool) — recorded as **not applicable to this goal**, not invented. |
| P1 Implement | complete | Adopt the kit's `SanitizedSpan` wrapper and `ToolAnnotations` helper in both hosts per `SPEC.md` deliverables; apply the tier-gate wrapper only if P0 found a genuine target. | Deliverable #1/#2 required adding one new kit export, `sanitizedToolkit` (`packages/foundation/capability/mcp-kit/src/SanitizedSpan.ts`) — a drop-in `McpServer.toolkit` replacement mirroring upstream's `registerToolkit` registration loop but wrapping `built.handle(...)` in `withSanitizedToolSpan`; this was the only point proven (empirically, via a throwaway scratch script) to suppress the leak regardless of when/how the closure is later invoked. `nlp-mcp/src/Server.ts` and `m365-mcp/src/Server.ts` now use `sanitizedToolkit` in place of `McpServer.toolkit`. Deliverable #3: all 17 `StreamingToolkit` tools now carry `annotateFourHints(..., readOnlyToolHints)` (judged per-tool: all are read/count/filter/load operations, none write/mutate). Deliverable #4: `M365Tools.ts`'s 11 inline `.annotate(Tool.Readonly,...)` chains replaced mechanically with `annotateFourHints(..., readOnlyToolHints)`, identical hint values preserved. Deliverable #5 (tier-gate): not applicable, per the P0 finding above. Deliverable #6: `@beep/mcp-kit/README.md` consumer table now lists `nlp-mcp`/`m365-mcp` as **Landed**. |
| P2 Verify | complete | Run required checks and capture evidence. | `bunx tsgo -b`, `biome check`, `bun run beep docgen local` (both packages + mcp-kit), and `TURBO_FORCE=1 bunx turbo run check test lint --filter=@beep/mcp-kit --filter=@beep/nlp-mcp --filter=@beep/m365-mcp` all green. New proof tests: `mcp-kit/test/SanitizedToolkit.test.ts` (2 tests, fixture toolkit through real `McpServer.callTool`), `nlp-mcp/test/SanitizedSpan.test.ts` (1 test, real `NlpToolkit`/`WinkNlpToolkitLive`), `m365-mcp/test/SanitizedSpan.test.ts` (1 test, real `M365Toolkit`/`M365ToolkitHandlersLive`) — all assert `parameters` is absent from captured span attributes while `tool` is present, with dispatch happening in a separately-built effect from registration (mirrors real stdio-loop timing). Existing `nlp-mcp`/`m365-mcp` test suites (12 tests) pass unchanged. |
| P3 Yeet: PR to mergeable | complete (deviated) | Drive the shared-branch PR to mergeable via `/yeet` (coordinated with `uspto-mcp`). | **Actual outcome differs from plan:** `bun run beep yeet repair` + `bun run beep yeet verify` were green locally, then the user merged the shared branch directly into `origin/main` — a deliberate user decision, not the standard `/yeet publish --pr` path. No PR was opened for this packet. Two pre-existing-on-main red categories were observed around this window and recorded as environment context, not goal debt: the repo-wide `@beep/schema` JSON-Schema `$ref`/decode-error identifier-rendering regression (see `goals/mcp-kit/history/2026-07-01-unrelated-failures.md`) and pre-existing `cspell` findings in the ontology package. |
| P4 Close | complete | Update `@beep/mcp-kit`'s README consumer table, write the closeout reflection, and final readiness. | Packet status and evidence updated 2026-07-02; closeout reflection at `history/reflections/2026-07-02-codex.md`; `bun run beep lint reflection-artifacts` passes. |

## P3/P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained` /
`complete`):

1. [x] Write a closeout reflection via the `/reflect` skill (or copy
   `_template/history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo tooling,
   the implementation, and the goal/prompt. Frontmatter must validate against
   `ReflectionFrontmatter`. Done: `history/reflections/2026-07-02-codex.md`.
2. [x] Run `bun run beep lint reflection-artifacts` (`reflectionRequired: true`).
3. [x] Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status`.
4. [x] Confirm `@beep/mcp-kit`'s package README consumer table names both this
   goal's packages and `uspto-mcp` (coordinate with the `uspto-mcp` goal — the
   gate is only discharged once both consumers are in). Done: all three
   (`nlp-mcp`, `m365-mcp`, `uspto-mcp`) now show **Landed**.

### Closeout deviation record (2026-07-02)

This packet's completion gate (`ops/manifest.json` `completionGate`) declares
`requiresPullRequest: true`. The actual shipping path bypassed that: the user
verified the shared branch green locally (`yeet repair` + `yeet verify`) and
merged it directly into `origin/main` without opening a PR. This is recorded
honestly as a deliberate user decision, not silently marked as gate-satisfied
— see `ops/manifest.json`'s `completionGate.actualOutcome` field.

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- This goal shares a branch with `uspto-mcp`; sequence commits so each goal's
  changes stay reviewable independently (separate commits, not interleaved
  diffs).
- Deliverables #1/#2/#4 are mechanical (wrapper/helper adoption, no behavior
  change) — verify via unchanged test outcomes, not new test logic.
  Deliverable #3 requires per-tool judgment on hint values.
- Keep this plan current; archive old run outputs under `history/`.

## Verification Commands

```sh
test "$(wc -m < goals/mcp-host-retrofit/GOAL.md)" -le 4000
jq . goals/mcp-host-retrofit/ops/manifest.json
rg -n "mcp-host-retrofit|GOAL.md|agentLaunchers|packetAnchorDocument" goals/mcp-host-retrofit
git diff --check -- goals/mcp-host-retrofit
bun run beep yeet verify
```
