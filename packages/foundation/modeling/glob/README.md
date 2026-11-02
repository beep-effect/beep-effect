# @beep/glob

Full-fidelity glob matching as Effect schemas. The complete minimatch dialect (extglobs, `{a,b}` braces and sequences, character classes including POSIX classes, true `**` globstar, negation) compiles to pure string predicates, hardened against hostile input, with no runtime dependency beyond `effect` and the repo's identity and schema packages. `GlobPattern.compile` is the one fallible step and returns `Effect<GlobPattern, GlobPatternError>`; once a pattern exists, `matches` is total.

## Why

Glob matching is compilation: a pattern string becomes a predicate over candidate strings, and compilation is the step that can fail. A pattern can exceed the length cap, expand past the brace-expansion budget, or nest past the depth cap. Most glob libraries paper over that boundary by throwing, by silently truncating an over-budget expansion (which quietly changes what the pattern matches), or by overflowing the stack on input a user was allowed to supply.

This package puts the failure where it belongs. `GlobPattern.compile` returns `Effect<GlobPattern, GlobPatternError>`, and the error carries the `reason`, the `limit` and the `actual` value rather than a message you have to parse. Once a `GlobPattern` exists, `matches` is total: pure, synchronous, no error channel, and no hostile pattern can make it overflow, allocate unboundedly or hang, because every guard fired before the instance was constructed.

The dialect is not a subset. The engine in `src/internal/` is a vendored port of minimatch with attribution. Independent recorded results from the verified minimatch 10 implementation preserve its matching dialect, while bounded fresh candidates and hostile-input tests exercise the port. The patched minimatch development dependency supplies the unchanged escape primitives; the older implementation is not an executable dependency. Expansion, pairwise-work and recursion guards bound the compilation paths.

One deliberate deviation from upstream: no ambient environment detection. `platform` is an explicit option defaulting to `"posix"`, and `process.platform` is never read, so a pattern behaves identically on every machine. All win32 path handling stays behind the option.

The package is ESM-only. Import it from an ES module, either through the barrel (`@beep/glob`) or the per-module leaves (`@beep/glob/GlobPattern`, `@beep/glob/GlobSet`).

## Usage

```ts
import { GlobPattern, GlobSet } from "@beep/glob";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pattern = yield* GlobPattern.compile("src/**/*.ts");
  const set = yield* GlobSet.compile(["src/**", "!src/internal/**"]);
  return [pattern.matches("src/a/b.ts"), set.matches("src/internal/x.ts")];
});

console.log(Effect.runSync(program)); // [true, false]
```

## Quick start

Compile once, then match as many candidates as you like:

```ts
import { GlobPattern } from "@beep/glob/GlobPattern";
import { GlobSet } from "@beep/glob/GlobSet";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pattern = yield* GlobPattern.compile("packages/**");
  console.log(pattern.matches("packages/a")) // true
  // ** really crosses segment boundaries.
  console.log(pattern.matches("packages/a/b/c")) // true
  console.log(pattern.matches("src/a")) // false

  // Include/exclude sets: a leading ! is an exclusion filter.
  const set = yield* GlobSet.compile(["packages/*", "!packages/internal"]);
  console.log(set.matches("packages/core")) // true
  console.log(set.matches("packages/internal")) // false
});

Effect.runPromise(program);
```

A compiled pattern also carries the metadata a directory enumerator needs, so you can skip walking trees that cannot match:

```ts
import { GlobPattern } from "@beep/glob/GlobPattern";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pattern = yield* GlobPattern.compile("packages/**");
  console.log(pattern.hasMagic, pattern.enumerationPrefix, pattern.crossesSegments) // true packages/ true
});

Effect.runPromise(program);
```

Embed patterns in config schemas with the `FromString` codec, which validates compilability at decode time:

```ts
import { GlobPattern } from "@beep/glob/GlobPattern";
import * as S from "effect/Schema";

const Config = S.Struct({
  include: S.Array(GlobPattern.FromString),
});
// Decoding a config whose `include` holds an uncompilable pattern fails as a
// schema issue, before your program ever sees a GlobPattern.
const config = S.decodeUnknownSync(Config)({ include: ["src/*.ts"] });
console.log(config.include[0]?.matches("src/index.ts")) // true
```

## Errors

Compilation is the only thing that fails, and it fails with one tagged error whose `reason` tells you which guard fired:

| `reason` | Fires when |
| -------- | ---------- |
| `PatternTooLong` | The pattern exceeds the 64KB length cap. |
| `ExpansionBudgetExceeded` | Brace expansion would produce more alternatives than the budget allows. Upstream truncates here, silently changing match semantics; this package fails instead. |
| `NestingDepthExceeded` | Braces, extglobs or the AST nest past the depth cap. |

```ts
import { GlobPattern } from "@beep/glob/GlobPattern";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

const result = Effect.runSync(Effect.result(GlobPattern.compile("a".repeat(70_000))));
if (Result.isFailure(result)) {
  console.log(result.failure.reason) // PatternTooLong
  console.log(result.failure.limit) // 65536
  console.log(result.failure.actual) // 70000
}
```

## Features

- `GlobPattern.compile(source, options?)` — `Effect<GlobPattern, GlobPatternError>`; the fallible boundary, and the only one.
- `GlobPattern#matches(candidate)` — total, pure, no error channel.
- `GlobPattern#hasMagic` / `negated` / `enumerationPrefix` / `crossesSegments` — metadata for directory enumerators.
- `GlobPattern.escape(literal)` / `unescape(pattern)` — build patterns safely from user-supplied literals.
- `GlobPattern.FromString` — a `Schema.Codec<GlobPattern, string>` for embedding patterns in config schemas.
- `GlobPatternOptions` — the full minimatch options surface, schema-validated. Options refine matching; they never admit a pattern that the defaults reject.
- `GlobSet.compile(patterns)` — include/exclude sets with `literals`, `wildcards` and `excludes` accessors plus `isExcluded`.
- `GlobPatternError` — `_tag`-routable, carrying `pattern`, `reason`, `limit` and `actual`.

## Attribution

The engine in `src/internal/` is ported with attribution from:

- [minimatch](https://github.com/isaacs/minimatch) 10.2.5 — Isaac Z. Schlueter and Contributors, BlueOak-1.0.0
- [brace-expansion](https://github.com/juliangruber/brace-expansion) 5.0.7 — Julian Gruber, MIT
- [balanced-match](https://github.com/juliangruber/balanced-match) 4.0.4 — Julian Gruber, MIT

Each ported file carries its notice, and the real minimatch is used as the test oracle in this package's suite.

## Development

Run these from `packages/foundation/modeling/glob`:

```bash
bun run check              # tsrs over src and test
bun run lint               # biome
bun run test               # unit, property and compliance suites (minimatch oracle)
bun run docgen             # JSDoc examples typecheck
```

Before handing back a change, run `bun run beep quality package-verify @beep/glob` from the repository root.

## Provenance

Ported from upstream `@effected/glob` 0.10.0 (MIT, C. Spencer Beggs) through the effected port, which carried it in the repo scratchpad until `goals/effected-promotion` promoted it into this workspace package. The package [LICENSE](LICENSE) carries both the beep-effect and the upstream copyright notices; the vendored engine files keep their own minimatch, brace-expansion and balanced-match notices. `KNOWLEDGE.md` is the verbatim upstream knowledge bundle.

## License

[MIT](LICENSE)

## Port notes

### Attribution

- Upstream package: `@effected/glob` 0.10.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- packages/foundation/modeling/glob/src/internal/assertValidPattern.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/assertValidPattern.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/assertValidPattern.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- packages/foundation/modeling/glob/src/internal/ast.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/ast.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/ast.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- packages/foundation/modeling/glob/src/internal/balancedMatch.ts:1 // Ported from balanced-match@4.0.4 (https://github.com/juliangruber/balanced-match)
- packages/foundation/modeling/glob/src/internal/balancedMatch.ts:2 // Copyright (c) 2013 Julian Gruber <julian@juliangruber.com>
- packages/foundation/modeling/glob/src/internal/balancedMatch.ts:7 // use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
- packages/foundation/modeling/glob/src/internal/balancedMatch.ts:11 // The above copyright notice and this permission notice shall be included in all
- packages/foundation/modeling/glob/src/internal/balancedMatch.ts:17 // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
- packages/foundation/modeling/glob/src/internal/braceExpansion.ts:1 // Ported from brace-expansion@5.0.7 (https://github.com/juliangruber/brace-expansion)
- packages/foundation/modeling/glob/src/internal/braceExpansion.ts:2 // Copyright (c) 2013 Julian Gruber <julian@juliangruber.com>
- packages/foundation/modeling/glob/src/internal/braceExpansion.ts:7 // use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
- packages/foundation/modeling/glob/src/internal/braceExpansion.ts:11 // The above copyright notice and this permission notice shall be included in all
- packages/foundation/modeling/glob/src/internal/braceExpansion.ts:17 // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
- packages/foundation/modeling/glob/src/internal/braceExpressions.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/braceExpressions.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/braceExpressions.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- packages/foundation/modeling/glob/src/internal/escape.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/escape.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/escape.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- packages/foundation/modeling/glob/src/internal/minimatch.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/minimatch.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/minimatch.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- packages/foundation/modeling/glob/src/internal/types.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/types.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/types.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- packages/foundation/modeling/glob/src/internal/unescape.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- packages/foundation/modeling/glob/src/internal/unescape.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- packages/foundation/modeling/glob/src/internal/unescape.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Effect hash collections, Array.dedupe, Record.toEntries and typed regex assignments replace native collection/Object operations while preserving matching and literal order. (packages/foundation/modeling/glob/test/GlobSet.test.ts:74,132; packages/foundation/modeling/glob/test/engine.test.ts:173; packages/foundation/modeling/glob/test/compliance.test.ts:188,301)
- **tagged-errors** — Schema tagged errors replace native programmer/invariant defects and model GuardExceeded while preserving its name and diagnostic message. (packages/foundation/modeling/glob/test/braceExpansion.test.ts:229; packages/foundation/modeling/glob/test/hostility.test.ts:128; packages/foundation/modeling/glob/test/engine.test.ts:48,208,243)
- **schema-first** — LiteralKit domains and schema-derived guards replace duplicated unions/membership predicates, and test JSON diagnostics use schema codecs. (packages/foundation/modeling/glob/test/engine.test.ts:48,97; packages/foundation/modeling/glob/test/GlobPattern.test.ts:217,232; packages/foundation/modeling/glob/test/compliance.test.ts:301,316; packages/foundation/modeling/glob/test/GlobSet.test.ts:274)
- **numeric-domains** — Finite limits and refined option caps replace unrestricted number schemas, while actual measurements explicitly retain positive Infinity and reject NaN/negative Infinity. (packages/foundation/modeling/glob/test/engine.test.ts:97,106; packages/foundation/modeling/glob/test/GlobPattern.test.ts:221,311,324; packages/foundation/modeling/glob/test/GlobSet.test.ts:291,306)
- **type-safety** — Checked reads, type predicates and the sanctioned deliberatelyInvalid helper replace unsafe assertions while retaining upstream constructor rejection tests. (packages/foundation/modeling/glob/test/GlobPattern.test.ts:213,217; packages/foundation/modeling/glob/test/hostility.test.ts:24; packages/foundation/modeling/glob/test/compliance.test.ts:188,301; packages/foundation/modeling/glob/test/engine.test.ts:208)
- **tsgo-diagnostics** — Diagnostic-required dual overloads, .make factories and S.is guards replace plain helper signatures, positional schema construction and instanceof guards. (packages/foundation/modeling/glob/test/engine.test.ts:28,48,82,106; packages/foundation/modeling/glob/test/braceExpansion.test.ts:10; packages/foundation/modeling/glob/test/hostility.test.ts:13)
- **effect-first** — Effect predicates and the synchronous Random service replace native type checks and Math.random without starting runtimes for module initialization. (packages/foundation/modeling/glob/test/braceExpansion.test.ts:139,143; packages/foundation/modeling/glob/test/compliance.test.ts:301; module suite packages/foundation/modeling/glob/test/**)
- **effect-imports** — Dedicated effect/* imports replace root-barrel imports in source, tests and source examples. (module suite packages/foundation/modeling/glob/test/**)
- **identity-annotations** — File-local $I identifiers and schema/field/check annotations replace plain identifiers and incomplete schema metadata. (module suite packages/foundation/modeling/glob/test/**)
- **upstream-bug** — Lab bounds numeric brace generation by the validated member count and terminates stalled ranges where upstream appends indefinitely (packages/foundation/modeling/glob/test/braceExpansion.test.ts:162; packages/foundation/modeling/glob/test/hostility.test.ts:48; packages/foundation/modeling/glob/test/GlobPattern.test.ts:312; packages/foundation/modeling/glob/test/GlobSet.test.ts:292).
- **upstream-bug** — Lab rejects NaN-producing brace arithmetic as a typed expansion-budget failure with actual Infinity where upstream bypasses the count guard (packages/foundation/modeling/glob/test/braceExpansion.test.ts:176; packages/foundation/modeling/glob/test/hostility.test.ts:60; packages/foundation/modeling/glob/test/GlobPattern.test.ts:326; packages/foundation/modeling/glob/test/GlobSet.test.ts:309).
- **upstream-bug** — Lab segment matching memoizes repeated extglobs and adds optional MMRegExp._matchSegment metadata while upstream matching can explore Fibonacci-many regexp paths (packages/foundation/modeling/glob/test/engine.test.ts:287,298; packages/foundation/modeling/glob/test/hostility.test.ts:176).
- **upstream-bug** — Lab brace expansion stops at the first excess emitted member and reports actual 1001 for max 1000 while upstream materializes 32,000 sibling members and reports actual 32000 (packages/foundation/modeling/glob/test/braceExpansion.test.ts:297,318; packages/foundation/modeling/glob/test/hostility.test.ts:185).
- **tsgo-diagnostics** — Lab schema classes and errors gain unique-symbol brands that distinguish instance types nominally while upstream facade declarations omit those brands (packages/foundation/modeling/glob/src/GlobPattern.ts:49,134,331; packages/foundation/modeling/glob/src/GlobSet.ts:89; packages/foundation/modeling/glob/src/internal/limits.ts:29,228).

### Upstream test oracle and compatibility

The live minimatch dependency is 11.0.3. Its new matching engine removes the
older AST and regexp APIs and changes some matching semantics. The
[recorded reference corpus](test/fixtures/README.md) preserves this package's
minimatch 10.2.6 contract without retaining the vulnerable executable test
dependency. It includes the original directed cases, deterministic samples
from the original generators and fresh bounded-candidate comparisons.
Current upstream still checks unchanged escape and expansion primitives.

The vendored optimizer applies `braceExpandMax` to generated globstar-parent
alternatives as well as brace expansion. It rejects the first excess member
with the existing typed `ExpansionBudgetExceeded` signal. Pairwise deduplication
is skipped for more than 1,000 alternatives, matching upstream's second-phase
ceiling. All alternatives remain available for matching; this optimization does
not truncate the pattern language.
