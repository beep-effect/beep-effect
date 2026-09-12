# Verifier lane — independently check one shard

You verify `{{SHARD_ID}}` after its fixer reported done. You change nothing.
Your verdict must cite commands and their output; an uncited verdict is
struck by the orchestrator.

## Inputs

- `ops/shards.json` entry, `ops/inventory/{{SHARD_ID}}.json` (before),
  `ops/inventory/{{SHARD_ID}}.report.md` (fixer report), the injected cards.
- The worktree with the local 0.45 install.

## Checks (all required)

1. **Scope:** `git status --porcelain` (read-only) shows only paths inside
   `{{SHARD_PATHS}}` plus the lane's own artifacts
   (`goals/tsgo-045-effect-idiom-sweep/ops/inventory/{{SHARD_ID}}.report.md`
   and your verdict file); `package.json`, `bun.lock`, `tsconfig*.json` are
   untouched.
2. **Diagnostics:** re-run the 0.45 compiler on the shard paths; every rule
   in the inventory reports zero for those paths. Paste the summary line.
3. **Directives:** run `bun run beep quality tsgo-rules` (it applies the
   allowlist predicate from `Quality.command.ts`: exact path and exact
   skip-file line) and require the `disabled Effect diagnostic directives`
   section to be absent. Then `rg -n '@effect-diagnostics' {{SHARD_PATHS}}`
   and compare against the two allowlisted files: `vitest.setup.ts` (outside
   every shard; S01 owns the sibling `vitest.shared.ts`) and
   `packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts`
   (inside L07). Any other hit is a rejection; the allowlisted hits are the
   only permitted ones where they live.
4. **Canon:** in test files, `rg -n 'Effect\.runSync\(\s*S(chema)?\.decode'`
   returns nothing; decodes go through `it.effect`.
5. **Behavior:** sample five rewritten sites against the card's "When NOT to
   rewrite" rows; for each, state why the rewrite is behavior-preserving or
   flag it.
6. **Handoff:** enumerate every workspace package that owns a touched path
   (`git status --porcelain` mapped to the nearest `package.json` name) and
   re-run `bun run beep quality package-verify <pkg>` for each one yourself;
   the report's status lines are not evidence. Paste each command's last
   line.
7. **Residuals:** every residual has a reason that maps to a card row or a
   named card gap.

## Output

`ops/inventory/{{SHARD_ID}}.verdict.md`: PASS or FAIL, then the seven checks
with the command and the exact output line each relied on, then flagged
sites. Print the verdict line on stdout.
