/**
 * Schemas for Effect `MutableHashMap` values.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import { $SchemaId } from "@beep/identity/packages";
import { A, Str } from "@beep/utils";
import * as O from "@beep/utils/Option";
import {
  Effect,
  MutableHashMap as MutableHashMap_,
  pipe,
  SchemaIssue,
  SchemaParser,
  SchemaTransformation,
} from "effect";
import * as S from "effect/Schema";

const $I = $SchemaId.create("MutableHashMap");

const formatEntries = <K, V>(
  entries: ReadonlyArray<readonly [K, V]>,
  formatKey: (key: K) => string,
  formatValue: (value: V) => string
): string =>
  pipe(
    entries,
    A.map(([key, value]) => `${formatKey(key)} => ${formatValue(value)}`),
    A.sort(Str.Order),
    A.join(", ")
  );

const makeMutableHashMapEquivalence =
  <K, V>(keyEquivalence: (self: K, that: K) => boolean, valueEquivalence: (self: V, that: V) => boolean) =>
  (self: Iterable<readonly [K, V]>, that: Iterable<readonly [K, V]>): boolean => {
    const selfEntries = A.fromIterable(self);
    const thatEntries = A.fromIterable(that);

    return (
      selfEntries.length === thatEntries.length &&
      pipe(
        selfEntries,
        A.every(([selfKey, selfValue]) =>
          pipe(
            thatEntries,
            A.some(([thatKey, thatValue]) => keyEquivalence(selfKey, thatKey) && valueEquivalence(selfValue, thatValue))
          )
        )
      )
    );
  };

const toReadonlyEntries = <K, V>(map: MutableHashMap_.MutableHashMap<K, V>): ReadonlyArray<readonly [K, V]> =>
  pipe(
    A.fromIterable(map),
    A.map(([key, value]): readonly [K, V] => [key, value])
  );

/**
 * Iso representation (serializable entry array) used by
 * {@link MutableHashMapFromSelf} for round-tripping.
 *
 * @since 0.0.0
 * @category models
 */
type MutableHashMapEntry<Key extends S.Top, Value extends S.Top> = S.Codec<
  readonly [Key["Type"], Value["Type"]],
  readonly [Key["Encoded"], Value["Encoded"]],
  Key["DecodingServices"] | Value["DecodingServices"],
  Key["EncodingServices"] | Value["EncodingServices"]
>;

/**
 * Serializable entry-array iso type for `MutableHashMap` schemas.
 *
 * **Example** (Satisfies entry-array iso type)
 *
 * ```ts
 * import type { MutableHashMapIso } from "@beep/schema/MutableHashMap"
 * import * as S from "effect/Schema"
 *
 * const entries = [["key", 1]] satisfies MutableHashMapIso<typeof S.String, typeof S.Finite>
 * console.log(entries.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type MutableHashMapIso<Key extends S.Top, Value extends S.Top> = ReadonlyArray<
  readonly [Key["Iso"], Value["Iso"]]
>;

/**
 * Schema for validating an existing `MutableHashMap` instance.
 *
 * **Example** (Validates existing MutableHashMap)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import * as S from "effect/Schema"
 * import { MutableHashMapFromSelf } from "@beep/schema/MutableHashMap"
 *
 * const MapSchema = MutableHashMapFromSelf({ key: S.String, value: S.Finite })
 * const map = MutableHashMap.fromIterable([["a", 1]])
 * console.log(S.is(MapSchema)(map))
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableHashMapFromSelf<Key extends S.Top, Value extends S.Top>
  extends S.declareConstructor<
    MutableHashMap_.MutableHashMap<Key["Type"], Value["Type"]>,
    MutableHashMap_.MutableHashMap<Key["Encoded"], Value["Encoded"]>,
    readonly [Key, Value],
    MutableHashMapIso<Key, Value>
  > {
  readonly key: Key;
  readonly Rebuild: this;
  readonly value: Value;
}

/**
 * Schema for transforming entry arrays into `MutableHashMap` instances.
 *
 * **Example** (Decodes entries to MutableHashMap)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MutableHashMap } from "@beep/schema/MutableHashMap"
 *
 * const StringNumberMap = MutableHashMap({ key: S.String, value: S.FiniteFromString })
 * const decoded = S.decodeUnknownSync(StringNumberMap)([["a", "1"]])
 * console.log(decoded)
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export interface MutableHashMap<Key extends S.Top, Value extends S.Top>
  extends S.decodeTo<
    MutableHashMapFromSelf<S.toType<Key>, S.toType<Value>>,
    S.$Array<MutableHashMapEntry<Key, Value>>
  > {
  readonly key: Key;
  readonly Rebuild: this;
  readonly value: Value;
}

/**
 * Type guard for Effect `MutableHashMap` values.
 *
 * **Example** (Guards MutableHashMap values)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import { isMutableHashMap } from "@beep/schema/MutableHashMap"
 *
 * console.log(isMutableHashMap(MutableHashMap.empty())) // true
 * console.log(isMutableHashMap({})) // false
 * ```
 *
 * @param value - Unknown input to test.
 * @returns `true` when `value` is a `MutableHashMap`.
 * @category guards
 * @since 0.0.0
 */
export const isMutableHashMap = <Key, Value>(value: unknown): value is MutableHashMap_.MutableHashMap<Key, Value> =>
  MutableHashMap_.isMutableHashMap(value);

/**
 * Schema for validating existing `MutableHashMap` instances while applying the
 * provided key and value schemas to each entry.
 *
 * **Example** (Decodes existing map entries)
 *
 * ```ts
 * import { MutableHashMap } from "effect"
 * import * as S from "effect/Schema"
 * import { MutableHashMapFromSelf } from "@beep/schema/MutableHashMap"
 *
 * const MapSchema = MutableHashMapFromSelf({ key: S.String, value: S.Finite })
 * const map = MutableHashMap.fromIterable([["a", 1]])
 * const decoded = S.decodeUnknownSync(MapSchema)(map)
 * console.log(MutableHashMap.has(decoded, "a"))
 * ```
 *
 * @param options - Schemas for keys and values.
 * @returns Schema whose encoded side is another `MutableHashMap` carrying the
 * encoded key and value types.
 * @category validation
 * @since 0.0.0
 */
export const MutableHashMapFromSelf = <Key extends S.Top, Value extends S.Top>(options: {
  readonly key: Key;
  readonly value: Value;
}): MutableHashMapFromSelf<Key, Value> => {
  const schema = S.declareConstructor<
    MutableHashMap_.MutableHashMap<Key["Type"], Value["Type"]>,
    MutableHashMap_.MutableHashMap<Key["Encoded"], Value["Encoded"]>,
    MutableHashMapIso<Key, Value>
  >()(
    [options.key, options.value],
    ([key, value]) => {
      const entries = S.Array(S.Tuple([key, value]));

      return (input, ast, parseOptions) => {
        if (!MutableHashMap_.isMutableHashMap(input)) {
          return Effect.fail(new SchemaIssue.InvalidType(ast));
        }

        return Effect.mapBothEager(SchemaParser.decodeEffect(entries)(A.fromIterable(input), parseOptions), {
          onSuccess: MutableHashMap_.fromIterable,
          onFailure: (issue) => new SchemaIssue.Composite(ast, [new SchemaIssue.Pointer(["entries"], issue)]),
        });
      };
    },
    {
      typeConstructor: {
        _tag: "effect/MutableHashMap",
      },
      generation: {
        runtime: "MutableHashMapFromSelf(?, ?)",
        Type: "MutableHashMap.MutableHashMap<?, ?>",
        importDeclaration: 'import * as MutableHashMap from "effect/MutableHashMap"',
      },
      expected: "MutableHashMap",
      description: "Schema for existing MutableHashMap instances.",
      toCodec: ([key, value]) =>
        S.link<MutableHashMap_.MutableHashMap<Key["Encoded"], Value["Encoded"]>>()(
          S.Array(S.Tuple([key, value])),
          SchemaTransformation.transform({
            decode: MutableHashMap_.fromIterable,
            encode: toReadonlyEntries,
          })
        ),
      toArbitrary:
        ([key, value]) =>
        (fc, ctx) => {
          const constraint = ctx.constraint ?? {};
          const constraints = O.getSomesStruct({
            minLength: O.fromUndefinedOr(constraint.minLength),
            maxLength: O.fromUndefinedOr(constraint.maxLength),
          });
          const minLength = constraints.minLength ?? 0;
          const terminalItem =
            key.terminal === undefined || value.terminal === undefined
              ? undefined
              : fc.tuple(key.terminal, value.terminal);
          const terminalEntries =
            minLength === 0
              ? fc.constant<Array<[Key["Type"], Value["Type"]]>>([])
              : terminalItem === undefined
                ? undefined
                : fc.array(terminalItem, { ...constraints, maxLength: minLength });
          const entries = fc.array(fc.tuple(key.arbitrary, value.arbitrary), constraints);
          const arbitraryEntries =
            terminalEntries === undefined || ctx.recursion === undefined
              ? entries
              : fc.oneof(ctx.recursion, terminalEntries, entries);
          return {
            arbitrary: arbitraryEntries.map(MutableHashMap_.fromIterable),
            terminal: terminalEntries?.map(MutableHashMap_.fromIterable),
          };
        },
      toEquivalence: ([key, value]) => makeMutableHashMapEquivalence(key, value),
      toFormatter:
        ([key, value]) =>
        (map) => {
          const size = MutableHashMap_.size(map);
          if (size === 0) {
            return "MutableHashMap(0) {}";
          }

          return `MutableHashMap(${size}) { ${formatEntries(toReadonlyEntries(map), key, value)} }`;
        },
    }
  );

  return S.make<MutableHashMapFromSelf<Key, Value>>(schema.ast, options).pipe(
    $I.annoteSchema("MutableHashMapFromSelf", {
      description: "Schema for validating existing MutableHashMap runtime values.",
    })
  );
};

/**
 * Schema for decoding entry arrays into `MutableHashMap` instances and encoding
 * maps back to arrays.
 *
 * **Example** (Round-trips map via entry arrays)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { MutableHashMap } from "@beep/schema/MutableHashMap"
 *
 * const StringNumberMap = MutableHashMap({
 *   key: S.String,
 *   value: S.FiniteFromString
 * })
 *
 * const decoded = S.decodeUnknownSync(StringNumberMap)([["a", "1"]])
 * const encoded = S.encodeSync(StringNumberMap)(decoded)
 * console.log(encoded)
 * ```
 *
 * @param options - Schemas for keys and values.
 * @returns Entry-array-backed schema for mutable hash maps.
 * @category validation
 * @since 0.0.0
 */
export const MutableHashMap = <Key extends S.Top, Value extends S.Top>(options: {
  readonly key: Key;
  readonly value: Value;
}): MutableHashMap<Key, Value> => {
  const entry = S.make<MutableHashMapEntry<Key, Value>>(S.Tuple([options.key, options.value]).ast);
  const entries = S.Array(entry);
  const schema = entries.pipe(
    S.decodeTo(
      MutableHashMapFromSelf({
        key: S.toType(options.key),
        value: S.toType(options.value),
      }),
      SchemaTransformation.transform({
        decode: MutableHashMap_.fromIterable,
        encode: (map): typeof entries.Type => A.fromIterable(map),
      })
    )
  );

  return S.make<MutableHashMap<Key, Value>>(schema.ast, {
    from: schema.from,
    to: schema.to,
    key: options.key,
    value: options.value,
  }).pipe(
    $I.annoteSchema("MutableHashMap", {
      description: "Entry-array-backed schema for Effect MutableHashMap values.",
    })
  );
};
