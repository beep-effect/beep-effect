# Fixer lane — remediate one shard

You are the **single writer for exactly one shard** of
`goals/tsgo-045-effect-idiom-sweep`. You fix every site in your shard's
inventory to the idiom in the injected rule cards, prove the shard is green,
and hand back a report. You never touch a path outside your shard.

## Inputs (injected)

- `{{SHARD_ID}}` and `{{SHARD_PATHS}}` from `ops/shards.json`.
- `{{INVENTORY}}` = `ops/inventory/{{SHARD_ID}}.json` (rule, file, line, message).
- `{{CARDS}}` = the rule cards for every rule id present in the inventory.
- Clones: effect `$HOME/YeeBois/dev/effect` (rc.115), tsgo
  `$HOME/YeeBois/dev/effect-tsgo` (0.45.0).
- The worktree has `@effect/tsgo@0.45.0` installed locally; `package.json`
  and `bun.lock` must stay untouched.

## Authority

`SPEC.md` and the cards outrank this prompt and your priors. Training priors
are Effect v3. Every API you write that is not already used in the shard is
re-verified in the clone and cited in your report.

## Procedure

1. Read the cards, then the inventory. Group sites by rule, then by file.
2. Fix mechanically where the card's before/after applies exactly. Where a
   site matches a "When NOT to rewrite" row, apply that row's fix instead.
   Where neither applies, leave the site, and record it under `residual`
   with the reason. Never add a directive, never change a severity, never
   delete a test or weaken a schema.
3. Match combinators are owned by lane M01. Do not rewrite `Match.*` calls
   unless your inventory names them under a tsgo rule.
4. Test files follow the effect-vitest canon: `it.effect` with
   `Schema.decodeUnknownEffect`/`encodeUnknownEffect`, never
   `Effect.runSync` around a decode.
5. After each package: `bun run beep quality package-verify <@beep/pkg>`
   (`--quick` only when you touched nothing but call sites). Re-run the
   0.45 diagnostics on the shard paths; the inventory's rules must report
   zero for your paths.
6. Do not run `git`. Do not format files you did not otherwise change.

## Output

Write `ops/inventory/{{SHARD_ID}}.report.md` with:

- `touched`: every file path.
- `fixedByRule`: counts per rule id.
- `newApis`: each API new to the shard with its clone `file:line`.
- `residual`: file, line, rule, reason.
- `verify`: the exact commands run and their final status lines.
- `gotchas`: anything the card missed (the orchestrator folds these back).

Print the report path and the `fixedByRule` table on stdout. Nothing else.
