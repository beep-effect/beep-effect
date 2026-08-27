/**
 * Assemble a SchemaStore Draft-07 document from an Effect Schema source.
 *
 * Owns `$schema` + `$id` + root + `$defs`, the `#/definitions` → `#/$defs`
 * `$ref` rewrite the lowering makes necessary, and the annotation-carrier
 * re-graft so language-server keywords survive publication.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, JsonSchema, Result, Schema } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { AnnotationCarriers } from "./AnnotationCarriers.ts";
import type { CanonicalJsonError, CanonicalJsonOptions } from "./CanonicalJson.ts";
import { CanonicalJson } from "./CanonicalJson.ts";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";

const $I = $ScratchpadId.create("schemastore/StoreDocument");

const setOwn = (target: Record<string, unknown>, key: string, value: unknown): void => {
  Object.defineProperty(target, key, { value, writable: true, enumerable: true, configurable: true });
};

/**
 * The Draft-07 meta-schema URL SchemaStore documents declare as `$schema`.
 *
 * Deliberately carries the trailing `#` fragment: the SchemaStore corpus
 * (and the extraction source's committed files) use the fragment form,
 * where core's `JsonSchema.META_SCHEMA_URI_DRAFT_07` omits it.
 *
 * **Example** (The corpus URI includes a trailing hash)
 *
 * ```ts
 * import { DRAFT_07_META_SCHEMA } from "@beep/scratchpad/schemastore"
 *
 * console.log(DRAFT_07_META_SCHEMA.endsWith("#"))
 * // => true
 * console.log(DRAFT_07_META_SCHEMA)
 * // => "http://json-schema.org/draft-07/schema#"
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const DRAFT_07_META_SCHEMA = "http://json-schema.org/draft-07/schema#";

/**
 * Indicates that an Effect Schema could not be converted into a SchemaStore
 * document — core's JSON Schema generation rejected the schema, or the
 * generated document nested past the hardening cap.
 *
 * Raised by {@link StoreDocument.fromSchema}. The `cause` carries the
 * underlying failure for the operator; calling code branches on the tag.
 *
 * **Example** (Construct a conversion failure)
 *
 * ```ts
 * import { SchemaConversionError } from "@beep/scratchpad/schemastore"
 *
 * const error = SchemaConversionError.make({
 *   $id: "https://example.com/config.schema.json",
 *   cause: "unsupported schema combinator",
 * })
 *
 * console.log(error._tag)
 * // => "SchemaConversionError"
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class SchemaConversionError extends Schema.TaggedError<SchemaConversionError>($I`SchemaConversionError`)(
  "SchemaConversionError",
  {
    /** The `$id` of the document that failed to build. */
    $id: Schema.String,
    /** The underlying conversion failure. */
    cause: Schema.Defect(),
  },
  $I.annote("SchemaConversionError", {
    description: "Raised when an Effect Schema cannot be converted into a SchemaStore Draft-07 document.",
  })
) {
  /**
   * Operator-facing sentence naming the `$id` that failed to convert.
   *
   * **Example** (Read the failed document id)
   *
   * ```ts
   * import { SchemaConversionError } from "@beep/scratchpad/schemastore"
   *
   * const error = SchemaConversionError.make({
   *   $id: "https://example.com/config.schema.json",
   *   cause: "unsupported schema combinator",
   * })
   * console.log(error.message)
   * // => 'Failed to build SchemaStore document "https://example.com/config.schema.json"'
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Failed to build SchemaStore document "${this.$id}"`;
  }
}

/**
 * Options for {@link StoreDocument.fromSchema}.
 *
 * Not a runtime schema: core's `Schema.ToJsonSchemaOptions` may carry the live
 * `includeAnnotationKey` predicate. This boundary is program wiring rather
 * than serializable configuration data.
 *
 * @see {@link StoreDocument.fromSchema} for the pipeline these options configure.
 * @public
 * @category configuration
 * @since 0.0.0
 */
export interface StoreDocumentOptions {
  /** The canonical `$id` URL the document declares. */
  readonly $id: string;
  /**
   * Passed through to core's `Schema.toJsonSchemaDocument`
   * (`additionalProperties`, `generateDescriptions`,
   * `includeAnnotationKey`).
   *
   * The declared non-standard keyword families ({@link KeywordFamilies})
   * are **always admitted** and carried into the built document — annotate
   * a schema node (`Schema.String.annotate({ "x-taplo": ... })`) and the
   * key survives the Draft-07 lowering via the post-lowering re-graft
   * ({@link AnnotationCarriers}). A supplied `includeAnnotationKey` is
   * consulted *in addition* for other keys; know the boundary: keys it
   * admits outside the declared families reach the Draft 2020-12 document
   * but are **dropped by the Draft-07 lowering** (its keyword walk copies
   * a fixed subset) — verified against the installed beta.
   */
  readonly jsonSchema?: Schema.ToJsonSchemaOptions;
}

// Matches a Draft-07 `#/definitions/...` `$ref` pointer prefix. Core's
// Draft-07 lowering rewrites `#/$defs/...` refs to the canonical
// `#/definitions/...` form; the SchemaStore document keeps its pool under
// `$defs` (a Draft-07-valid alias), so refs are rewritten back to stay
// resolvable against that pool.
const DEFINITIONS_REF_PREFIX = /^#\/definitions(?=\/|$)/;

class RewriteDepthExceeded {
  readonly _tag = "RewriteDepthExceeded";
}

// Applies the carrier re-graft to one lowered node, folding a (practically
// unreachable for bounded core output) depth failure into the enclosing
// try/catch as the SchemaConversionError cause.
const carry = (source: unknown, target: unknown): Record<string, unknown> => {
  const result = AnnotationCarriers.carryResult(source, target);
  if (Result.isFailure(result)) {
    throw result.failure;
  }
  return result.success as Record<string, unknown>;
};

// Recursively rewrites `#/definitions/...` `$ref` string values back to
// `#/$defs/...`. Only `$ref` values are touched: keys, non-string `$ref`s
// and prose containing "#/definitions" pass through untouched.
const restoreDefsRefs = (node: unknown, depth: number): unknown => {
  if (depth >= MAX_NESTING_DEPTH) {
    throw new RewriteDepthExceeded();
  }
  if (A.isArray(node)) {
    return node.map((item) => restoreDefsRefs(item, depth + 1));
  }
  if (P.isObjectKeyword(node)) {
    // Every member is installed as an own data property, so a literal
    // `__proto__` key never invokes the inherited prototype setter. (Defense
    // in depth: probed at the installed beta, core's
    // generation and lowering strip `__proto__` keys before this walk
    // runs, but this walk must stay safe on its own terms.)
    const out = R.empty<string, unknown>();
    for (const [key, value] of R.toEntries(node as Record<string, unknown>)) {
      setOwn(
        out,
        key,
        key === "$ref" && P.isString(value)
          ? value.replace(DEFINITIONS_REF_PREFIX, "#/$defs")
          : restoreDefsRefs(value, depth + 1)
      );
    }
    return out;
  }
  return node;
};

/**
 * A SchemaStore-shaped Draft-07 JSON Schema document assembled from an
 * Effect Schema source: `$schema` (the Draft-07 meta-schema) + `$id` + the
 * root schema + the `$defs` pool.
 *
 * {@link StoreDocument.fromSchema} owns the whole pipeline: core's
 * `Schema.toJsonSchemaDocument` (Draft 2020-12), core's
 * `JsonSchema.toDocumentDraft07` lowering, the `#/definitions` →
 * `#/$defs` `$ref` rewrite the lowering makes necessary — so every `$ref`
 * in a built document already resolves against the `$defs` pool — and the
 * {@link AnnotationCarriers} re-graft, so annotated non-standard keyword
 * families ({@link KeywordFamilies}) survive into the built document. The
 * package owns assembly and publication shape, not a JSON Schema engine.
 *
 * **Gotchas**
 *
 * `$schema` always uses {@link DRAFT_07_META_SCHEMA}, including the trailing
 * `#` (core's URI omits it). An empty `$defs` pool is omitted from
 * {@link StoreDocument.toJson} rather than emitted as `{}`. Extra
 * `includeAnnotationKey` keys die at lowering unless they belong to
 * {@link KeywordFamilies}. Annotate definition nodes, not usage sites —
 * {@link AnnotationCarriers} has nothing to graft otherwise.
 *
 * **Example** (Build a Draft-07 store document)
 *
 * ```ts
 * import { StoreDocument } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const result = StoreDocument.fromSchemaResult(S.Struct({ name: S.String }), {
 *   $id: "https://example.com/config.schema.json",
 * })
 *
 * if (Result.isSuccess(result)) {
 *   const json = result.success.toJson()
 *   console.log(json.$schema)
 *   // => "http://json-schema.org/draft-07/schema#"
 *   console.log("$defs" in json)
 *   // => false
 * }
 * ```
 *
 * @see {@link AnnotationCarriers} for the post-lowering re-graft of declared language-server keys.
 * @see {@link DRAFT_07_META_SCHEMA} for the `$schema` URI including the trailing `#`.
 * @see {@link CanonicalJson} for the serializer `serializeResult` delegates to.
 * @see {@link KeywordFamilies} for the annotation keys always admitted into generation.
 * @public
 * @category models
 * @since 0.0.0
 */
export class StoreDocument extends Schema.Class<StoreDocument>($I`StoreDocument`)(
  {
    /** The meta-schema URL ({@link DRAFT_07_META_SCHEMA}). */
    $schema: Schema.String,
    /** The canonical `$id` URL. */
    $id: Schema.String,
    /** The root schema's keywords, without the definitions pool. */
    root: Schema.Record(Schema.String, Schema.Unknown),
    /** The definitions pool, emitted under `$defs`. */
    defs: Schema.Record(Schema.String, Schema.Unknown),
  },
  $I.annote("StoreDocument", {
    description: "A SchemaStore-shaped Draft-07 JSON Schema document: $schema, $id, root keywords, and a $defs pool.",
  })
) {
  /**
   * Builds a Draft-07 document from its parts, filling `$schema` with
   * {@link DRAFT_07_META_SCHEMA}.
   *
   * `fromSchema` sets the meta-schema unconditionally; hand-building a
   * value with `make` otherwise means importing the constant just to
   * repeat what the package already knows. `$schema` stays a real field
   * rather than a defaulted one — it declares the document's dialect, and
   * a document that does not say which dialect it is written in is worse
   * than one that repeats itself — so this is a constructor, not a
   * default.
   *
   * **Example** (Fill `$schema` and omit empty `$defs`)
   *
   * ```ts
   * import { StoreDocument } from "@beep/scratchpad/schemastore"
   *
   * const document = StoreDocument.draft07({
   *   $id: "https://example.com/config.schema.json",
   *   root: { type: "object" },
   * })
   * const json = document.toJson()
   * console.log(json.$schema)
   * // => "http://json-schema.org/draft-07/schema#"
   * console.log("$defs" in json)
   * // => false
   * ```
   *
   * @since 0.0.0
   */
  static draft07(options: {
    readonly $id: string;
    readonly root: Record<string, unknown>;
    readonly defs?: Record<string, unknown>;
  }): StoreDocument {
    return StoreDocument.make({
      $schema: DRAFT_07_META_SCHEMA,
      $id: options.$id,
      root: options.root,
      defs: options.defs ?? {},
    });
  }

  /**
   * Builds the document for an Effect Schema source. Pure and
   * synchronous — the primitive form; {@link StoreDocument.fromSchema} is
   * the same pipeline behind a span.
   *
   * **Example** (Lower a struct to Draft-07)
   *
   * ```ts
   * import { StoreDocument } from "@beep/scratchpad/schemastore"
   * import { Result } from "effect"
   * import * as S from "effect/Schema"
   *
   * const result = StoreDocument.fromSchemaResult(S.Struct({ name: S.String }), {
   *   $id: "https://example.com/config.schema.json",
   * })
   *
   * console.log(Result.isSuccess(result))
   * // => true
   * if (Result.isSuccess(result)) {
   *   console.log(result.success.toJson().$schema)
   *   // => "http://json-schema.org/draft-07/schema#"
   * }
   * ```
   *
   * @since 0.0.0
   */
  static fromSchemaResult(
    source: Schema.Constraint,
    options: StoreDocumentOptions
  ): Result.Result<StoreDocument, SchemaConversionError> {
    try {
      const userIncludes = options.jsonSchema?.includeAnnotationKey;
      const document = Schema.toJsonSchemaDocument(source, {
        ...options.jsonSchema,
        // The declared families are always admitted so annotations can
        // be carried; the user's predicate is consulted in addition.
        includeAnnotationKey: (key) => KeywordFamilies.isDeclared(key) || userIncludes?.(key) === true,
      });
      const lowered = JsonSchema.toDocumentDraft07(document);
      // Carriers re-graft AFTER the `$ref` rewrite, so carrier payloads
      // pass through verbatim rather than being walked by the rewrite.
      const root = carry(document.schema, restoreDefsRefs(lowered.schema, 0));
      // `setOwn` gives the definitions pool the same `__proto__` hardening
      // as the rewrite walk: that name must land as an own key.
      const defs = R.empty<string, unknown>();
      for (const [name, definition] of R.toEntries(lowered.definitions)) {
        setOwn(defs, name, carry(document.definitions[name], restoreDefsRefs(definition, 1)));
      }
      return Result.succeed(StoreDocument.make({ $schema: DRAFT_07_META_SCHEMA, $id: options.$id, root, defs }));
    } catch (cause) {
      return Result.fail(SchemaConversionError.make({ $id: options.$id, cause }));
    }
  }

  /**
   * Effect form of {@link StoreDocument.fromSchemaResult}, adding only the
   * `StoreDocument.fromSchema` span. Defined in terms of the `Result`
   * primitive — synchronous callers can use that variant directly.
   */
  static readonly fromSchema = Effect.fn("StoreDocument.fromSchema")(
    (source: Schema.Constraint, options: StoreDocumentOptions): Effect.Effect<StoreDocument, SchemaConversionError> =>
      Effect.fromResult(StoreDocument.fromSchemaResult(source, options))
  );

  /**
   * The flat SchemaStore publication shape: `$schema`, `$id`, the root
   * schema's keywords spread at the top level, then the `$defs` pool.
   * `$defs` is omitted when the pool is empty (a deliberate divergence
   * from the extraction source, which always emitted the key).
   *
   * **Example** (Spread root keywords, omit empty `$defs`)
   *
   * ```ts
   * import { StoreDocument } from "@beep/scratchpad/schemastore"
   *
   * const json = StoreDocument.draft07({
   *   $id: "https://example.com/config.schema.json",
   *   root: { type: "object", description: "Build configuration" },
   * }).toJson()
   *
   * console.log(json.type)
   * // => "object"
   * console.log("$defs" in json)
   * // => false
   * ```
   *
   * @since 0.0.0
   */
  toJson(): Record<string, unknown> {
    return {
      $schema: this.$schema,
      $id: this.$id,
      ...this.root,
      ...(R.isEmptyReadonlyRecord(this.defs) ? {} : { $defs: this.defs }),
    };
  }

  /**
   * Canonical JSON text of {@link StoreDocument.toJson}, via
   * {@link CanonicalJson.serializeResult} — one serializer, so the
   * document and any consumer-serialized value cannot drift.
   *
   * **Example** (Trailing newline, tab indent)
   *
   * ```ts
   * import { StoreDocument } from "@beep/scratchpad/schemastore"
   * import { Result } from "effect"
   *
   * const text = StoreDocument.draft07({
   *   $id: "https://example.com/config.schema.json",
   *   root: { type: "boolean" },
   * }).serializeResult()
   *
   * console.log(Result.isSuccess(text) ? text.success.endsWith("\n") : text)
   * // => true
   * ```
   *
   * @since 0.0.0
   */
  serializeResult(options?: CanonicalJsonOptions): Result.Result<string, CanonicalJsonError> {
    return CanonicalJson.serializeResult(this.toJson(), options);
  }
}
