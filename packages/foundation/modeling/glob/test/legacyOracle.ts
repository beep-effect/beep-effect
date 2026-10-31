import * as NodeURL from "node:url";
import { EngineOptions } from "@beep/glob/internal/types";
import { $GlobId } from "@beep/identity/packages";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { assert } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { EngineOptionsInput } from "@beep/glob/internal/types";

const $I = $GlobId.create("test/legacyOracle");

class LegacyOracle extends S.Opaque<LegacyOracle, { readonly brand: unique symbol }>()(
  S.Struct({
    fragments: S.Array(S.Tuple([S.String, EngineOptions, S.Boolean, S.String, S.String])),
    matches: S.Array(
      S.Tuple([
        S.Literals(["compliance", "engine-repetition", "repeated-segments"]),
        S.String,
        S.String,
        EngineOptions,
        S.Boolean,
      ])
    ),
    samples: S.Array(
      S.Tuple([
        S.Literals(["compliance-default", "compliance-options", "minimatch-property", "public-facade"]),
        S.String,
        S.String,
        EngineOptions,
        S.Boolean,
      ])
    ),
    optimizer: S.Array(
      S.Tuple([
        EngineOptions,
        S.Array(S.String),
        S.Array(S.String),
        S.String.pipe(S.Array, S.Array),
        S.String.pipe(S.Array, S.Array),
        S.String.pipe(S.Array, S.Array),
        S.Array(
          S.Tuple([
            S.Array(S.String),
            S.Boolean,
            S.String.pipe(S.Array, S.OptionFromNullOr),
            S.String.pipe(S.Array, S.Array),
          ])
        ),
      ])
    ),
    patterns: S.Array(S.String),
    regexps: S.Array(
      S.Tuple([
        S.String,
        EngineOptions,
        S.OptionFromNullOr(S.String),
        S.String,
        S.Boolean,
        S.Array(S.Tuple([S.String, S.Boolean])),
      ])
    ),
  }).pipe(
    $I.annoteSchema("LegacyOracle", {
      description: "Recorded minimatch 10.2.6 inputs, outcomes and compiled expressions.",
    })
  )
) {}

const ReferenceJson = S.Unknown.pipe(
  S.Array,
  S.fromJsonString,
  $I.annoteSchema("ReferenceJson", { description: "A fixture reference array encoded as JSON text." })
);

const readReference = Effect.fn("LegacyOracle.readReference")(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs.readFileString(NodeURL.fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)));
  return yield* S.decodeEffect(ReferenceJson)(content);
});

const fixtureRuntime = ManagedRuntime.make(NodeFileSystem.layer);

/**
 * Preserves the package's minimatch 10 dialect without installing the vulnerable old oracle.
 *
 * **Details**
 *
 * The fixture provenance binds the independent upstream executable and the
 * original test inputs. Current minimatch remains the oracle where its public
 * behavior agrees with this package's older contract.
 *
 * **Example** (Inspect the retained matching cases)
 *
 * ```ts
 * import { legacyOracle } from "./legacyOracle.ts";
 *
 * console.log(legacyOracle.matches.length); // 2043
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const legacyOracle = await fixtureRuntime.runPromise(
  Effect.gen(function* () {
    const recorded = yield* Effect.all(
      {
        fragments: Effect.forEach(
          ["minimatch-v10-fragments-1.json", "minimatch-v10-fragments-2.json", "minimatch-v10-fragments-3.json"],
          readReference,
          { concurrency: 1 }
        ).pipe(Effect.map(A.flatten)),
        samples: Effect.forEach(
          [
            "minimatch-v10-compliance-default.json",
            "minimatch-v10-compliance-options.json",
            "minimatch-v10-minimatch-property.json",
            "minimatch-v10-public-facade.json",
          ],
          readReference,
          { concurrency: 1 }
        ).pipe(Effect.map(A.flatten)),
        matches: readReference("minimatch-v10-matches.json"),
        optimizer: readReference("minimatch-v10-optimizer.json"),
        patterns: readReference("minimatch-v10-patterns.json"),
        regexps: readReference("minimatch-v10-regexp.json"),
      },
      { concurrency: 1 }
    );
    return yield* S.decodeUnknownEffect(LegacyOracle)(recorded);
  }).pipe(Effect.ensuring(fixtureRuntime.disposeEffect))
);

const sameOptions = S.toEquivalence(EngineOptions);

/**
 * Reconstructs an upstream fragment result from recorded literal or regular-expression data.
 *
 * **Example** (Match an empty repeated fragment)
 *
 * ```ts
 * import { legacyFragment } from "./legacyOracle.ts";
 *
 * import * as P from "effect/Predicate";
 *
 * const fragment = legacyFragment("*(a|)", { dot: false });
 * console.log(P.isString(fragment) ? fragment === "" : fragment.test("")); // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const legacyFragment: {
  (options?: EngineOptionsInput): (pattern: string) => string | RegExp;
  (pattern: string, options?: EngineOptionsInput): string | RegExp;
} = dual(
  (args) => P.isString(args[0]),
  (pattern: string, options: EngineOptionsInput = {}): string | RegExp => {
    const expectedOptions = EngineOptions.make(options);
    const row = A.findFirst(
      legacyOracle.fragments,
      ([text, recorded]) => text === pattern && sameOptions(recorded, expectedOptions)
    ).pipe(O.getOrElse(() => assert.fail(`Missing independent legacy fragment: ${pattern}`)));
    return Bool.match(row[2], {
      onTrue: () => new RegExp(row[3], row[4]),
      onFalse: () => row[3],
    });
  }
);

/**
 * Samples independently recorded inputs and outcomes from an original property-generator domain.
 *
 * **Example** (Draw a reproducible upstream reference case)
 *
 * ```ts
 * import { legacySamples } from "./legacyOracle.ts";
 * import * as Arbitrary from "effect/Arbitrary";
 * import * as Effect from "effect/Effect";
 *
 * const examples = Arbitrary.sampleEffect(legacySamples("compliance-default"), { count: 1, seed: 0 });
 * Effect.runPromise(examples).then((rows) => console.log(rows.length)); // 1
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const legacySamples = (suite: (typeof legacyOracle.samples)[number][0]) =>
  A.match(
    A.filter(legacyOracle.samples, ([name]) => name === suite),
    {
      onEmpty: () => assert.fail(`Missing independent legacy samples: ${suite}`),
      onNonEmpty: (rows) =>
        S.Finite.check(S.isInt(), S.isBetween({ minimum: 0, maximum: rows.length - 1 })).pipe(
          Arbitrary.schema,
          Arbitrary.map((index) =>
            A.get(rows, index).pipe(O.getOrElse(() => assert.fail("Generated reference index was out of bounds")))
          )
        ),
    }
  );
