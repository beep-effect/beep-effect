# GOAL: ship the @beep/openai driver

Repo root: the current working directory — the `beep-effect` checkout you are
running in. Do not assume an absolute path; several checkouts exist. All paths
below are repo-relative.

Outcome: a new packages/drivers/openai workspace named `@beep/openai` that
composes `@effect/ai-openai` 4.0.0-rc.112 behind typed config and errors and
exposes Layer factories for `OpenAiLanguageModel` and `OpenAiEmbeddingModel`;
no engine code.

This is a compact `/goal` launcher. Treat the packet files as the detailed
contract:

- `goals/openai-driver/README.md`
- `goals/openai-driver/SPEC.md`
- `goals/openai-driver/PLAN.md`
- `goals/openai-driver/ops/manifest.json`
- `goals/openai-driver/research/SOURCES.md`

Read those first, then `AGENTS.md`, `CLAUDE.md`,
`standards/architecture/03-driver-boundaries.md`, and
`explorations/semantica-lab/DECISIONS.md` (S3, S3-rev, M3). Higher-priority
repo standards outrank packet prose when they conflict.

Scope:

- In: the scaffolded driver workspace (`src/`, `test/`, `docs/`, package
  files), the generated `@beep/identity` composer, synced tsconfig / fallow /
  lint-policy artifacts, one changeset, this packet's evidence.
- Out: any lab code; Venice/xAI embeddings; local/ONNX models; `apiUrl` or
  organization knobs; changes to `@beep/anthropic` or `@beep/openai-compat`.

Workflow:

1. Verify the composition facts in `SPEC.md` against
   `.repos/effect/packages/ai/openai/src` (`OpenAiEmbeddingModel.model()`
   provides `Dimensions`, `.layer()` does not; both need `OpenAiClient`);
   pick default model ids from the reference `Model` unions (SPEC D6).
2. Scaffold with
   `bun run beep create-package openai --family drivers --description "Product-neutral Effect driver for OpenAI."`
   — never `mkdir`.
3. Mirror `packages/drivers/anthropic/src` role files (config, errors,
   service; no repair): `S.Class` options, `OpenAiLive` from
   `OpenAiClient.layerConfig` + `FetchHttpClient`, env-driven `*Live` Layers
   over `AI_OPENAI_API_KEY` / `AI_OPENAI_MODEL` / `AI_OPENAI_EMBEDDING_MODEL`.
   Dimensions is an explicit `PosInt` option, never an env default.
4. Tests over a stubbed `HttpClient` (pattern:
   `packages/drivers/openai-compat/test/OpenAiCompat.language-model.test.ts`)
   plus the anthropic wire-shape / round-trip / equivalence suite.
5. JSDoc every export with titled `**Example**` sections; add the changeset;
   run the Verification block below.
6. Yeet: publish, monitor to `merge-ready: yes`, resolve every thread.
7. At P4 Close, write `history/reflections/<YYYY-MM-DD>-<agent>.md` via
   `/reflect`; `bun run beep lint reflection-artifacts` must pass; flip status
   in the same PR.

Acceptance:

- [ ] `SPEC.md` acceptance criteria are satisfied (incl. the `Dimensions`
      via `.model()` test).
- [ ] Required verification commands pass, or unrelated failures are
      attributed and recorded separately.
- [ ] No unrelated refactors or formatting churn.

Verification:

```sh
test "$(wc -m < goals/openai-driver/GOAL.md)" -le 4000
jq . goals/openai-driver/ops/manifest.json
git diff --check -- goals/openai-driver
bun run docgen:local -- --full
bun run beep yeet verify
```

Stop and report before adding provider knobs beyond the API key, touching
sibling drivers or labs, adding dependencies other than the workspace's own,
or when verification would need a live key.

Done only when acceptance passes and the PR is mergeable, or when a blocker is
reported with file/command evidence.
