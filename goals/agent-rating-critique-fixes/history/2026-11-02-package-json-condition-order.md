# Order-semantic package.json canonicalization — 2026-11-02

Scope: `normalizePackageJsonEffect` and `encodePackageJsonCanonicalPrettyEffect`
(`@beep/repo-utils/schemas/PackageJsonTools`) sorted every object key in
`exports`, `imports`, `publishConfig.exports` and `typesVersions`
alphabetically, recursively. The fix sorts only keys whose order carries no
meaning. Owned files: `src/schemas/PackageJsonTools.ts`, the existing
`test/schemas/PackageJson.test.ts` and this note. No manifest, root config,
baseline, catalog, schema or API shape change; no other helper changes. This
was admitted by the parent from scout 6580301003 on #2582.

Run: one Claude cloud session (uid 0), no child agents, promotional cloud
credit only. Branch `codex/package-json-condition-order`, cut from a fresh
`origin/main` at `12ececd3` before any edit.

## Defect and semantics

In these fields, key order is part of the contract:

- **Node** (packages "Conditional exports", per the parent's verification of
  the official page): condition keys match in object order, and `"default"`
  must come last. Array targets are fallbacks, tried in order. Subpath keys
  (`.`, `./x`) and import specifiers (`#x`) resolve by exact match or pattern
  specificity, so their order is free.
- **TypeScript**, checked in the installed `typescript` 5.9.3 resolver code,
  because the handbook host is not reachable from this VM:
  - `getPackageJsonTypesVersionsPaths` iterates `for (const key in
    typesVersions)` and returns the **first** range that matches.
  - Inner path patterns go through `matchPatternOrExact`, which tries an exact
    match first and then `findBestPatternMatch`. That picks the longest prefix
    with a strict `>`, so on equal prefix lengths the **first** key wins.
  - `tryLoadModuleUsingPaths` tries the substitution array in order.

  So `typesVersions` order matters at every level.

Before the fix, an in-memory probe of the real
`packages/drivers/anthropic/package.json` turned `publishConfig.exports["."]`
`{types, default}` into `{default, types}`. A `typesVersions`
`{">=4.2", "*"}` became `{"*", ">=4.2"}`, so the catch-all shadowed the
specific range.

## Change

- `canonicalizeEntryPointMap(isSpecifierKey)`:
  - Arrays keep their order, and their elements are canonicalized.
  - A record whose keys are **all** specifier keys is sorted, using the
    existing `sortStringRecord`.
  - Any other record (a condition object) keeps its insertion order (`R.map`),
    recursively.
  - Exports use `Str.startsWith(".")`, including `publishConfig.exports`.
    Imports use `Str.startsWith("#")`.
- `typesVersions` passes through in input order. It is still validated, now
  with `S.decodeResult`, since the input is already typed: the Effect
  `preferTypedDecode` diagnostic flagged `decodeUnknownResult` there.
- Unchanged: dependency maps, `scripts`, `bin`, `engines`, `catalog`,
  `browser`, `peerDependenciesMeta`, the `publishConfig` key layout and the
  `repository` key layout.

## Tests (red before, green after)

There are five new cases in the "canonical helpers" block of
`test/schemas/PackageJson.test.ts`:

1. Nested export conditions, an array of fallbacks containing a condition
   object, subpath sorting, and an imports specifier map with conditions.
2. The top-level condition-map export (sugar form).
3. `publishConfig.exports` shaped like the real `anthropic` manifest.
4. Overlapping `typesVersions` ranges, inner pattern order, and fallback
   arrays.
5. Idempotence: normalize twice, and the pretty encode stays stable.

The existing case "normalizes top-level ordering and nested map ordering"
(subpath keys sorted) stays green.

| Run (uid 0) | Source | Result |
| --- | --- | --- |
| `bunx vitest run test/schemas/PackageJson.test.ts` | `main` `12ececd3` | 5 failed, 58 passed (63) |
| same | fixed | 63 passed |

Red-before was re-run after a test-helper fix (see Friction). The fixed source
was copied aside and restored byte-identical (`cmp`).

## Review follow-up (independent review 6581113281)

- **Advisory A, fixed:** `publishConfig` rest keys were still sorted
  recursively.
  - `PublishConfig` allows any extra JSON key. `orderObjectKeys` sent every key
    outside `access, tag, registry, provenance, bin, exports` through
    `canonicalizeUnknownValue`, so `publishConfig.imports` and
    `publishConfig.typesVersions` (publish-time overrides) had the same defect.
  - `orderObjectKeys` now takes an optional rest canonicalizer. It defaults to
    the previous recursive sort, so `repository` is unchanged.
  - `publishConfig` passes `canonicalizePublishConfigRestValue`: `imports` goes
    through `canonicalizeImportsValue`, and `typesVersions` keeps input order.
  - The rest-key **layout** is unchanged (documented keys first, others
    sorted).
  - No tracked manifest uses either key today (per the review: all 158
    `publishConfig` blocks use only `access`, `bin`, `exports`,
    `provenance`), so this was latent.
- **New regression case:** "keeps publishConfig imports and typesVersions
  order while keeping the rest-key layout". Against the previous head
  `97baaee7`: **1 failed, 63 passed (64)** (`imports["#z"]` came out
  `default, node`). After the fix: **64 passed**. `biome check` and the
  test-config typecheck are clean.
- **Advisory B, routed, not fixed here:** the parent routed the
  `ghaRunners` decode outlier to the runner-trust/infra owner, #2590
  (comment 6581151528; the prior packet was #2565). That owner decides whether
  the SDK manifest is intentionally outside generic `PackageJson`
  normalization (and leaves this canary) or is a model-boundary defect. No
  schema expansion or infra change is made here.
- **Parent's evidence, kept separate:** the parent's non-root run at
  `97baaee7`: all 245 tests in 21 files passed, no skips; repo-utils lint and
  check passed with qualified (built) dependencies. My uid-0 results below stay
  as recorded. My `bun run check` failure is a limitation of the cloud VM's
  unbuilt dependencies and is still not a pass.

## Real-manifest canary (in memory, nothing written)

All 215 tracked `package.json` files were normalized with the fixed source:

- 214 normalized.
- 5 condition objects were found across `exports`, `imports` and
  `publishConfig.exports`.
- **0** came out in an order different from on-disk.
- 1 failed to decode: `infra/ci-runners/sdks/ghaRunners/package.json`,
  `SchemaError(Expected no excess property at ["pulumi"])`. It fails
  **identically with `main`'s source**, so it is inherited and unrelated to
  ordering. It is routed to the infra owner, #2590 (6581151528); see the
  review follow-up above.

## Other checks

- `biome check` on both files: clean, after one formatter fix to the test.
- `tsrs -p tsconfig.test.json --noEmit`: exit 0, after the `decodeResult` fix.
- `bun run lint:laws`: 0 findings in the blocking laws. The one advisory
  `terse-effect` `nested-option-match` is pre-existing. My insertion moved it
  from line 318 to 342; it is not in the new code.
- **`bun run check` (`tsconfig.check.json`): exit 2. This is environmental and
  NOT a pass.** There are 781 errors across almost every `repo-utils` source
  file, cascading from `TS6305` (the referenced
  `packages/foundation/modeling/utils/dist` was never built in this VM). The
  two errors on new lines (`TS377029` "Unexpected `any` type in condition" on
  `A.isArray`/`A.every`) match the identical error on the untouched original
  line 87. Building dependencies was out of scope, so hosted Check is the
  proof.
- Package suite (`bunx vitest run --maxWorkers=1`), uid 0: 244 passed,
  **1 failed**. The failure is the known uid-0 `FsUtils` permission fixture;
  its fix is #2581, still open, so it is inherited on this base.
- `bun run beep quality package-verify @beep/repo-utils`: exit 0,
  `ok docgen 27.5s`, **`skip audit`** (no reason printed). Not an audit pass.
- **Changeset: none.** `@beep/repo-utils` is `"private": true`;
  `.changeset/README.md:3` says "Internal workspaces with `private: true` do
  not require or accumulate changesets", and `.changeset/config.json` sets
  `privatePackages.version: false`.

## Decisions

| Decision | Reason | Reversal |
| --- | --- | --- |
| Sort a record only when all its keys are specifier keys. | Node forbids mixing subpath and condition keys in one object, so "all specifiers" identifies a subpath or specifier map exactly. | Revert to `canonicalizeUnknownValue` at the three call sites. |
| Keep `typesVersions` in input order at every level. | TypeScript resolves ranges first-match, equal-prefix patterns by order, and arrays in order (5.9.3 source). | Restore the recursive sort. |
| Reuse `sortStringRecord`, `R.map`, `A.every` and `Str.startsWith`; no new helper module. | The repo's reuse-first law. | — |
| No changeset. | Private workspace (changeset policy above). | Add one if the package ever becomes publish-enabled. |

## Friction (recorded as it happened)

- **TypeScript handbook unreachable.**
  - Evidence: WebFetch failed with `getaddrinfo ENOTFOUND
    www.typescriptlang.org` (outside the session's allowed domains).
  - Impact: one failed fetch.
  - Workaround: read the installed `typescript` resolver code. The parent had
    already verified the handbook page.
  - Prevention: allow the doc hosts, or cite source code.
  - Owner: cloud network settings, unresolved (no change made).
- **Test helper wrong for arrays.**
  - Evidence: `P.isObject` is `false` for arrays in Effect 4, so `childAt(...,
    "require", 0)` returned `undefined`. An in-memory probe showed the product
    output was correct.
  - Impact: one failing assertion, then a helper fix.
  - Prevention: use `P.hasProperty` for index steps.
  - Owner: author lesson.
- **Source typecheck not runnable in the VM.**
  - Evidence: `TS6305` on the unbuilt `@beep/utils` `dist` cascades to 781
    errors.
  - Workaround: run the test-config typecheck (clean) and rely on hosted Check.
  - Prevention: have the bootstrap build referenced `dist`s, or provide a
    source-only check config.
  - Owner: unresolved (quality tooling / cloud bootstrap).
- **`package-verify` audit skipped without a reason** (seen again). Owner:
  quality tooling, unresolved.
- **uid-0 `FsUtils` failure** still present on bases without #2581.
- **No `OPPORTUNITIES.md` for this goal.** The parent is the single writer, so
  these receipts are here and in the PR comment.
