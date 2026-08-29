/**
 * Wink custom-entity pattern models.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $WinkId } from "@beep/identity";
import { MarkRange } from "@beep/nlp/Core/Pattern";
import { SchemaUtils } from "@beep/schema";
import { A } from "@beep/utils";
import { Chunk, Match, pipe, Result } from "effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { Pattern, PatternElement } from "@beep/nlp/Core/Pattern";
import type { FastCheck } from "effect/testing";

const $I = $WinkId.create("Wink/WinkPattern");
const makeWinkStringArrayArbitrary = (fc: typeof FastCheck) => fc.array(fc.string(), { maxLength: 64 });

/**
 * Canonical schema for arrays returned by Wink string-valued accessors.
 *
 * **Example** (Decode accessor output)
 *
 * ```ts
 * import { WinkStringArray } from "@beep/wink"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 *
 * const values = S.decodeResult(WinkStringArray)(["sentence", "tokens"])
 * console.log(Result.isSuccess(values)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const WinkStringArray = S.Array(S.String)
  .annotate({
    toArbitrary: () => makeWinkStringArrayArbitrary,
  })
  .pipe(
    $I.annoteSchema("WinkStringArray", {
      description: "Array of strings returned by Wink NLP accessors.",
    })
  );

/**
 * Runtime value decoded by {@link WinkStringArray} for Wink string-valued accessors.
 *
 * @category models
 * @since 0.0.0
 */
export type WinkStringArray = typeof WinkStringArray.Type;

const renderPatternElement = Match.type<PatternElement>().pipe(
  Match.tagsExhaustive({
    EntityPatternElement: ({ value }) => A.join(value, "|"),
    LiteralPatternElement: ({ value }) => A.join(value, "|"),
    POSPatternElement: ({ value }) => A.join(value, "|"),
  })
);

const patternElementToBracketString = (pattern: Pattern): ReadonlyArray<string> =>
  pipe(
    Chunk.toReadonlyArray(pattern.elements),
    A.map(renderPatternElement),
    A.map((content) => `[${content}]`)
  );

/**
 * Branded identifier for a learned wink custom-entity group.
 *
 * **Example** (Create from unknown string)
 *
 * ```ts
 * import { EntityGroupName } from "@beep/wink"
 *
 * const entityGroupName = EntityGroupName.fromUnknown("ProductName")
 * console.log(entityGroupName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const EntityGroupName = S.NonEmptyString.pipe(
  S.brand("EntityGroupName"),
  $I.annoteSchema("EntityGroupName", {
    description: "Stable identifier for a learned wink custom-entity group.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime TypeScript type produced by {@link EntityGroupName}.
 *
 * **Example** (Annotate branded group name)
 *
 * ```ts
 * import { EntityGroupName } from "@beep/wink"
 * import type { EntityGroupName as EntityGroupNameType } from "@beep/wink"
 *
 * const groupName: EntityGroupNameType = EntityGroupName.make("ProductName")
 * console.log(groupName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type EntityGroupName = typeof EntityGroupName.Type;

/**
 * One wink custom-entity training example expressed as bracket-pattern elements.
 *
 * **Example** (Make training example)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CustomEntityExample } from "@beep/wink"
 *
 * const example = CustomEntityExample.make({
 *   mark: O.none(),
 *   name: "ProductName",
 *   patterns: ["[PROPN]", "[NOUN]"]
 * })
 *
 * console.log(example.toWinkExample().patterns)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CustomEntityExample extends S.Class<CustomEntityExample>($I`CustomEntityExample`)(
  {
    mark: S.OptionFromOptionalKey(MarkRange).pipe(SchemaUtils.withNoneDefault),
    name: S.NonEmptyString,
    patterns: S.NonEmptyArray(S.NonEmptyString),
  },
  $I.annote("CustomEntityExample", {
    description: "Bracket-pattern example used to teach wink a custom entity type.",
  })
) {
  /**
   * Backwards-compatible unsafe constructor alias.
   */
  /**
   * Convert the example into the object shape accepted by `wink-nlp.learnCustomEntities`.
   *
   * @returns The wink-compatible custom entity example payload.
   */
  toWinkExample(): {
    readonly mark?: readonly [number, number] | undefined;
    readonly name: string;
    readonly patterns: ReadonlyArray<string>;
  } {
    return {
      ...(O.isSome(this.mark) ? { mark: this.mark.value } : {}),
      name: this.name,
      patterns: [A.join(this.patterns, " ")],
    };
  }
}

const sameCustomEntityExample = S.toEquivalence(CustomEntityExample);

/**
 * Collection of custom-entity examples learned as one logical wink entity group.
 *
 * **Example** (Build custom entity group)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { CustomEntityExample, EntityGroupName, WinkEngineCustomEntities } from "@beep/wink"
 *
 * const customEntities = WinkEngineCustomEntities.make({
 *   name: EntityGroupName.make("ProductName"),
 *   patterns: [
 *     CustomEntityExample.make({
 *       mark: O.none(),
 *       name: "ProductName",
 *       patterns: ["[PROPN]", "[NOUN]"]
 *     })
 *   ]
 * })
 *
 * console.log(customEntities.toWinkFormat()[0]?.name)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WinkEngineCustomEntities extends S.Class<WinkEngineCustomEntities>($I`WinkEngineCustomEntities`)(
  {
    name: EntityGroupName,
    patterns: S.Array(CustomEntityExample),
  },
  $I.annote("WinkEngineCustomEntities", {
    description: "Collection of custom entity examples that can be learned by the wink engine.",
  })
) {
  /**
   * Backwards-compatible unsafe constructor alias.
   */
  /**
   * Build a wink custom-entity collection from existing core patterns.
   *
   * Patterns without any serialized elements are ignored instead of throwing so
   * callers can safely combine partially-built pattern sets before learning.
   *
   * @param name - The logical entity-group name.
   * @param patterns - Core patterns to convert into wink custom entity examples.
   * @returns The converted custom entity collection.
   */
  static readonly fromPatterns: {
    (name: EntityGroupName | string, patterns: ReadonlyArray<Pattern> | Chunk.Chunk<Pattern>): WinkEngineCustomEntities;
    (
      name: EntityGroupName | string
    ): (patterns: ReadonlyArray<Pattern> | Chunk.Chunk<Pattern>) => WinkEngineCustomEntities;
  } = dual(
    2,
    (
      name: EntityGroupName | string,
      patterns: ReadonlyArray<Pattern> | Chunk.Chunk<Pattern>
    ): WinkEngineCustomEntities => {
      const groupName = P.isString(name) ? EntityGroupName.make(name) : name;
      const entries = Chunk.isChunk(patterns) ? Chunk.toReadonlyArray(patterns) : patterns;

      return WinkEngineCustomEntities.make({
        name: groupName,
        patterns: pipe(
          entries,
          A.filterMap((pattern) => {
            const serialized = patternElementToBracketString(pattern);
            const [head, ...tail] = serialized;
            return head === undefined
              ? Result.failVoid
              : Result.succeed(
                  CustomEntityExample.make({
                    mark: pattern.mark,
                    name: groupName,
                    patterns: [head, ...tail],
                  })
                );
          })
        ),
      });
    }
  );

  /**
   * Number of custom entity examples in the group.
   *
   * @returns The number of examples in this group.
   */
  size(): number {
    return A.length(this.patterns);
  }

  /**
   * Whether the collection contains no examples.
   *
   * @returns `true` when the group has no examples.
   */
  isEmpty(): boolean {
    return A.isReadonlyArrayEmpty(this.patterns);
  }

  /**
   * Convert to a readonly array for iteration.
   *
   * @returns The examples in this group.
   */
  toArray(): ReadonlyArray<CustomEntityExample> {
    return this.patterns;
  }

  /**
   * Merge two custom-entity collections, preserving unique examples by content.
   *
   * @param other - The additional examples to merge in.
   * @param newName - The group name to use for the merged collection.
   * @returns A merged collection with duplicate examples removed.
   */
  merge(other: WinkEngineCustomEntities, newName: EntityGroupName | string = this.name): WinkEngineCustomEntities {
    return WinkEngineCustomEntities.make({
      name: P.isString(newName) ? EntityGroupName.make(newName) : newName,
      patterns: pipe(this.patterns, A.appendAll(other.patterns), A.dedupeWith(sameCustomEntityExample)),
    });
  }

  /**
   * Convert to the array-of-example format accepted by `wink-nlp.learnCustomEntities`.
   *
   * @returns Wink-compatible custom entity payloads.
   */
  toWinkFormat(): ReadonlyArray<{
    readonly mark?: readonly [number, number] | undefined;
    readonly name: string;
    readonly patterns: ReadonlyArray<string>;
  }> {
    return pipe(
      this.patterns,
      A.map((pattern) => pattern.toWinkExample())
    );
  }
}
