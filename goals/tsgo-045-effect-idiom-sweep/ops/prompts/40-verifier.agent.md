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
   `{{SHARD_PATHS}}`; `package.json`, `bun.lock`, `tsconfig*.json` are
   untouched.
2. **Diagnostics:** re-run the 0.45 compiler on the shard paths; every rule
   in the inventory reports zero for those paths. Paste the summary line.
3. **Directives:** `rg -n '@effect-diagnostics' {{SHARD_PATHS}}` returns
   nothing new. The two allowlisted files are `vitest.setup.ts` (outside
   every shard; S01 owns the sibling `vitest.shared.ts`) and
   `packages/tooling/test-kit/test-utils/src/FileSystemConformance.ts`
   (inside L07); each is the only permitted hit where it lives.
4. **Canon:** in test files, `rg -n 'Effect\.runSync\(\s*S(chema)?\.decode'`
   returns nothing; decodes go through `it.effect`.
5. **Behavior:** sample five rewritten sites against the card's "When NOT to
   rewrite" rows; for each, state why the rewrite is behavior-preserving or
   flag it.
6. **Handoff:** the report's `verify` section names `package-verify` for
   every touched package and the status lines say passed. Re-run one at
   random and compare.
7. **Residuals:** every residual has a reason that maps to a card row or a
   named card gap.

## Output

`ops/inventory/{{SHARD_ID}}.verdict.md`: PASS or FAIL, then the seven checks
with the command and the exact output line each relied on, then flagged
sites. Print the verdict line on stdout.
