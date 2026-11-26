# Comment Law Sweep Plan

## Status

Status: `in-progress`

## Phases

| Phase | Status | Goal | Exit criteria |
| --- | --- | --- | --- |
| P0 Research | complete | Inspect source hierarchy and confirm scope. | Required facts and blockers are recorded. |
| P1 Implement | in-progress | Make the smallest changes that satisfy `SPEC.md`. | Acceptance criteria are met. |
| P2 Verify | pending | Run required checks and capture evidence. | Verification is green or blockers are documented. |
| P3 Yeet: PR to mergeable | pending | Publish through yeet and drive the PR to mergeable: required checks green, review comments answered and resolved. | `mergeStateStatus` is `CLEAN`; zero unresolved review threads. |
| P4 Close | pending | Write the closeout reflection and flip packet state. | Packet status and evidence are updated; a closeout reflection exists. |

## Closeout Checklist

Before marking the packet closed:

1. Write a closeout reflection via the `/reflect` skill to
   `history/reflections/<YYYY-MM-DD>-<agent>.md`. Its YAML frontmatter must
   validate against `ReflectionFrontmatter`.
2. Run `bun run beep lint reflection-artifacts`.
3. Update `README.md` (status, latest evidence) and `ops/manifest.json` phase
   statuses. Once the final PR is open, run
   `bun run beep goals set-status comment-law-sweep completed-retained`: it writes
   `closeout` naming that PR with the matching `initiative.status`, and the
   commit ships in the final PR. After the merge,
   `bun run beep goals completion refresh --slug comment-law-sweep` must print verified;
   name any red required check in a committed decision file
   (`redAttribution`).

## Execution Notes

- Preserve unrelated worktree changes.
- Keep `SPEC.md` normative and update it only when the contract changes.
- Keep this plan current; archive old run outputs under `history/`.
- Status checkpoints are `kind: checkpoint` files under `decisions/`
  (`bun run beep goals decisions add comment-law-sweep --kind checkpoint ...`),
  rendered into the Checkpoints block at the end of this plan.

## Verification Commands

```sh
test "$(wc -m < goals/comment-law-sweep/GOAL.md)" -le 4000
jq . goals/comment-law-sweep/ops/manifest.json
rg -n "comment-law-sweep|GOAL.md|agentLaunchers|packetAnchorDocument" goals/comment-law-sweep
git diff --check -- goals/comment-law-sweep
```

## Checkpoints

<!-- beep:decisions:begin -->
_Generated from [`decisions/`](./decisions/) by `bun run beep goals decisions write --slug comment-law-sweep`; add a `kind: checkpoint` file there, never edit this block._

### Hold new Opus author launches while the only Claude account with quota sits at its 50% floor, 2026-11-23

On 2026-11-23 benjamintoppold read 50% left with every other Claude account's week used up, Codex Sol has no admissible account until 11-24 13:41, and Cursor's Opus pool is empty, so no author route exists. The parent ruled: no new Opus children (the yaml lexer.ts pilot included); Grok classifier-B and verifier work, the lane owner's own proofs, merge-gate work and PR opens continue.

Lane goals/comment-law-sweep-w9a

Reverse: Lift when any other Claude account resets (first boppold, about 2026-11-26 02:00Z) or benjamintoppold reads above 50% left in beep accounts status.

### Wave plan from the 2026-11-26 census: 45,018 rows in 71 waves, 2026-11-26

Census of banned, unprotected comment rows on `main` at 0f38678788 (2026-11-26, after #3576), from `beep laws comments --ledger` run on every pending shard. It is the progress denominator for the sweep closeout.

- **Total:** 45,018 rows. That is the root shard, which spans the whole repository.
- **Package scopes:** 44,794 rows across 176 non-empty scopes.
- **Root-level files:** 224 rows in files outside every package scope. They join wave 49.
- **Earlier census:** the 11-23 census counted about 54k rows. The difference is the waves merged since then.

Wave rules:

- Each wave is about 800 rows or fewer, and a package larger than that is split into parts.
- A package with 300 or more rows gets its own wave.
- Smaller packages share multi-package waves grouped by family, so that one PR per package does not use up the three-PR cap and the review windows.
- Order follows risk. First come repo-workspaces and the yaml tests. Markdown and github-actions are interleaved with the solo packages and the tail. repo-cli comes last.

Within a split package, the part boundaries are drawn by file when the wave starts, so each part row count is an estimate.

## Waves

| # | Wave | Rows | Scopes |
| ---: | --- | ---: | --- |
| 1 | repo-workspaces tests part 2 (w14) | 683 | `packages/tooling/library/repo-workspaces` |
| 2 | repo-workspaces tests part 3 (w15) | 817 | `packages/tooling/library/repo-workspaces` |
| 3 | yaml tests part 1/2 | 437 | `packages/foundation/modeling/yaml` |
| 4 | yaml tests part 2/2 | 437 | `packages/foundation/modeling/yaml` |
| 5 | markdown part 1/4 | 685 | `packages/foundation/modeling/markdown` |
| 6 | professional-desktop part 1/2 | 555 | `apps/professional-desktop` |
| 7 | professional-desktop part 2/2 | 555 | `apps/professional-desktop` |
| 8 | git part 1/2 | 490 | `packages/drivers/git` |
| 9 | git part 2/2 | 490 | `packages/drivers/git` |
| 10 | memfs part 1/2 | 418 | `packages/tooling/test-kit/memfs` |
| 11 | memfs part 2/2 | 418 | `packages/tooling/test-kit/memfs` |
| 12 | markdown part 2/4 | 685 | `packages/foundation/modeling/markdown` |
| 13 | technical-drawing | 776 | `packages/foundation/capability/technical-drawing` |
| 14 | occt | 761 | `packages/drivers/occt` |
| 15 | lockfiles | 751 | `packages/foundation/modeling/lockfiles` |
| 16 | package-json | 727 | `packages/foundation/modeling/package-json` |
| 17 | cli-kit | 663 | `packages/foundation/capability/cli-kit` |
| 18 | github | 643 | `packages/drivers/github` |
| 19 | markdown part 3/4 | 685 | `packages/foundation/modeling/markdown` |
| 20 | agent-memory-store | 500 | `packages/tooling/library/agent-memory-store` |
| 21 | xlsx | 455 | `packages/foundation/modeling/xlsx` |
| 22 | config-file | 436 | `packages/foundation/capability/config-file` |
| 23 | use-cases | 429 | `packages/law-practice/use-cases` |
| 24 | acp | 392 | `packages/drivers/acp` |
| 25 | sbom | 391 | `packages/foundation/modeling/sbom` |
| 26 | markdown part 4/4 | 685 | `packages/foundation/modeling/markdown` |
| 27 | domain | 375 | `packages/law-practice/domain` |
| 28 | duckdb | 359 | `packages/drivers/duckdb` |
| 29 | editor | 337 | `packages/foundation/ui-system/editor` |
| 30 | ciops | 300 | `apps/labs/ciops` |
| 31 | tail: apps 1/2 | 784 | `apps/practice-kg-mcp`, `apps/oip-web`, `apps/docket-intake`, `apps/practice-setup`, `apps/practice-gateway`, `apps/labs/semantica`, `apps/storybook`, `apps/practice-claude-mod`, `apps/practice-review-hub` |
| 32 | github-actions part 1/3 | 539 | `packages/drivers/github-actions` |
| 33 | tail: apps 2/2 + infra + packages/_internal + packages/agents + packages/architecture-lab | 628 | `apps/labs/lane-cockpit`, `apps/practice-mail-tagging`, `apps/beep-effect-web`, `apps/labs/api-docs`, `apps/labs/lejeune-bolt-workbench`, `apps/todox`, `apps/practice-m365-contacts`, `apps/practice-identify`, `apps/labs/trustgraph-workbench`, `infra`, `infra/lambda/turbo-cache`, `packages/_internal/db-admin`, `packages/agents/client`, `packages/agents/server`, `packages/agents/use-cases`, `packages/agents/domain`, `packages/agents/tables`, `packages/architecture-lab/server`, `packages/architecture-lab/tables` |
| 34 | tail: packages/documents | 281 | `packages/documents/server`, `packages/documents/use-cases`, `packages/documents/tables`, `packages/documents/domain` |
| 35 | tail: packages/drivers 1/3 | 636 | `packages/drivers/commands`, `packages/drivers/alchemy-postgres`, `packages/drivers/m365-mcp` |
| 36 | tail: packages/drivers 2/3 | 781 | `packages/drivers/pdf-tools`, `packages/drivers/libpff`, `packages/drivers/runpod`, `packages/drivers/box`, `packages/drivers/graph-3d`, `packages/drivers/tika`, `packages/drivers/box-provisioning`, `packages/drivers/m365`, `packages/drivers/cosmos` |
| 37 | tail: packages/drivers 3/3 + packages/ecosystem | 641 | `packages/drivers/ffmpeg`, `packages/drivers/obs`, `packages/drivers/doc-text`, `packages/drivers/freshbooks`, `packages/drivers/exiftool`, `packages/drivers/postgres`, `packages/drivers/uspto-mcp`, `packages/drivers/wink`, `packages/drivers/nlp-mcp`, `packages/drivers/pacer`, `packages/drivers/windows-secrets`, `packages/drivers/uspto`, `packages/drivers/gov-legal-mcp`, `packages/drivers/pglite`, `packages/drivers/tailscale`, `packages/drivers/openclaw`, `packages/drivers/xstate`, `packages/drivers/tesseract`, `packages/drivers/ai-provider-cli`, `packages/drivers/poppler`, `packages/drivers/pretext`, `packages/drivers/rdf-canonize`, `packages/drivers/drizzle`, `packages/drivers/openai-compat`, `packages/drivers/sanity`, `packages/drivers/sqlite`, `packages/drivers/firecrawl`, `packages/drivers/hubspot`, `packages/drivers/openai`, `packages/drivers/phoenix`, `packages/drivers/ecfr`, `packages/drivers/govinfo`, `packages/drivers/onepassword-cli`, `packages/drivers/shacl`, `packages/ecosystem/effect-drizzle` |
| 38 | github-actions part 2/3 | 539 | `packages/drivers/github-actions` |
| 39 | tail: packages/epistemic + packages/execution-authority | 534 | `packages/epistemic/server`, `packages/epistemic/tables`, `packages/epistemic/use-cases`, `packages/epistemic/domain`, `packages/epistemic/ui`, `packages/execution-authority/server`, `packages/execution-authority/domain`, `packages/execution-authority/tables`, `packages/execution-authority/config` |
| 40 | tail: packages/foundation/capability 1/2 | 746 | `packages/foundation/capability/walker`, `packages/foundation/capability/mcp-kit`, `packages/foundation/capability/runtime-env`, `packages/foundation/capability/nlp-processing` |
| 41 | tail: packages/foundation/capability 2/2 | 289 | `packages/foundation/capability/observability`, `packages/foundation/capability/xdg`, `packages/foundation/capability/langextract`, `packages/foundation/capability/file-processing`, `packages/foundation/capability/api-transport`, `packages/foundation/capability/semantic-web`, `packages/foundation/capability/chalk` |
| 42 | tail: packages/foundation/modeling + packages/foundation/primitive | 647 | `packages/foundation/modeling/github-reporting`, `packages/foundation/modeling/schema`, `packages/foundation/modeling/lexical`, `packages/foundation/modeling/epistemics`, `packages/foundation/modeling/identity`, `packages/foundation/modeling/github-commands`, `packages/foundation/modeling/utils`, `packages/foundation/modeling/rdf`, `packages/foundation/modeling/ontology`, `packages/foundation/primitive/data` |
| 43 | tail: packages/foundation/ui-system + packages/law-practice | 636 | `packages/foundation/ui-system/dock-react`, `packages/foundation/ui-system/ui`, `packages/foundation/ui-system/dock`, `packages/foundation/ui-system/brand`, `packages/law-practice/tables` |
| 44 | github-actions part 3/3 | 539 | `packages/drivers/github-actions` |
| 45 | tail: packages/ontology + packages/party + packages/shared | 345 | `packages/ontology/client`, `packages/ontology/use-cases`, `packages/ontology/server`, `packages/ontology/ui`, `packages/ontology/config`, `packages/party/domain`, `packages/shared/domain`, `packages/shared/tables` |
| 46 | tail: packages/tooling/infra | 507 | `packages/tooling/infra/ci-runners`, `packages/tooling/infra/github`, `packages/tooling/infra/infra-hosts`, `packages/tooling/infra/turbo-cache`, `packages/tooling/infra/cost-controls` |
| 47 | tail: packages/tooling/library 1/2 | 713 | `packages/tooling/library/repo-cli-kit`, `packages/tooling/library/repo-utils`, `packages/tooling/library/repo-tsconfig` |
| 48 | tail: packages/tooling/library 2/2 | 693 | `packages/tooling/library/alchemy-github-runners`, `packages/tooling/library/qa-capture`, `packages/tooling/library/repo-gate-run`, `packages/tooling/library/alchemy-vercel`, `packages/tooling/library/palantiri`, `packages/tooling/library/codegen-kit`, `packages/tooling/library/alchemy-aws-extras`, `packages/tooling/library/repo-gate-record`, `packages/tooling/library/mcpb-kit`, `packages/tooling/library/ai-sync` |
| 49 | tail: packages/tooling/policy-pack + packages/tooling/test-kit + packages/tooling/tool + packages/workspace + tools | 511 | `packages/tooling/policy-pack/lint-rules`, `packages/tooling/policy-pack/repo-configs`, `packages/tooling/test-kit/repo-gate-vitest`, `packages/tooling/test-kit/test-utils`, `packages/tooling/test-kit/fc-runs`, `packages/tooling/test-kit/test-runner`, `packages/tooling/tool/docgen`, `packages/workspace/server`, `packages/workspace/use-cases`, `packages/workspace/tables`, `packages/workspace/domain`, `tools/tsgo-shim` |
| 50 | repo-cli part 1/22 | 794 | `packages/tooling/tool/cli` |
| 51 | repo-cli part 2/22 | 794 | `packages/tooling/tool/cli` |
| 52 | repo-cli part 3/22 | 794 | `packages/tooling/tool/cli` |
| 53 | repo-cli part 4/22 | 794 | `packages/tooling/tool/cli` |
| 54 | repo-cli part 5/22 | 794 | `packages/tooling/tool/cli` |
| 55 | repo-cli part 6/22 | 794 | `packages/tooling/tool/cli` |
| 56 | repo-cli part 7/22 | 794 | `packages/tooling/tool/cli` |
| 57 | repo-cli part 8/22 | 794 | `packages/tooling/tool/cli` |
| 58 | repo-cli part 9/22 | 794 | `packages/tooling/tool/cli` |
| 59 | repo-cli part 10/22 | 794 | `packages/tooling/tool/cli` |
| 60 | repo-cli part 11/22 | 794 | `packages/tooling/tool/cli` |
| 61 | repo-cli part 12/22 | 794 | `packages/tooling/tool/cli` |
| 62 | repo-cli part 13/22 | 794 | `packages/tooling/tool/cli` |
| 63 | repo-cli part 14/22 | 794 | `packages/tooling/tool/cli` |
| 64 | repo-cli part 15/22 | 794 | `packages/tooling/tool/cli` |
| 65 | repo-cli part 16/22 | 794 | `packages/tooling/tool/cli` |
| 66 | repo-cli part 17/22 | 794 | `packages/tooling/tool/cli` |
| 67 | repo-cli part 18/22 | 794 | `packages/tooling/tool/cli` |
| 68 | repo-cli part 19/22 | 794 | `packages/tooling/tool/cli` |
| 69 | repo-cli part 20/22 | 794 | `packages/tooling/tool/cli` |
| 70 | repo-cli part 21/22 | 794 | `packages/tooling/tool/cli` |
| 71 | repo-cli part 22/22 | 794 | `packages/tooling/tool/cli` |

## Pending scopes

| Scope | Rows | src | test | Wave |
| --- | ---: | ---: | ---: | --- |
| `packages/tooling/tool/cli` | 17473 | 9535 | 7938 | 50–71 |
| `packages/foundation/modeling/markdown` | 2738 | 1256 | 1482 | 5–26 |
| `packages/drivers/github-actions` | 1617 | 598 | 1019 | 32–44 |
| `packages/tooling/library/repo-workspaces` | 1500 | 3 | 1497 | 1–2 |
| `apps/professional-desktop` | 1110 | 696 | 414 | 6–7 |
| `packages/drivers/git` | 980 | 522 | 458 | 8–9 |
| `packages/foundation/modeling/yaml` | 874 | 13 | 861 | 3–4 |
| `packages/tooling/test-kit/memfs` | 835 | 498 | 337 | 10–11 |
| `packages/foundation/capability/technical-drawing` | 776 | 408 | 368 | 13 |
| `packages/drivers/occt` | 761 | 375 | 386 | 14 |
| `packages/foundation/modeling/lockfiles` | 751 | 192 | 559 | 15 |
| `packages/foundation/modeling/package-json` | 727 | 259 | 468 | 16 |
| `packages/foundation/capability/cli-kit` | 663 | 312 | 351 | 17 |
| `packages/drivers/github` | 643 | 273 | 370 | 18 |
| `packages/tooling/library/agent-memory-store` | 500 | 199 | 301 | 20 |
| `packages/foundation/modeling/xlsx` | 455 | 279 | 176 | 21 |
| `packages/foundation/capability/config-file` | 436 | 121 | 315 | 22 |
| `packages/law-practice/use-cases` | 429 | 224 | 205 | 23 |
| `packages/drivers/acp` | 392 | 251 | 141 | 24 |
| `packages/foundation/modeling/sbom` | 391 | 92 | 299 | 25 |
| `packages/law-practice/domain` | 375 | 256 | 119 | 27 |
| `packages/drivers/duckdb` | 359 | 154 | 205 | 28 |
| `packages/foundation/ui-system/editor` | 337 | 285 | 52 | 29 |
| `apps/labs/ciops` | 300 | 198 | 102 | 30 |
| `packages/tooling/library/repo-cli-kit` | 293 | 163 | 130 | 47 |
| `packages/drivers/commands` | 273 | 140 | 133 | 35 |
| `packages/foundation/ui-system/dock-react` | 273 | 216 | 57 | 43 |
| `packages/tooling/infra/ci-runners` | 259 | 164 | 95 | 46 |
| `infra` | 258 | 179 | 79 | 33 |
| `packages/foundation/ui-system/ui` | 256 | 254 | 2 | 43 |
| `packages/execution-authority/server` | 249 | 126 | 123 | 39 |
| `packages/foundation/capability/walker` | 244 | 56 | 188 | 40 |
| `packages/foundation/capability/mcp-kit` | 231 | 95 | 136 | 40 |
| `packages/tooling/library/repo-utils` | 219 | 127 | 92 | 47 |
| `apps/practice-kg-mcp` | 216 | 123 | 93 | 31 |
| `packages/foundation/modeling/github-reporting` | 212 | 62 | 150 | 42 |
| `packages/documents/server` | 210 | 107 | 103 | 34 |
| `packages/tooling/library/repo-tsconfig` | 201 | 85 | 116 | 47 |
| `packages/drivers/alchemy-postgres` | 195 | 99 | 96 | 35 |
| `packages/tooling/library/alchemy-github-runners` | 179 | 82 | 97 | 48 |
| `packages/foundation/modeling/schema` | 178 | 126 | 52 | 42 |
| `packages/drivers/m365-mcp` | 168 | 70 | 98 | 35 |
| `packages/tooling/policy-pack/lint-rules` | 166 | 82 | 84 | 49 |
| `packages/drivers/pdf-tools` | 166 | 86 | 80 | 36 |
| `packages/epistemic/server` | 164 | 37 | 127 | 39 |
| `packages/foundation/capability/runtime-env` | 161 | 90 | 71 | 40 |
| `packages/ontology/client` | 158 | 79 | 79 | 45 |
| `apps/oip-web` | 153 | 92 | 61 | 31 |
| `packages/tooling/library/qa-capture` | 124 | 74 | 50 | 48 |
| `packages/drivers/libpff` | 122 | 66 | 56 | 36 |
| `packages/tooling/library/repo-gate-run` | 119 | 56 | 63 | 48 |
| `packages/foundation/capability/nlp-processing` | 110 | 103 | 7 | 40 |
| `packages/foundation/capability/observability` | 106 | 55 | 51 | 41 |
| `packages/agents/client` | 105 | 81 | 24 | 33 |
| `packages/ecosystem/effect-drizzle` | 103 | 67 | 36 | 37 |
| `packages/_internal/db-admin` | 93 | 0 | 93 | 33 |
| `apps/docket-intake` | 93 | 46 | 47 | 31 |
| `packages/foundation/capability/xdg` | 87 | 21 | 66 | 41 |
| `packages/ontology/use-cases` | 86 | 50 | 36 | 45 |
| `packages/drivers/runpod` | 86 | 69 | 17 | 36 |
| `packages/drivers/box` | 84 | 63 | 21 | 36 |
| `packages/foundation/modeling/lexical` | 83 | 41 | 42 | 42 |
| `packages/tooling/test-kit/repo-gate-vitest` | 83 | 27 | 56 | 49 |
| `packages/tooling/infra/github` | 82 | 24 | 58 | 46 |
| `apps/practice-setup` | 80 | 58 | 22 | 31 |
| `packages/tooling/test-kit/test-utils` | 71 | 35 | 36 | 49 |
| `packages/tooling/library/alchemy-vercel` | 69 | 46 | 23 | 48 |
| `packages/tooling/infra/infra-hosts` | 69 | 34 | 35 | 46 |
| `apps/practice-gateway` | 67 | 45 | 22 | 31 |
| `packages/drivers/graph-3d` | 66 | 66 | 0 | 36 |
| `packages/drivers/tika` | 66 | 22 | 44 | 36 |
| `packages/drivers/box-provisioning` | 65 | 35 | 30 | 36 |
| `packages/drivers/m365` | 65 | 49 | 16 | 36 |
| `packages/drivers/cosmos` | 61 | 60 | 1 | 36 |
| `packages/foundation/capability/langextract` | 60 | 55 | 5 | 41 |
| `packages/tooling/library/palantiri` | 60 | 41 | 19 | 48 |
| `apps/labs/semantica` | 60 | 22 | 38 | 31 |
| `packages/drivers/ffmpeg` | 59 | 23 | 36 | 37 |
| `apps/storybook` | 59 | 59 | 0 | 31 |
| `packages/tooling/library/codegen-kit` | 55 | 44 | 11 | 48 |
| `packages/foundation/ui-system/dock` | 54 | 47 | 7 | 43 |
| `packages/tooling/infra/turbo-cache` | 51 | 25 | 26 | 46 |
| `packages/execution-authority/domain` | 48 | 13 | 35 | 39 |
| `packages/drivers/obs` | 47 | 19 | 28 | 37 |
| `packages/drivers/doc-text` | 46 | 28 | 18 | 37 |
| `packages/drivers/freshbooks` | 46 | 29 | 17 | 37 |
| `packages/tooling/infra/cost-controls` | 46 | 16 | 30 | 46 |
| `packages/tooling/tool/docgen` | 45 | 16 | 29 | 49 |
| `packages/foundation/primitive/data` | 41 | 41 | 0 | 42 |
| `packages/law-practice/tables` | 40 | 0 | 40 | 43 |
| `packages/agents/server` | 38 | 27 | 11 | 33 |
| `packages/documents/use-cases` | 38 | 30 | 8 | 34 |
| `packages/foundation/modeling/epistemics` | 38 | 21 | 17 | 42 |
| `packages/drivers/exiftool` | 36 | 25 | 11 | 37 |
| `packages/tooling/test-kit/fc-runs` | 36 | 12 | 24 | 49 |
| `packages/party/domain` | 36 | 12 | 24 | 45 |
| `packages/foundation/modeling/identity` | 34 | 34 | 0 | 42 |
| `packages/drivers/postgres` | 33 | 20 | 13 | 37 |
| `apps/practice-claude-mod` | 33 | 26 | 7 | 31 |
| `packages/ontology/server` | 31 | 14 | 17 | 45 |
| `packages/workspace/server` | 30 | 12 | 18 | 49 |
| `packages/tooling/library/alchemy-aws-extras` | 26 | 5 | 21 | 48 |
| `packages/foundation/modeling/github-commands` | 26 | 10 | 16 | 42 |
| `packages/tooling/policy-pack/repo-configs` | 26 | 14 | 12 | 49 |
| `packages/drivers/uspto-mcp` | 26 | 1 | 25 | 37 |
| `packages/drivers/wink` | 26 | 15 | 11 | 37 |
| `packages/documents/tables` | 25 | 0 | 25 | 34 |
| `packages/drivers/nlp-mcp` | 25 | 13 | 12 | 37 |
| `packages/tooling/library/repo-gate-record` | 25 | 11 | 14 | 48 |
| `packages/foundation/modeling/utils` | 25 | 19 | 6 | 42 |
| `packages/tooling/library/mcpb-kit` | 23 | 12 | 11 | 48 |
| `packages/drivers/pacer` | 23 | 21 | 2 | 37 |
| `apps/practice-review-hub` | 23 | 13 | 10 | 31 |
| `packages/drivers/windows-secrets` | 23 | 18 | 5 | 37 |
| `packages/epistemic/tables` | 21 | 0 | 21 | 39 |
| `packages/epistemic/use-cases` | 21 | 6 | 15 | 39 |
| `packages/foundation/capability/file-processing` | 21 | 15 | 6 | 41 |
| `packages/workspace/use-cases` | 21 | 6 | 15 | 49 |
| `apps/labs/lane-cockpit` | 18 | 14 | 4 | 33 |
| `packages/tooling/test-kit/test-runner` | 18 | 16 | 2 | 49 |
| `infra/lambda/turbo-cache` | 17 | 13 | 4 | 33 |
| `packages/shared/domain` | 17 | 9 | 8 | 45 |
| `apps/practice-mail-tagging` | 16 | 8 | 8 | 33 |
| `packages/drivers/uspto` | 16 | 16 | 0 | 37 |
| `packages/drivers/gov-legal-mcp` | 15 | 0 | 15 | 37 |
| `packages/ontology/ui` | 14 | 14 | 0 | 45 |
| `packages/drivers/pglite` | 14 | 7 | 7 | 37 |
| `packages/drivers/tailscale` | 14 | 8 | 6 | 37 |
| `packages/tooling/library/ai-sync` | 13 | 10 | 3 | 48 |
| `apps/beep-effect-web` | 13 | 13 | 0 | 33 |
| `packages/foundation/ui-system/brand` | 13 | 10 | 3 | 43 |
| `packages/agents/use-cases` | 12 | 5 | 7 | 33 |
| `packages/execution-authority/tables` | 12 | 0 | 12 | 39 |
| `packages/drivers/openclaw` | 12 | 1 | 11 | 37 |
| `apps/labs/api-docs` | 11 | 9 | 2 | 33 |
| `packages/drivers/xstate` | 11 | 7 | 4 | 37 |
| `packages/epistemic/domain` | 10 | 0 | 10 | 39 |
| `packages/drivers/tesseract` | 10 | 2 | 8 | 37 |
| `packages/agents/domain` | 9 | 9 | 0 | 33 |
| `apps/labs/lejeune-bolt-workbench` | 9 | 9 | 0 | 33 |
| `packages/drivers/ai-provider-cli` | 8 | 8 | 0 | 37 |
| `packages/documents/domain` | 8 | 5 | 3 | 34 |
| `packages/drivers/poppler` | 8 | 2 | 6 | 37 |
| `apps/todox` | 8 | 8 | 0 | 33 |
| `packages/drivers/pretext` | 7 | 6 | 1 | 37 |
| `packages/drivers/rdf-canonize` | 7 | 5 | 2 | 37 |
| `packages/foundation/modeling/rdf` | 7 | 6 | 1 | 42 |
| `packages/workspace/tables` | 7 | 0 | 7 | 49 |
| `packages/foundation/capability/api-transport` | 6 | 3 | 3 | 41 |
| `apps/practice-m365-contacts` | 6 | 3 | 3 | 33 |
| `tools/tsgo-shim` | 6 | 6 | 0 | 49 |
| `packages/architecture-lab/server` | 5 | 0 | 5 | 33 |
| `packages/execution-authority/config` | 5 | 0 | 5 | 39 |
| `packages/foundation/capability/semantic-web` | 5 | 3 | 2 | 41 |
| `packages/agents/tables` | 4 | 0 | 4 | 33 |
| `packages/foundation/capability/chalk` | 4 | 4 | 0 | 41 |
| `packages/drivers/drizzle` | 4 | 1 | 3 | 37 |
| `packages/epistemic/ui` | 4 | 3 | 1 | 39 |
| `packages/drivers/openai-compat` | 4 | 1 | 3 | 37 |
| `packages/foundation/modeling/ontology` | 3 | 3 | 0 | 42 |
| `apps/practice-identify` | 3 | 1 | 2 | 33 |
| `packages/drivers/sanity` | 3 | 2 | 1 | 37 |
| `packages/drivers/sqlite` | 3 | 0 | 3 | 37 |
| `packages/drivers/firecrawl` | 2 | 2 | 0 | 37 |
| `packages/drivers/hubspot` | 2 | 1 | 1 | 37 |
| `packages/ontology/config` | 2 | 0 | 2 | 45 |
| `packages/drivers/openai` | 2 | 0 | 2 | 37 |
| `packages/drivers/phoenix` | 2 | 1 | 1 | 37 |
| `apps/labs/trustgraph-workbench` | 2 | 1 | 1 | 33 |
| `packages/workspace/domain` | 2 | 2 | 0 | 49 |
| `packages/architecture-lab/tables` | 1 | 0 | 1 | 33 |
| `packages/drivers/ecfr` | 1 | 0 | 1 | 37 |
| `packages/drivers/govinfo` | 1 | 1 | 0 | 37 |
| `packages/drivers/onepassword-cli` | 1 | 0 | 1 | 37 |
| `packages/drivers/shacl` | 1 | 0 | 1 | 37 |
| `packages/shared/tables` | 1 | 1 | 0 | 45 |

Lane goals/comment-law-sweep-w14

Reverse: Replace this plan with a later census checkpoint; it records order and sizes only.

<!-- beep:decisions:end -->
