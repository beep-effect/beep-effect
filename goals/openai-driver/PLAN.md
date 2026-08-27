# OpenAI Driver (@beep/openai) Plan

## Status

Status: `active`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | completed | Verify the `@effect/ai-openai` rc.112 surface against the Effect reference checkout, pick default model ids, and confirm the scaffold command. | Composition facts in `SPEC.md` re-verified; default ids recorded in the decision log; no blockers. |
| P1 Implement | completed | Scaffold via `bun run beep create-package openai --family drivers`, write config, service, tests, docs, and the changeset. | `SPEC.md` acceptance criteria are met locally. |
| P2 Verify | active | Run package tests, `bun run docgen:local -- --full`, governance gates, and `bun run beep yeet verify`. | Verification is green or blockers are attributed and documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## P0 Research checklist

1. Read `SPEC.md`, then DECISIONS S3 / S3-rev / M3 and BRIEF rabbit holes 4-6
   in the source exploration.
2. Open `.repos/effect/packages/ai/openai/src/OpenAiEmbeddingModel.ts`,
   `OpenAiLanguageModel.ts`, and `OpenAiClient.ts`; confirm `.model()` vs
   `.layer()`, the `layerConfig` option set, and the `Model` unions.
3. Read `packages/drivers/anthropic/src` and `packages/drivers/anthropic/test`
   for the role-file and test shape; read
   `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts`
   for the stubbed `HttpClient` layer.
4. Pick the default language and embedding model ids; record them in the
   `SPEC.md` decision log (D6).

## P4 Closeout Checklist

Before marking the packet closed (and `status` → `completed-retained`):

1. Write a closeout reflection via the `/reflect` skill (or copy
   `history/reflections/_TEMPLATE.md`) to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Critique the repo **tooling**
   (what worked, what didn't, what was frustrating, what you wished existed), the
   **implementation** (improvement opportunities), and the **goal/prompt** (would
   you revise it to be clearer/easier/more efficient?). Capture TODOs worth
   codifying. Its YAML frontmatter must validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts` (this packet has
   `reflectionRequired: true`, so a missing/invalid reflection blocks closeout).
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses + `initiative.status` in the same PR as the final work.

## Execution Notes

- Preserve unrelated worktree changes; never `git add -A`.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- The driver PR runs beside the lab's C0 work; do not couple it to the lab.

## Verification Commands

```sh
test "$(wc -m < goals/openai-driver/GOAL.md)" -le 4000
jq . goals/openai-driver/ops/manifest.json
rg -n "openai-driver|GOAL.md|agentLaunchers|packetAnchorDocument" goals/openai-driver
git diff --check -- goals/openai-driver
bun run beep goals index --check
bun run beep goals doctor
bun run docgen:local -- --full
bun run beep yeet verify
```
