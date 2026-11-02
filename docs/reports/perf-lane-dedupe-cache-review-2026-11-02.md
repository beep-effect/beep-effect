# Cache baseline review: yeet lane dedupe and the schema-catalog root task (2026-11-02)

Branch `claude/perf-lane-dedupe-ded292`. The re-record covers the one subject
`bun run beep quality cache-policy` reported as drifted: the root `//` (65
`configuration-drift` findings over every root task and seal, two
`unreviewed-expansion` findings, one `configuration-source-drift` on `turbo.json`).

## What changed

- **`turbo.json`** adds `//#lint:schema-catalog`, a cached root task with declared
  inputs (the schema-first source globs `apps/**/*.{ts,tsx}`, `packages/**/*.{ts,tsx}`,
  `infra/{src,test}/**/*.ts`, every `package.json` the owner resolver reads, the root
  `tsconfig.json`, the committed shards `standards/schema-catalog/**/*.generated.jsonc`
  and the retired `standards/schema-catalog.generated.jsonc`; `docs`, `node_modules` and
  `.claude/worktrees` excluded), no outputs, one seal edge. The audit records it as
  `unreviewed-expansion`. The yeet cheap-gates lane `lint:schema-catalog` now runs this
  task instead of the direct CLI (`bun run beep lint schema-catalog`), which never cached
  (24.9 s per cheap-gates run in the proof ledger).
- **`//#lint:policy-fingerprint:lint-schema-catalog`** is the generated seal for that
  task, written by `bun run beep lint policy-fingerprint --write`
  (`standards/policy-tools.fingerprint.json` gains the `lint-schema-catalog` key). The
  audit records it as the second `unreviewed-expansion`.
- **Root `package.json`** adds the scripts `lint:schema-catalog`
  (`bun run beep lint schema-catalog`) and `lint:policy-fingerprint:lint-schema-catalog`
  (`true`). The root manifest scripts digest changes, so every root task and seal
  drifts (`configuration-drift`); no command, input pattern, output pattern, cache flag
  or environment key of any existing root task changed.

No workspace package manifest changed. The yeet plan edits in `@beep/repo-cli` (cheap-gates
`lint:effect-vitest` on its existing cached root task, `quality test-tsgo` owned by the
lint-policy plan only, `quality:cache-policy` in cheap-gates only, the `quality:shadcn-lint`
pre-push lane retired) do not touch a Turbo task definition.

## Unchanged

`scope`, `profile` and `epoch` are copied from the current baseline. This review records
the legacy posture of the root subject only. It grants no qualification, widens no
qualification scope, and adds no exception row.

## Reversal

Remove the `//#lint:schema-catalog` task and the two root scripts, run
`bun run beep lint policy-fingerprint --write` to drop the seal, return the cheap-gates
lane to the direct CLI step, then re-record the root subject.
