# P4 Wave 3 Deferred Arbitraries (probe-first, orchestrated)

Date: 2026-06-08

Final disposition: recorded deferrals as of 2026-07-14. This is the packet's
final arbitrary-deferral ledger; portfolio closeout does not reopen or remove
any entry.

## Summary

Third orchestrated batch over the deferred `SFV4-arbitrary-tests` candidates,
targeting the 13 tractable ones (Glob and TypedArrays were excluded as
Bun-runtime-blocked in this environment). A workflow **probed `S.toArbitrary`
first** (Effect v4 auto-generates valid values for many checked/pattern
brands), added a source `toArbitrary` annotation only where the auto-arbitrary
misgenerated, gated on **tsc + single-file test**, and reverted conservatively.
The operator then ran **authoritative serial verification** — package tsc, full
suites (no-new-failures), and heavy per-law stress runs — which caught two
flaky property tests the agents' individual runs missed.

Outcome: **9 remediated**, **2 reverted as flaky** (kept deferred), **1
reclassified as an exception**, 1 mis-targeted no-op.

## Remediated (9, stress-verified)

Probe-only (no source change — `S.toArbitrary` already generates valid values
for the checked brand/transform):

- `DateTimeUtcFromValid` — `encode(decode(encode(x)))` deep-equals `encode(x)` + epoch invariant (lossy canonical-ISO encode). Stress 6× + full suite.
- `RegExp` — `RegExpStr` identity round-trip + `RegExpFromStr` `instanceof RegExp` Type invariant. Stress 15×.
- `Duration` — `D.isDuration` + `S.is(Duration.Schema)` invariant on the normalized transform Type. Stress 6×.
- `Color` — lossless `HexColor` → RGB → hex round-trip. Stress 6×.
- `URI` — `S.is` + identity round-trip for URI/AbsoluteURI/URIReference/RelativeURIReference. Stress **25×** (ASCII RFC-3986 is generation-stable).
- `Observed` — `S.is` membership for ObservedCause/ObservedExit. Stress 10×.

Source `toArbitrary` annotation added (fc combinators only — no Faker/FastCheck
import in `src/`, so no runtime dependency):

- `FileName` (`src/FileName.ts`) — a `TemplateLiteral` whose stem predicates
  (no separators / NUL) are not reflected in the template regex, so the
  auto-arbitrary misgenerates. Added `fc.tuple(fc.stringMatching(tighterStemRegex),
  fc.constantFrom(...FileExtension.Options)).map(...)`. Stress 250+ generations.
- `TSMorph` `SymbolId` (`repo-utils/src/TSMorph/TSMorph.model.ts`) — a
  `TemplateLiteral` of `SymbolFilePath::SymbolQualifiedName#SymbolKind`; the
  annotation composes the part arbitraries. Covers both `TSMorph.model.test.ts`
  and `TSMorph.service.test.ts`. Full repo-utils suite clean (18 passed).

## Reverted as FLAKY — recorded deferrals (2)

The agents' individual runs passed (lucky seeds), but the operator's full-suite
run (different seed) plus heavy stress runs exposed real non-determinism. These
need a **curated source `toArbitrary`** that emits only valid, round-trippable
values — left deferred:

- `IRI` — flaky ~1/11 runs. RFC-3987 allows Unicode (ucschar/iprivate); the
  auto `stringMatching` occasionally emits chars that fail full validation or
  normalize on decode (so identity round-trip breaks). (URI, ASCII-only, was
  the sibling kept after 25 clean runs.)
- `PackageJson` — flaky. `encode(decode(encode(x)))` is **not** idempotent for
  pathological recursive `exports` records containing `__proto__` / `constructor`
  keys (counterexample shrunk 64×). The encode-idempotence law does not hold
  universally for this schema.

**Lesson:** auto-generated arbitraries for complex regex (Unicode) and recursive
Json-like schemas can be flaky; gate on a full-suite run (fresh seed) plus
repeated stress runs, not a single green pass.

## Exception (1)

- `PromiseSchema` — pure `S.declare<Promise<unknown>>` identity declaration;
  `S.toArbitrary` throws "Unsupported AST Declaration" and a Promise cannot be
  meaningfully round-tripped. Reclassified `status: exception` in the inventory.

## Mis-target note

The deferred Graph candidate is `packages/foundation/modeling/schema/test/Graph.test.ts`
(an `@beep/schema` instanceOf test). The workflow mistakenly listed the NLP
`capability/nlp/test/Graph/Schema.test.ts`, which was already remediated in an
earlier pilot — the agent correctly no-op'd it (no file changed). The real
`schema/test/Graph.test.ts` remains deferred.

## Verification

```sh
bunx tsc --noEmit -p packages/foundation/modeling/schema/tsconfig.json       # exit 0
bunx tsc --noEmit -p packages/tooling/library/repo-utils/tsconfig.json       # exit 0
# @beep/schema full suite: 15 failed (pre-existing Bun-runtime) / 507 passed (+6, zero new failures)
# @beep/repo-utils full suite (post PackageJson/IRI reverts): 18 passed / 0 failed
# per-law stress: URI 25×, RegExp 15×, Observed 10×, FileName 250+ gens, Color/DateTimeUtc/Duration 6× — all clean
bun run beep lint schema-first --write   # arbitrary-tests 15 -> 5
bun run beep lint schema-first           # exit 0, missing/stale 0
```

After this batch the live `SFV4-arbitrary-tests` advisory count is **5**.
Portfolio closeout retains all five as recorded deferrals:

- Glob and TypedArrays — Bun-runtime-blocked.
- IRI and PackageJson — reverted-flaky and require curated arbitraries.
- Graph — not yet addressed.

Cumulatively the 34 surfaced candidates are 20 remediated, 9 exceptions, and
5 final recorded deferrals.
