# glob (lab port of @effected/glob)

Full-fidelity glob matching as Effect schemas. The complete minimatch dialect — extglobs, `{a,b}` braces and sequences, character classes including POSIX classes, true `**` globstar, negation — compiled to pure string predicates, hardened against hostile input, with zero runtime dependencies.

## Why @effected/glob

Glob matching is compilation: a pattern string becomes a predicate over candidate strings, and compilation is the step that can fail. A pattern can exceed the length cap, expand past the brace-expansion budget, or nest past the depth cap. Most glob libraries paper over that boundary by throwing, by silently truncating an over-budget expansion (which quietly changes what the pattern matches), or by overflowing the stack on input a user was allowed to supply.

This package puts the failure where it belongs. `GlobPattern.compile` is the one fallible entry point: it returns `Effect<GlobPattern, GlobPatternError>`, and the error carries the `reason`, the `limit` and the `actual` value rather than a message you have to parse. Once a `GlobPattern` exists, `matches` is total — pure, synchronous, no error channel, and no hostile pattern can make it overflow, allocate unboundedly or hang, because every guard fired before the instance was constructed.

The dialect is not a subset. The engine is a ported-with-attribution vendoring of minimatch, property-tested against the real minimatch as an oracle on every build, with every upstream DoS guard preserved and new depth guards added on the recursion surfaces upstream left open. Vendoring rather than depending is what keeps the package free of runtime dependencies: `effect` is the only peer, and the minimatch oracle is a devDependency confined to the test suite.

One deliberate deviation from upstream: no ambient environment detection. `platform` is an explicit option defaulting to `"posix"`, and `process.platform` is never read, so a pattern behaves identically on every machine. All win32 path handling stays behind the option, for the caller who knows they need it.

Requires Node.js >=24.11.0. `effect` v4 is a peer dependency; the package itself adds no other runtime dependencies.

All `@effected/*` packages are ESM-only: the exports maps publish only `import` conditions, so `require()` — including tools that resolve in CJS mode — fails with Node's `ERR_PACKAGE_PATH_NOT_EXPORTED` rather than loading a CJS build that does not exist. Import from an ES module.

## Quick start

Compile once, then match as many candidates as you like:

```ts
import { GlobPattern } from "@beep/scratchpad/effected/glob/GlobPattern";
import { GlobSet } from "@beep/scratchpad/effected/glob/GlobSet";
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
import { GlobPattern } from "@beep/scratchpad/effected/glob/GlobPattern";
import * as Effect from "effect/Effect";

const program = Effect.gen(function* () {
  const pattern = yield* GlobPattern.compile("packages/**");
  console.log(pattern.hasMagic, pattern.enumerationPrefix, pattern.crossesSegments) // true packages/ true
});

Effect.runPromise(program);
```

Embed patterns in config schemas with the `FromString` codec, which validates compilability at decode time:

```ts
import { GlobPattern } from "@beep/scratchpad/effected/glob/GlobPattern";
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
import { GlobPattern } from "@beep/scratchpad/effected/glob/GlobPattern";
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

## License

[MIT](LICENSE)

## Port notes

### Attribution

- Upstream package: `@effected/glob` 0.10.0
- Upstream commit: `af7566a9da2eff169cb74955efcc5ede1e5de9f8` (~/YeeBois/references/effect/effected)
- License: [LICENSE](./LICENSE) (verbatim upstream MIT notice)
- scratchpad/effected/glob/internal/assertValidPattern.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/assertValidPattern.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/assertValidPattern.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- scratchpad/effected/glob/internal/ast.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/ast.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/ast.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- scratchpad/effected/glob/internal/balancedMatch.ts:1 // Ported from balanced-match@4.0.4 (https://github.com/juliangruber/balanced-match)
- scratchpad/effected/glob/internal/balancedMatch.ts:2 // Copyright (c) 2013 Julian Gruber <julian@juliangruber.com>
- scratchpad/effected/glob/internal/balancedMatch.ts:7 // use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
- scratchpad/effected/glob/internal/balancedMatch.ts:11 // The above copyright notice and this permission notice shall be included in all
- scratchpad/effected/glob/internal/balancedMatch.ts:17 // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
- scratchpad/effected/glob/internal/braceExpansion.ts:1 // Ported from brace-expansion@5.0.7 (https://github.com/juliangruber/brace-expansion)
- scratchpad/effected/glob/internal/braceExpansion.ts:2 // Copyright (c) 2013 Julian Gruber <julian@juliangruber.com>
- scratchpad/effected/glob/internal/braceExpansion.ts:7 // use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
- scratchpad/effected/glob/internal/braceExpansion.ts:11 // The above copyright notice and this permission notice shall be included in all
- scratchpad/effected/glob/internal/braceExpansion.ts:17 // AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
- scratchpad/effected/glob/internal/braceExpressions.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/braceExpressions.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/braceExpressions.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- scratchpad/effected/glob/internal/escape.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/escape.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/escape.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- scratchpad/effected/glob/internal/minimatch.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/minimatch.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/minimatch.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- scratchpad/effected/glob/internal/types.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/types.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/types.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)
- scratchpad/effected/glob/internal/unescape.ts:1 // Ported from minimatch@10.2.5 (https://github.com/isaacs/minimatch)
- scratchpad/effected/glob/internal/unescape.ts:2 // Copyright: Isaac Z. Schlueter and Contributors
- scratchpad/effected/glob/internal/unescape.ts:3 // License: BlueOak-1.0.0 (https://blueoakcouncil.org/license/1.0.0)

### Added exports

None.

### Deviations

One entry per class of change (law- or ruling-forced) and one per behavioural divergence; the full test, upstream behaviour, lab behaviour and reason are on the module's ledger row.

- **native-runtime** — Effect hash collections, Array.dedupe, Record.toEntries and typed regex assignments replace native collection/Object operations while preserving matching and literal order. (scratchpad/test/glob/GlobSet.test.ts:74,132; scratchpad/test/glob/engine.test.ts:173; scratchpad/test/glob/compliance.test.ts:188,301)
- **tagged-errors** — Schema tagged errors replace native programmer/invariant defects and model GuardExceeded while preserving its name and diagnostic message. (scratchpad/test/glob/braceExpansion.test.ts:229; scratchpad/test/glob/hostility.test.ts:128; scratchpad/test/glob/engine.test.ts:48,208,243)
- **schema-first** — LiteralKit domains and schema-derived guards replace duplicated unions/membership predicates, and test JSON diagnostics use schema codecs. (scratchpad/test/glob/engine.test.ts:48,97; scratchpad/test/glob/GlobPattern.test.ts:217,232; scratchpad/test/glob/compliance.test.ts:301,316; scratchpad/test/glob/GlobSet.test.ts:274)
- **numeric-domains** — Finite limits and refined option caps replace unrestricted number schemas, while actual measurements explicitly retain positive Infinity and reject NaN/negative Infinity. (scratchpad/test/glob/engine.test.ts:97,106; scratchpad/test/glob/GlobPattern.test.ts:221,311,324; scratchpad/test/glob/GlobSet.test.ts:291,306)
- **type-safety** — Checked reads, type predicates and the sanctioned deliberatelyInvalid helper replace unsafe assertions while retaining upstream constructor rejection tests. (scratchpad/test/glob/GlobPattern.test.ts:213,217; scratchpad/test/glob/hostility.test.ts:24; scratchpad/test/glob/compliance.test.ts:188,301; scratchpad/test/glob/engine.test.ts:208)
- **tsgo-diagnostics** — Diagnostic-required dual overloads, .make factories and S.is guards replace plain helper signatures, positional schema construction and instanceof guards. (scratchpad/test/glob/engine.test.ts:28,48,82,106; scratchpad/test/glob/braceExpansion.test.ts:10; scratchpad/test/glob/hostility.test.ts:13)
- **effect-first** — Effect predicates and the synchronous Random service replace native type checks and Math.random without starting runtimes for module initialization. (scratchpad/test/glob/braceExpansion.test.ts:139,143; scratchpad/test/glob/compliance.test.ts:301; module suite scratchpad/test/glob/**)
- **effect-imports** — Dedicated effect/* imports replace root-barrel imports in source, tests and source examples. (module suite scratchpad/test/glob/**)
- **identity-annotations** — File-local $I identifiers and schema/field/check annotations replace plain identifiers and incomplete schema metadata. (module suite scratchpad/test/glob/**)

### Dependency backlog

None.
