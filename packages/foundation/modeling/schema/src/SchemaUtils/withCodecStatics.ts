/**
 * Selective, schema-bound Effect codec helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import { MutableHashSet } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { staticDescriptorInstaller } from "./internal/staticDescriptors.ts";
import { toEquivalence } from "./toEquivalence.ts";
import type { DualEquivalence } from "./toEquivalence.ts";

const $I = $SchemaId.create("SchemaUtils/withCodecStatics");

type CodecSchema = S.Schema<unknown> & S.Constraint;

type ServiceFreeDecodeKey =
  | "decodeExit"
  | "decodeOption"
  | "decodePromise"
  | "decodeResult"
  | "decodeSync"
  | "decodeUnknownExit"
  | "decodeUnknownOption"
  | "decodeUnknownPromise"
  | "decodeUnknownResult"
  | "decodeUnknownSync";

type ServiceFreeEncodeKey =
  | "encodeExit"
  | "encodeOption"
  | "encodePromise"
  | "encodeResult"
  | "encodeSync"
  | "encodeUnknownExit"
  | "encodeUnknownOption"
  | "encodeUnknownPromise"
  | "encodeUnknownResult"
  | "encodeUnknownSync";

/**
 * Exact helper registry available to {@link withCodecStatics} and
 * {@link classStatics}.
 *
 * **Details**
 *
 * The registry uses Effect's native runner names. JSON-string conveniences,
 * legacy aliases, and `toStandardSchemaV1` are intentionally absent.
 *
 * @typeParam Sch - Schema interpreted by the selected helpers.
 * @category models
 * @since 0.0.0
 */
export interface CodecStaticRegistry<Sch extends CodecSchema> {
  readonly asserts: <I>(input: I) => asserts input is I & Sch["Type"];
  readonly decodeEffect: ReturnType<typeof S.decodeEffect<Sch>>;
  readonly decodeExit: Sch extends S.ConstraintDecoder<unknown> ? ReturnType<typeof S.decodeExit<Sch>> : never;
  readonly decodeOption: Sch extends S.ConstraintDecoder<unknown> ? ReturnType<typeof S.decodeOption<Sch>> : never;
  readonly decodePromise: Sch extends S.ConstraintDecoder<unknown> ? ReturnType<typeof S.decodePromise<Sch>> : never;
  readonly decodeResult: Sch extends S.ConstraintDecoder<unknown> ? ReturnType<typeof S.decodeResult<Sch>> : never;
  readonly decodeSync: Sch extends S.ConstraintDecoder<unknown> ? ReturnType<typeof S.decodeSync<Sch>> : never;
  readonly decodeUnknownEffect: ReturnType<typeof S.decodeUnknownEffect<Sch>>;
  readonly decodeUnknownExit: Sch extends S.ConstraintDecoder<unknown>
    ? ReturnType<typeof S.decodeUnknownExit<Sch>>
    : never;
  readonly decodeUnknownOption: Sch extends S.ConstraintDecoder<unknown>
    ? ReturnType<typeof S.decodeUnknownOption<Sch>>
    : never;
  readonly decodeUnknownPromise: Sch extends S.ConstraintDecoder<unknown>
    ? ReturnType<typeof S.decodeUnknownPromise<Sch>>
    : never;
  readonly decodeUnknownResult: Sch extends S.ConstraintDecoder<unknown>
    ? ReturnType<typeof S.decodeUnknownResult<Sch>>
    : never;
  readonly decodeUnknownSync: Sch extends S.ConstraintDecoder<unknown>
    ? ReturnType<typeof S.decodeUnknownSync<Sch>>
    : never;
  readonly encodeEffect: ReturnType<typeof S.encodeEffect<Sch>>;
  readonly encodeExit: Sch extends S.ConstraintEncoder<unknown> ? ReturnType<typeof S.encodeExit<Sch>> : never;
  readonly encodeOption: Sch extends S.ConstraintEncoder<unknown> ? ReturnType<typeof S.encodeOption<Sch>> : never;
  readonly encodePromise: Sch extends S.ConstraintEncoder<unknown> ? ReturnType<typeof S.encodePromise<Sch>> : never;
  readonly encodeResult: Sch extends S.ConstraintEncoder<unknown> ? ReturnType<typeof S.encodeResult<Sch>> : never;
  readonly encodeSync: Sch extends S.ConstraintEncoder<unknown> ? ReturnType<typeof S.encodeSync<Sch>> : never;
  readonly encodeUnknownEffect: ReturnType<typeof S.encodeUnknownEffect<Sch>>;
  readonly encodeUnknownExit: Sch extends S.ConstraintEncoder<unknown>
    ? ReturnType<typeof S.encodeUnknownExit<Sch>>
    : never;
  readonly encodeUnknownOption: Sch extends S.ConstraintEncoder<unknown>
    ? ReturnType<typeof S.encodeUnknownOption<Sch>>
    : never;
  readonly encodeUnknownPromise: Sch extends S.ConstraintEncoder<unknown>
    ? ReturnType<typeof S.encodeUnknownPromise<Sch>>
    : never;
  readonly encodeUnknownResult: Sch extends S.ConstraintEncoder<unknown>
    ? ReturnType<typeof S.encodeUnknownResult<Sch>>
    : never;
  readonly encodeUnknownSync: Sch extends S.ConstraintEncoder<unknown>
    ? ReturnType<typeof S.encodeUnknownSync<Sch>>
    : never;
  readonly equivalence: DualEquivalence<Sch["Type"]>;
  readonly is: ReturnType<typeof S.is<Sch>>;
  readonly toArbitrary: ReturnType<typeof S.toArbitrary<Sch>>;
}

const codecStaticKeys = [
  "asserts",
  "decodeEffect",
  "decodeExit",
  "decodeOption",
  "decodePromise",
  "decodeResult",
  "decodeSync",
  "decodeUnknownEffect",
  "decodeUnknownExit",
  "decodeUnknownOption",
  "decodeUnknownPromise",
  "decodeUnknownResult",
  "decodeUnknownSync",
  "encodeEffect",
  "encodeExit",
  "encodeOption",
  "encodePromise",
  "encodeResult",
  "encodeSync",
  "encodeUnknownEffect",
  "encodeUnknownExit",
  "encodeUnknownOption",
  "encodeUnknownPromise",
  "encodeUnknownResult",
  "encodeUnknownSync",
  "equivalence",
  "is",
  "toArbitrary",
] satisfies ReadonlyArray<keyof CodecStaticRegistry<CodecSchema>>;

/**
 * Supported selective codec-static name.
 *
 * **Example** (Validate a static name)
 *
 * ```ts import.meta.vitest name="Validate a static name"
 * import { CodecStaticKey } from "@beep/schema/SchemaUtils/withCodecStatics"
 * import * as S from "effect/Schema"
 *
 * S.is(CodecStaticKey)("decodeEffect") // => true
 * S.is(CodecStaticKey)("decodeEffectFromJsonString") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodecStaticKey = S.Literals(codecStaticKeys).pipe(
  $I.annoteSchema("CodecStaticKey", {
    description: "Effect-native helper name accepted by selective codec-static APIs.",
  })
);

/**
 * Name accepted by {@link CodecStaticKey}.
 *
 * @see {@link CodecStaticKey} for runtime validation and the complete option set.
 * @category type-level
 * @since 0.0.0
 */
export type CodecStaticKey = typeof CodecStaticKey.Type;

/**
 * Non-empty tuple accepted by the selective helper APIs.
 *
 * @category type-level
 * @since 0.0.0
 */
export type CodecStaticKeys = readonly [CodecStaticKey, ...ReadonlyArray<CodecStaticKey>];

type HasDuplicateKeys<
  Keys extends ReadonlyArray<CodecStaticKey>,
  Seen extends CodecStaticKey = never,
> = Keys extends readonly [infer Head extends CodecStaticKey, ...infer Tail extends ReadonlyArray<CodecStaticKey>]
  ? Head extends Seen
    ? true
    : HasDuplicateKeys<Tail, Seen | Head>
  : false;

type ValidCodecStaticKeys<Keys extends CodecStaticKeys> = HasDuplicateKeys<Keys> extends true ? never : Keys;

type SchemaForCodecStaticKeys<Keys extends CodecStaticKeys> = CodecSchema &
  (Extract<Keys[number], ServiceFreeDecodeKey> extends never ? unknown : S.ConstraintDecoder<unknown>) &
  (Extract<Keys[number], ServiceFreeEncodeKey> extends never ? unknown : S.ConstraintEncoder<unknown>);

/**
 * Exact selected helper bag for a schema and key tuple.
 *
 * @typeParam Sch - Schema interpreted by the selected helpers.
 * @typeParam Keys - Helper names included in the resulting bag.
 * @category models
 * @since 0.0.0
 */
export type SelectedCodecStatics<Sch extends CodecSchema, Keys extends CodecStaticKeys> = Pick<
  CodecStaticRegistry<Sch>,
  Keys[number]
>;

type SchemaWithSelectedCodecStatics<Sch extends CodecSchema, Keys extends CodecStaticKeys> = Sch &
  SelectedCodecStatics<Sch, Keys>;

/**
 * Configuration error raised before selective statics are installed.
 *
 * **Example** (Detect a duplicate selection)
 *
 * ```ts
 * import { CodecStaticSelectionError, withCodecStatics } from "@beep/schema/SchemaUtils/withCodecStatics"
 * import * as S from "effect/Schema"
 *
 * try {
 *   Reflect.apply(withCodecStatics, undefined, [S.String, ["is", "is"]])
 * } catch (error) {
 *   console.log(error instanceof CodecStaticSelectionError) // true
 * }
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CodecStaticSelectionError extends S.TaggedError<CodecStaticSelectionError>($I`CodecStaticSelectionError`)(
  "CodecStaticSelectionError",
  {
    reason: S.Literals([
      "duplicate-key",
      "empty-selection",
      "missing-native-static",
      "pre-attached-static",
      "property-conflict",
    ]),
    key: S.String,
    message: S.String,
  },
  $I.annoteError<CodecStaticSelectionError>("CodecStaticSelectionError", {
    description: "Raised when a selective codec-static declaration is invalid or would overwrite an existing property.",
  })
) {}

type CodecStaticFactory = (schema: CodecSchema) => unknown;
type NativeCodecStaticKey = Exclude<CodecStaticKey, "asserts" | "equivalence">;

const nativeCodecStatic =
  (key: NativeCodecStaticKey): CodecStaticFactory =>
  (schema) => {
    const factory = Reflect.get(S, key);
    /* v8 ignore next 6 -- every key comes from the closed, type-checked Effect Schema helper registry above. */
    if (!P.isFunction(factory)) {
      throw CodecStaticSelectionError.make({
        reason: "missing-native-static",
        key,
        message: `Effect Schema does not export the '${key}' helper.`,
      });
    }
    return Reflect.apply(factory, undefined, [schema]);
  };

const codecStaticFactories = {
  asserts: (schema) => (input: unknown) => S.asserts(schema, input),
  decodeEffect: nativeCodecStatic("decodeEffect"),
  decodeExit: nativeCodecStatic("decodeExit"),
  decodeOption: nativeCodecStatic("decodeOption"),
  decodePromise: nativeCodecStatic("decodePromise"),
  decodeResult: nativeCodecStatic("decodeResult"),
  decodeSync: nativeCodecStatic("decodeSync"),
  decodeUnknownEffect: nativeCodecStatic("decodeUnknownEffect"),
  decodeUnknownExit: nativeCodecStatic("decodeUnknownExit"),
  decodeUnknownOption: nativeCodecStatic("decodeUnknownOption"),
  decodeUnknownPromise: nativeCodecStatic("decodeUnknownPromise"),
  decodeUnknownResult: nativeCodecStatic("decodeUnknownResult"),
  decodeUnknownSync: nativeCodecStatic("decodeUnknownSync"),
  encodeEffect: nativeCodecStatic("encodeEffect"),
  encodeExit: nativeCodecStatic("encodeExit"),
  encodeOption: nativeCodecStatic("encodeOption"),
  encodePromise: nativeCodecStatic("encodePromise"),
  encodeResult: nativeCodecStatic("encodeResult"),
  encodeSync: nativeCodecStatic("encodeSync"),
  encodeUnknownEffect: nativeCodecStatic("encodeUnknownEffect"),
  encodeUnknownExit: nativeCodecStatic("encodeUnknownExit"),
  encodeUnknownOption: nativeCodecStatic("encodeUnknownOption"),
  encodeUnknownPromise: nativeCodecStatic("encodeUnknownPromise"),
  encodeUnknownResult: nativeCodecStatic("encodeUnknownResult"),
  encodeUnknownSync: nativeCodecStatic("encodeUnknownSync"),
  equivalence: (schema) => toEquivalence(schema),
  is: nativeCodecStatic("is"),
  toArbitrary: nativeCodecStatic("toArbitrary"),
} satisfies Record<CodecStaticKey, CodecStaticFactory>;

const validateKeys = (keys: ReadonlyArray<CodecStaticKey>): void => {
  if (A.isReadonlyArrayEmpty(keys)) {
    throw CodecStaticSelectionError.make({
      reason: "empty-selection",
      key: "",
      message: "Select at least one codec static.",
    });
  }

  const seen = MutableHashSet.empty<CodecStaticKey>();
  for (const key of keys) {
    if (MutableHashSet.has(seen, key)) {
      throw CodecStaticSelectionError.make({
        reason: "duplicate-key",
        key,
        message: `Codec static '${key}' is selected more than once.`,
      });
    }
    MutableHashSet.add(seen, key);
  }
};

const propertyKeyLabel = (key: PropertyKey): string => (P.isSymbol(key) ? key.toString() : `${key}`);

const findCustomOwnKey = (source: CodecSchema, rebuilt: CodecSchema): PropertyKey | undefined => {
  for (const key of Reflect.ownKeys(source)) {
    if (Reflect.getOwnPropertyDescriptor(rebuilt, key) === undefined) {
      return key;
    }
  }
  return undefined;
};

const installOnOwnedSchema = (owned: CodecSchema, keys: ReadonlyArray<CodecStaticKey>): CodecSchema => {
  const originalRebuild = owned.rebuild;

  for (const key of keys) {
    staticDescriptorInstaller.install(
      owned,
      { [key]: codecStaticFactories[key](owned) },
      "strict",
      /* v8 ignore next 7 -- the fresh rebuild and pre-attached-static checks make this defensive callback unreachable. */
      (conflictingKey) => {
        throw CodecStaticSelectionError.make({
          reason: "property-conflict",
          key: conflictingKey,
          message: `Codec static '${conflictingKey}' already exists on the owned schema.`,
        });
      }
    );
  }

  Reflect.defineProperty(owned, "rebuild", {
    value: (...args: ReadonlyArray<unknown>) => installOnOwnedSchema(Reflect.apply(originalRebuild, owned, args), keys),
    enumerable: false,
    writable: false,
    configurable: true,
  });

  return owned;
};

function attachSelectedCodecStatics<const Keys extends CodecStaticKeys, Sch extends SchemaForCodecStaticKeys<Keys>>(
  self: Sch,
  keys: ValidCodecStaticKeys<Keys>
): SchemaWithSelectedCodecStatics<Sch, Keys>;
function attachSelectedCodecStatics(self: CodecSchema, keys: ReadonlyArray<CodecStaticKey>): CodecSchema {
  validateKeys(keys);
  const owned = self.rebuild(self.ast);
  const customOwnKey = findCustomOwnKey(self, owned);

  if (customOwnKey !== undefined) {
    const key = propertyKeyLabel(customOwnKey);
    throw CodecStaticSelectionError.make({
      reason: "pre-attached-static",
      key,
      message: `Schema property '${key}' would be lost by the owned rebuild. Attach codec statics before custom statics.`,
    });
  }

  for (const key of codecStaticKeys) {
    if (Reflect.getOwnPropertyDescriptor(self, key) !== undefined) {
      throw CodecStaticSelectionError.make({
        reason: "pre-attached-static",
        key,
        message: `Codec static '${key}' is already attached to the supplied schema; selective schemas cannot be reselected.`,
      });
    }
  }

  return installOnOwnedSchema(owned, keys);
}

/**
 * Attach exactly the selected codec helpers to a fresh owned schema rebuild.
 *
 * **When to use**
 *
 * Use when schema-bound runners should be compiled once at declaration time
 * and the declaration should expose only the helpers its consumers need.
 *
 * **Gotchas**
 *
 * The selection must be a non-empty tuple with no duplicate keys. Apply this
 * helper before custom statics; it fails closed instead of dropping or
 * overwriting them.
 *
 * **Example** (Select a guard and Effect decoder)
 *
 * ```ts import.meta.vitest name="Select a guard and Effect decoder"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import { withCodecStatics } from "@beep/schema/SchemaUtils/withCodecStatics"
 *
 * const Count = S.NumberFromString.pipe(
 *   withCodecStatics(["decodeEffect", "is"])
 * )
 *
 * Count.is(42) // => true
 * Effect.runSync(Count.decodeEffect("42")) // => 42
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const withCodecStatics: {
  <const Keys extends CodecStaticKeys>(
    keys: ValidCodecStaticKeys<Keys>
  ): <Sch extends SchemaForCodecStaticKeys<Keys>>(self: Sch) => SchemaWithSelectedCodecStatics<Sch, Keys>;
  <const Keys extends CodecStaticKeys, Sch extends SchemaForCodecStaticKeys<Keys>>(
    self: Sch,
    keys: ValidCodecStaticKeys<Keys>
  ): SchemaWithSelectedCodecStatics<Sch, Keys>;
} = dual(2, attachSelectedCodecStatics);

function makeClassStatics<const Keys extends CodecStaticKeys, Sch extends SchemaForCodecStaticKeys<Keys>>(
  schema: Sch,
  keys: ValidCodecStaticKeys<Keys>
): Readonly<SelectedCodecStatics<Sch, Keys>>;
function makeClassStatics(schema: CodecSchema, keys: ReadonlyArray<CodecStaticKey>): Readonly<Record<string, unknown>> {
  validateKeys(keys);
  const statics: Record<string, unknown> = {};

  for (const key of keys) {
    staticDescriptorInstaller.install(
      statics,
      { [key]: codecStaticFactories[key](schema) },
      "strict",
      /* v8 ignore next 7 -- validated unique keys are installed into a new empty utility bag. */
      (conflictingKey) => {
        throw CodecStaticSelectionError.make({
          reason: "property-conflict",
          key: conflictingKey,
          message: `Class codec static '${conflictingKey}' already exists in the utility bag.`,
        });
      }
    );
  }

  return Object.freeze(statics);
}

/**
 * Build an exact frozen codec-helper bag for an Effect Schema class.
 *
 * **When to use**
 *
 * Use when declaring an `S.Class` or `S.TaggedClass` static initializer to keep the
 * constructor intact while providing a concise destructurable utility bag.
 *
 * **Example** (Destructure class codec helpers)
 *
 * ```ts import.meta.vitest name="Destructure class codec helpers"
 * import { $SchemaId } from "@beep/identity/packages"
 * import { classStatics } from "@beep/schema/SchemaUtils/withCodecStatics"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("Docs")
 * class User extends S.Class<User>($I`User`)({ name: S.String }) {
 *   static readonly utils = classStatics(this, ["decodeEffect", "is"])
 * }
 *
 * const { is } = User.utils
 * is(User.make({ name: "Ada" })) // => true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const classStatics: {
  <const Keys extends CodecStaticKeys>(
    keys: ValidCodecStaticKeys<Keys>
  ): <Sch extends SchemaForCodecStaticKeys<Keys>>(schema: Sch) => Readonly<SelectedCodecStatics<Sch, Keys>>;
  <const Keys extends CodecStaticKeys, Sch extends SchemaForCodecStaticKeys<Keys>>(
    schema: Sch,
    keys: ValidCodecStaticKeys<Keys>
  ): Readonly<SelectedCodecStatics<Sch, Keys>>;
} = dual(2, makeClassStatics);
