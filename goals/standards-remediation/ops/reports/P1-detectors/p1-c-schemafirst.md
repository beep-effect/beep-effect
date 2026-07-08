# P1-C — schema-first crispening family gap (R4)

## Disposition

| Item | Disposition | Evidence |
|---|---|---|
| `SCHEMA_CRISPENING_FAMILY_PREFIXES` missing `packages/shared/` and `infra/` | fixed | `SchemaFirst.ts:634-645` |
| `schemaCrispeningFamilyForFile` doc comment ("unassigned until P1 wave assignment") | fixed | `SchemaFirst.ts:646-661` |
| Regression fixture for the gap | fixed | `schema-first.test.ts` (see below) |

## Behavioral diff

`SCHEMA_CRISPENING_FAMILY_PREFIXES` (`packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts:634-645`)
now includes two entries that were previously missing:

- `["infra/", "tooling"]`
- `["packages/shared/", "apps-slices"]`

Both `"tooling"` and `"apps-slices"` are existing members of `SchemaCrispeningFamily`
(`LiteralKit(["foundation", "drivers", "tooling", "apps-slices"])`) — no new family
literal was invented and `standards/schema-crispening.policy.jsonc` was not touched,
per the file fence.

Before the fix: `schemaCrispeningFamilyForFile("packages/shared/**/*.ts")` and
`schemaCrispeningFamilyForFile("infra/**/*.ts")` returned `O.none`.
`resolveSchemaCrispeningPolicyBlocking` (`:668-683`) falls back to `false` when the
family is unresolved, so `isSchemaCrispeningPolicyExempt` (`:705-718`) exempted any
carded SFV4 advisory in those two scan-scope roots regardless of the policy
document's `families` blocking flags — a silent enforcement hole given that all
four currently-modeled families are `blocking: true` in the committed policy.

After the fix: both roots resolve to an assigned family (`apps-slices` /
`tooling`), so a carded advisory under `packages/shared/**` or `infra/**` is
exempt or blocking exactly like the rest of its family, with no special-casing.

The doc comment on `schemaCrispeningFamilyForFile` (`:646-661`) was rewritten:
the old text asserted `packages/shared/**` and `infra/**` were "unassigned until
their P1 wave assignment lands" (a `@since 0.0.0` claim that never became true
after the crispening initiative closed). The new text states that every
schema-first lint scan-scope root (`apps/**`, each `packages/**` family prefix,
and `infra/**`) is now assigned, and that `O.none` is reserved only for paths
entirely outside the scan scope (e.g. `scripts/**`). The `@example` block is
unchanged and still compiles (verified by the passing vitest run, which
transpiles the whole file).

## Tests updated / added (`packages/tooling/tool/cli/test/schema-first.test.ts`)

- **Updated** `"resolves schema-crispening wave families by path prefix"` — the
  two assertions that previously proved `packages/shared/**` and `infra/**`
  resolve to `O.none` now assert `O.some("apps-slices")` and `O.some("tooling")`
  respectively, with a comment tying the change back to R4.
- **Added** `"resolves every schema-first lint scan scope root to an assigned
  family"` — table-driven assertion over all eleven scan-scope roots (`apps/`,
  each of the nine `packages/**` family prefixes including `shared`, and
  `infra/`), each proven `O.isSome` and equal to its expected family. This
  directly encodes "no scanned path can be family-unassigned anymore."
- **Replaced** the single test
  `"treats an unassigned family (e.g. packages/shared) as non-blocking, hence
  exempt"` (previously proved the exemption-hole behavior) with two new tests:
  - `"R4: does not exempt a carded packages/shared entry now that it resolves
    to the blocking apps-slices family"`
  - `"R4: does not exempt a carded infra entry now that it resolves to the
    blocking tooling family"`

  Both construct a carded entry (`ruleId: "SFV4-defaults"`) in the
  previously-unassigned root, set the resolved family's `blocking: true` in a
  local policy document, and assert `isSchemaCrispeningPolicyExempt` is now
  `false` — i.e. the advisory is no longer silently exempt.
- No other existing assertions were deleted or weakened (the `isSchemaCrispeningPolicyExempt`
  describe block's other five tests, the `G4 foundation family-flip regression
  fixture` describe block including the real-committed-policy test at the end
  of the file, and all detector-function tests are untouched).

Net: 24 tests → 26 tests in the file (one test split into two, one new table-driven
test added).

## Files touched

- `packages/tooling/tool/cli/src/commands/Lint/SchemaFirst.ts`
- `packages/tooling/tool/cli/test/schema-first.test.ts`

No other files touched; `standards/*.jsonc` untouched; no `--write` run; no commit made.

## Commands run

```
cd packages/tooling/tool/cli && npx vitest run test/schema-first.test.ts
```

## vitest output tail

```
 RUN  v4.1.10 /home/elpresidank/YeeBois/projects/beep-effect7/packages/tooling/tool/cli

8:58:09 PM [vite] (ssr) warning: [PARSE_ERROR] Top-level await is not available in the configured target environment.
  (pre-existing warning at test/schema-first.test.ts:30 — the committedPolicyText
  top-level await fixture load; unrelated to this change, not introduced by it)

 Test Files  1 passed (1)
      Tests  26 passed (26)
   Start at  20:58:08
   Duration  10.06s (transform 3.32s, setup 666ms, import 9.11s, tests 54ms, environment 0ms)
```
