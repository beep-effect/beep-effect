# Instance

- id: `r2-tooling-law-scan-strict-failure`
- file:line: `packages/tooling/tool/cli/src/commands/Laws/internal/LawScan.ts:79`
- symbol: `LawScanOptions` / `LawScanResult`
- members: `strictCheck`, `strictFailure`
- evidence class: E4 at `LawScan.ts:190-199` — `strictFailure` is true only when strict checking was requested and violations exist.

# Current shape

The input carries the CLI-derived `strictCheck` toggle. The shared scanner returns `strictFailure` after counting diagnostics. EffectFn and FrozenGrantSet copy the result into their exported decoded summary classes; command readers branch on that copied boolean.

# Cardinality gap

Across one scan, the two bits represent four combinations but strict failure without strict mode is impossible. The three actual outcomes are advisory, strict-clean, and strict-failure.

# Target schema

Define and export the one shared named schema owner from `LawScan.ts`. That
module first imports `$RepoCliId` from `@beep/identity/packages` and
`LiteralKit`, then creates its missing identity composer:

```ts
const $I = $RepoCliId.create("commands/Laws/internal/LawScan")

export const LawScanDisposition = LiteralKit(["advisory", "strict-clean", "strict-failure"]).pipe(
  $I.annoteSchema("LawScanDisposition", {
    description: "Whether a supplemental law scan was advisory, strict and clean, or a strict failure.",
  })
)
export type LawScanDisposition = typeof LawScanDisposition.Type
```

Keep `strictCheck` only in the boundary input. Replace
`LawScanResult.strictFailure` with `disposition`, derived once from
`strictCheck` and `violationCount`. EffectFn and FrozenGrantSet import and use
this exact schema in their decoded summary classes; later law designs also
reuse this owner. Command readers compare/match its `strict-failure` member.

# Migration inventory

- `LawScan.ts:10-18` — import `$RepoCliId` from `@beep/identity/packages` and `LiteralKit`, create `$I = $RepoCliId.create("commands/Laws/internal/LawScan")`, and export the annotated `LawScanDisposition` schema plus its decoded type. Do not duplicate this owner in a command module.
- `LawScan.ts:79-85` — retain input `strictCheck`; it is independent boundary intent.
- `LawScan.ts:152-159` — replace the result boolean with `disposition: LawScanDisposition`.
- `LawScan.ts:185-200` — derive the three-state disposition once after diagnostics are counted.
- `EffectFn.ts:14,137` and `FrozenGrantSet.ts:20,135` — value-import `LawScanDisposition` from `internal/LawScan.ts` with `runLawScan`, and replace each summary field's `S.Boolean` with that shared runtime schema. Migrate both modules' constructors, docs, and tests; do not create per-command aliases.
- `Laws.command.ts` EffectFn and FrozenGrantSet handlers — preserve exact exit behavior by matching `strict-failure` only.
- `test/effect-fn.test.ts` and `test/frozen-grant-set.test.ts` — migrate assertions and cover all three outcomes.

# Guard-deletion accounting

Delete `strictFailure: options.strictCheck && violationCount > 0`, copied summary booleans, and downstream `if (summary.strictFailure)` guards. One disposition derivation and exhaustive/precise literal reads own the implication.

# Encoded-side impact

None. These summaries are decoded in-repo command results and are not written to a CLI JSON, persisted artifact, RPC, or public wire. This is an atomic decoded TypeScript migration.

# Test impact

For both shared consumers prove advisory-with-violations does not fail, strict-clean does not fail, and strict-failure retains the exact command failure. Retain include/exclude and diagnostic-count coverage.

# Risk & sequencing

Tier 1E. `LawScan.ts` is the annotated schema owner and must export the schema
and type so both summary classes and the later law migrations can compile
against one runtime value. Do not create per-command aliases. Run full
`@beep/repo-cli` package verification.
