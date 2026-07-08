# P1-A — dual-arity detector fixes (DualArity.ts)

Lane: P1-A. Scope: `packages/tooling/tool/cli/src/commands/Laws/DualArity.ts`,
`packages/tooling/tool/cli/test/dual-arity.test.ts`. Authorizing locked
rulings: R1 and R3-D2 (`goals/standards-remediation/research/decisions.md`).
No commit made (per instructions).

## Change 1 — R1: static-property schema-codec exclusion

**Behavioral diff.** `collectStaticPropertyCandidate`
(`DualArity.ts:1068-1136`) computed `initializer`/`callableType` and only
gated on `isLegitimateConstructorFactory`; unlike the const-declaration path
(`collectVariableCandidate`, `:942-1014`), it never called
`isNonHelperCallableValue`, so schema-derived static codecs (e.g.
`static readonly decodeUnknownEffect = S.decodeUnknownEffect(this)`) were
flagged as `missing-dual` candidates. Fixed by inserting, immediately after
the initializer/call-signature early-return and before `dualCall` is
computed:

```ts
if (!P.isUndefined(initializer) && isNonHelperCallableValue(initializer, callableType)) {
  return O.none();
}
```

This mirrors the const path's exclusion (`DualArity.ts:964`).

Additionally widened `SCHEMA_CALLABLE_VALUE_FACTORY_PATTERN`
(`DualArity.ts:493-494`) from an explicit enumeration (only `Effect`/
`Option`/`Result` variants, `Unknown`-prefixed and not, plus `toEquivalence`)
to a generated family covering all six v4 `Schema` decode/encode result kinds
verified against `.repos/effect-v4/packages/effect/src/Schema.ts`
(`decodeEffect`, `decodeExit`, `decodeOption`, `decodePromise`, `decodeResult`,
`decodeSync`, each with and without the `Unknown` prefix, and the `encode*`
mirror set), plus `toEquivalence`:

```ts
const SCHEMA_CALLABLE_VALUE_FACTORY_PATTERN =
  /^(?:S|Schema)\.(?:(?:decode|encode)(?:Unknown)?(?:Effect|Exit|Option|Promise|Result|Sync)|toEquivalence)$/u;
```

Previously-missing variants confirmed both in the effect-v4 source and by
live grep of static-initializer usage in this repo: `decodeUnknownSync`,
`decodeUnknownExit`, `decodeSync`, `decodeExit`, `decodePromise`,
`decodeUnknownPromise`, and the corresponding `encode*` set. No widening
beyond the schema codec/derivation factory family.

## Change 2 — R3-D2: valid duals with callable 3rd param

**Behavioral diff.** `collectCandidateDiagnostics` (`DualArity.ts:810-869`)
emitted `third-param-not-object-like` unconditionally for every 3-param
candidate whose 3rd parameter type wasn't `isStrictObjectLikeType` — including
correct `dual(3, ...)` combinators like
`packages/foundation/modeling/nlp/src/Graph/GraphOps.ts:266-279` `bimap`,
whose 3rd param is a function (the `A.reduce(self, b, f)` shape). Added a
helper:

```ts
const isCallableType = (type: Type): boolean => !A.isReadonlyArrayEmpty(type.getCallSignatures());
```

and gated the diagnostic on a new exemption computed alongside the existing
`hasMatchingDualArity`:

```ts
const hasValidDualWithCallableThirdParameter =
  O.isSome(dualCall) &&
  dualCall.value.validSource &&
  hasMatchingDualArity &&
  pipe(candidate.thirdParameterType, O.exists(isCallableType));

if (
  candidate.parameterCount === 3 &&
  !pipe(candidate.thirdParameterType, O.exists(isStrictObjectLikeType)) &&
  !hasValidDualWithCallableThirdParameter
) {
  diagnostics = A.append(diagnostics, "third-param-not-object-like");
}
```

Primitive (and other non-callable, non-object-like) 3rd params stay flagged
even on valid duals; non-dual 3-param candidates are unaffected (the
exemption requires `O.isSome(dualCall)`).

## Fixture tests added (`dual-arity.test.ts`)

1. New test `"ignores static schema-codec callables while tracking plain
   static function properties"`:
   - `Codec.decodeUnknownSync` (`static readonly decodeUnknownSync =
     S.decodeUnknownSync(this)` on a class extending `S.asClass(S.String)`) —
     **newly-excluded** (1a). Chose `decodeUnknownSync` specifically because
     it was NOT covered by the pre-widening pattern, so this fixture proves
     both the static-path exclusion and the pattern widening together.
   - `Plain.combine` (plain 2-param static function property, arrow-function
     initializer, non-schema-codec) — **still-fires** (1b), asserted
     `missing-dual`.
   - Asserts `summary.liveEntries === 1` (only `Plain.combine`).

2. Extended existing test `"requires ObjectLike third parameters and accepts
   named object shapes"`:
   - Renamed `functionBad` → `functionCallableOk`: a proper `dual(3, ...)`
     with both call signatures whose 3rd param is `() => string` —
     **newly-excluded** (2a); this was literally the false-positive shape the
     old code flagged. Moved to the `not.toContain` assertion group.
   - Added `stringBad`: a proper `dual(3, ...)` with both call signatures
     whose 3rd param is `string` — **still-fires** (2b-i); asserted present
     with `third-param-not-object-like`.
   - Added `nonDualFunctionThirdParam`: a plain (non-dual) exported function
     with a callable 3rd param (`transform: (value: string) => string`) —
     **still-fires** (2b-ii); asserted present with `missing-dual` (and
     `third-param-not-object-like` remains true for non-dual candidates via
     the generic assertion already in the test).
   - `summary.liveEntries` updated from `9` to `10` (swap `functionBad` for
     `stringBad` keeps the dual-const group at 9, plus the new non-dual
     function candidate = 10).

## Verification

Command: `npx vitest run test/dual-arity.test.ts` (from
`packages/tooling/tool/cli`).

```
 RUN  v4.1.10 /home/elpresidank/YeeBois/projects/beep-effect7/packages/tooling/tool/cli

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  21:01:58
   Duration  5.28s (transform 1.32s, setup 354ms, import 4.33s, tests 480ms, environment 0ms)
```

All 14 tests pass (13 pre-existing + 1 new file-level test; one existing test
extended in place with 3 additional fixture consts/functions and updated
assertions).

Additionally ran a scoped `npx tsc --noEmit -p tsconfig.json` in the package
to catch type errors vitest's esbuild transform wouldn't surface. The only
errors reported are pre-existing and unrelated, in
`src/commands/Corpus/Corpus.service.ts` (outside this lane's file fence);
nothing in `DualArity.ts` or `test/dual-arity.test.ts`.

No repo-wide `turbo`/`yeet`/inventory-regen commands were run. No files
outside the fence were touched. No commit was made.
