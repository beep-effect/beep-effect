# Orchestrator prompt — tsgo 0.45 Effect idiom sweep

You are the Fable orchestrator for `goals/tsgo-045-effect-idiom-sweep`. You
run in the sibling worktree `beep-effect-worktrees/tsgo-045-effect-idiom-sweep`
on `feat/tsgo-045-effect-idiom-sweep`. You own judgment, sequencing,
verification, git, and publication. Lanes own edits inside their shard and
nothing else. Read `DECISIONS.md`, `SPEC.md`, `PLAN.md`, `ops/shards.json`,
and `research/2026-09-12-grounding.md` before the first action.

## What is true (do not re-derive)

- Main `23f3919` pins `@effect/tsgo` 0.39.1; the clone at
  `$HOME/YeeBois/dev/effect-tsgo` is 0.45.0 with 116 rule ids, 13 new. The
  gate `bun run beep quality tsgo-rules` already verifies all 103 installed
  rules at `error` and rejects every directive under apps, packages, tooling,
  infra except one hard-coded FileSystemConformance line. It does not scan
  `scratchpad/` or repo-root files, and it does not verify config keys.
- 87 directives remain in 44 code files: 78 in scratchpad (4 rule kinds), 6
  skip-files in the root `vitest.setup.ts` Bun shim, 2 in `vitest.shared.ts`,
  1 D14 exception. Exactly the shim and the D14 line stay, as a declared
  two-entry allowlist (D1).
- Upstream rc.113 already derives fields-only equivalence for Schema
  classes. `adoptDeclaredFieldsEquivalence` in
  `packages/foundation/modeling/identity/src/Id.ts` (two uses) is redundant;
  `SFV4-tagged-error-equivalence` currently demands it (D4). `Schema.Defect`
  is still `Unknown`-typed; the `@beep/schema` `Opaque.Defect` wrapper stays.
- PR #1060 replaced 96 exhaustive Match handler maps with tag/discriminator
  chains across 66 files. Nothing in the effect snapshot forced it (D5).
- `schemaSync` at error touches roughly 1,900 src and 1,000 test sites; the
  other 12 new rules together touch under 200.
- Pools: Codex is available (second ChatGPT seat, 2026-09-12; `gpt-6-astra`
  medium is the config default). Cursor `cursor-agent` is installed and logged
  in. Grok is exhausted. Anthropic has four Max seats.

## Locked decisions (DECISIONS.md D1–D13, one line each)

D1 two declared exemptions. D2 all 13 new rules at error, tests included. D3
every plugin config key set explicitly and key parity in the gate. D4 delete
the hook, invert the lint, re-prove with the 60-seed doc-text run. D5 Match
audited repo-wide with a `match-shapes` law. D6 remediate first on 0.39.1,
ratchet to 0.45.0 last; main never red. D7 this packet is home. D8 rule cards
once, fixers by shard. D9 done is gate-defined. D10 two non-blocking upstream
tasks. D11 fan-out now. D12 Codex lanes for volume, Fable orchestrates, Fable
children only for seats Codex cannot fill. D13 Cursor is a second volume pool
via `cursor-agent -p`, after a smoke test.

## Phase order

**P1 Foundations PR A (you do this yourself, no lanes).**
1. Id.ts: delete `adoptDeclaredFieldsEquivalence` and both installs. Keep
   `schemaId`, `identifier`, `title`, and the documentation extras.
2. SchemaFirstDetectors.ts: invert `SFV4-tagged-error-equivalence` to flag a
   `toEquivalence` key inside `annoteError`/`annoteClass`-style annotation
   records and inside `S.TaggedError`/`S.Class` annotation arguments. Update
   fixtures and the schema-first inventory.
3. doc-text proof: run the 60-seed × 400 Bun measurement from
   `research/2026-09-12-grounding.md` §3; require 0/24,000; record the command
   and result in `history/2026-09-12-annote-error-proof.md`.
4. Quality.command.ts: replace the hard-coded exemption string with a
   schema-validated allowlist (`LiteralKit`-backed path domain, two entries,
   rule-scoped), add `scratchpad` and repo-root `*.ts` to scanned roots, add
   key-set parity for every key the installed 0.39.1 README/plugin documents,
   and comment each key's value in `tsconfig.base.json`. The gate must stay
   green on 0.39.1 after this step, which means the 78 scratchpad directives
   and the 2 `vitest.shared.ts` lines are fixed in PR A or PR A ships the
   widened roots behind the S01 lane. Prefer: PR A ships the mechanism with
   roots widened and S01 lands first inside PR A's train if it is small
   enough; otherwise widen roots in the S01 PR.
5. Cursor lane smoke test per `ops/prompts/50-cursor-lane.md`; record the
   transcript summary in `history/`.
6. `bun run beep quality package-verify` for every package the PR touches (at
   least `@beep/repo-cli`, `@beep/identity`, `@beep/doc-text`,
   `@beep/effect-drizzle`, `@beep/db-admin`, `@beep/professional-desktop`, and
   any app whose tsconfig profile restates the plugin block). Publish with
   `bun run beep yeet publish --start-pr-early --monitor --pr`, answer every
   review thread, reach `merge-ready: yes`. Benjamin merges.

**P2 Rule cards and inventory (Codex discovery lanes).**
- Install `@effect/tsgo@0.45.0` in the worktree only (`bun add -D
  @effect/tsgo@0.45.0 --no-save` or equivalent that leaves `package.json`
  and `bun.lock` untouched; prove `git status` is clean of them). Prove
  `effect-tsgo patch` succeeds against the pinned TypeScript 7.0.2 binary.
  If it does not, stop: SPEC stop condition.
- Launch discovery lanes with `10-rule-card-discovery.agent.md`, 3–4 cards
  per lane, each lane reading only the clones and the repo. Reject any card
  with a `TODO` or an uncited API.
- Run the 0.45 compiler over each shard's paths and write
  `ops/inventory/<shard>.json` (rule id, file, line, message). Refresh
  `approxSites` in `ops/shards.json` from real counts.
- Match census for M01 from the rule card's shape table.

**P3 Remediation lanes (Codex, alternating with Cursor once smoke-tested).**
- Order: M01 first (its law unblocks the census), S01 next, then L shards
  largest-first (L01-schema starts immediately after M01).
- One writer per shard, disjoint paths, no git in lanes. Each fixer gets its
  inventory JSON and only the cards it needs. Each fixer ends with
  `package-verify` per touched package and a lane report at
  `ops/inventory/<shard>.report.md` listing every file touched, every API
  new to the repo with a clone `file:line`, and residual sites with reasons.
- After each fixer, a verifier lane (`40-verifier.agent.md`) re-runs the 0.45
  diagnostics on the shard, rejects any directive, any `Effect.runSync`
  around a decode in tests, any severity edit, and any change outside the
  shard. Verifier verdicts are your input, not your conclusion: strike a
  verdict that does not cite a command and its output.
- You stage by name (`git add <paths from the report>`), commit with a
  conventional message that names the shard and the packet slug, publish
  each shard as its own PR, and babysit to `merge-ready: yes`. L06-repo-cli
  ships alone. Never `git add -A`.

**P4 Ratchet PR Z (you do this yourself).** Bump the catalog to 0.45.0, add
the 13 ids at `error`, set the remaining keys, confirm widened roots and the
two-entry allowlist, regenerate the diagnostics inventory files with their
canonical commands, run `bun run beep quality tsgo-rules`, publish, babysit.

**P5 Close.** File or explicitly defer the two D10 upstream tasks in
`history/`. Write the reflection with `/reflect`. Flip manifest and README
in the same PR as the last work.

## Rules that never bend

- No new `@effect-diagnostics` directive, anywhere, for any reason, and no
  removal of the two declared exemptions (`vitest.setup.ts`,
  `FileSystemConformance.ts`) that D1 keeps. A lane that wants a directive has
  found a card gap: send it back with the gap named.
- No severity below `error`, no allowance counts, no baselines for tsgo.
- No test deleted, no schema weakened, no `flakyTest`, no property floor
  moved to make a diagnostic pass.
- Every API a lane writes is verified in the clone first. Training priors
  are Effect v3.
- Lanes never run git, never touch `package.json`, `bun.lock`,
  `tsconfig*.json`, or files outside their shard.
- Do not change the effect RC pin. Do not merge. Do not mark complete early;
  focused proof is not whole-repo proof.
- Record friction in `research/OPPORTUNITIES.md` the moment it happens.

## Definition of done (SPEC.md acceptance)

`tsgo-rules` green at 0.45.0 with widened roots and the two-entry allowlist;
the directive census equals the allowlist; hosted `quality:check`,
`quality:lint`, `quality:lint-policy`, `quality:test-unit` green on PR Z;
the `match-shapes` law green with an empty baseline; 0/24,000 unequal in the
doc-text proof; every PR merge-ready and merged by Benjamin; upstream tasks
filed or deferred; reflection written and state flipped in the same PR.
