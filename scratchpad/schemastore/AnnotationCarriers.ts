/**
 * Re-graft language-server annotation keywords that Draft-07 lowering drops.
 *
 * Core's `JsonSchema.toDocumentDraft07` copies a fixed keyword subset, so
 * vscode / taplo / tombi / IntelliJ keys admitted into the Draft 2020-12
 * document never survive lowering on their own. This module walks the two
 * trees in lockstep and copies only {@link KeywordFamilies.isDeclared} keys
 * onto the lowered node.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { Effect, Match, Result, Schema } from "effect";
import * as A from "effect/Array";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { KeywordFamilies } from "./KeywordFamilies.ts";

const $I = $ScratchpadId.create("schemastore/AnnotationCarriers");

/**
 * Indicates that the carrier re-graft walk nested past the package's
 * hardening cap (256 levels), which also intercepts cyclic inputs before
 * they can recurse forever.
 *
 * Raised by {@link AnnotationCarriers.carry}.
 *
 * **Example** (Construct the depth-cap error)
 *
 * ```ts
 * import { CarrierDepthExceededError } from "@beep/scratchpad/schemastore"
 *
 * const error = CarrierDepthExceededError.make({ path: "/items/0", maxDepth: 256 })
 *
 * console.log(error._tag)
 * // => "CarrierDepthExceededError"
 * console.log(error.maxDepth)
 * // => 256
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class CarrierDepthExceededError extends Schema.TaggedError<CarrierDepthExceededError>(
  $I`CarrierDepthExceededError`
)(
  "CarrierDepthExceededError",
  {
    /** JSON pointer (in the lowered document's coordinates) where the cap was hit. */
    path: Schema.String,
    /** The nesting cap that was exceeded. */
    maxDepth: Schema.Finite,
  },
  $I.annote("CarrierDepthExceededError", {
    description:
      "Raised when the annotation-carrier re-graft walk nests past the 256-level hardening cap, including cyclic schema nodes.",
  })
) {
  /**
   * Operator-facing sentence naming the nesting cap and JSON pointer.
   *
   * **Example** (Read the cap and pointer from the message)
   *
   * ```ts
   * import { CarrierDepthExceededError } from "@beep/scratchpad/schemastore"
   *
   * const error = CarrierDepthExceededError.make({ path: "/items/0", maxDepth: 256 })
   * console.log(error.message)
   * // => 'Carrier re-graft nesting exceeds 256 levels at "/items/0"'
   * ```
   *
   * @since 0.0.0
   */
  override get message(): string {
    return `Carrier re-graft nesting exceeds ${this.maxDepth} levels at "${this.path}"`;
  }
}

// Internal throw carrier so the recursive walk can surface the typed error
// from arbitrary depth without threading Results through every frame.
class CarryFailure {
  readonly error: CarrierDepthExceededError;
  constructor(error: CarrierDepthExceededError) {
    this.error = error;
  }
}

const escapePointerSegment = (segment: string): string => segment.replace(/~/g, "~0").replace(/\//g, "~1");

const isSchemaObject = (node: unknown): node is Record<string, unknown> => P.isObjectKeyword(node) && !A.isArray(node);

// Grafts one schema-map member (`properties` / `patternProperties`): every
// member the source and target share is grafted; members only one side has
// pass through untouched.
const graftMap = (source: unknown, target: unknown, path: string, depth: number): unknown => {
  if (!isSchemaObject(source) || !isSchemaObject(target)) {
    return target;
  }
  const out: Record<string, unknown> = { ...target };
  for (const [name, subschema] of R.toEntries(source)) {
    if (R.has(target, name)) {
      out[name] = graft(subschema, target[name], `${path}/${escapePointerSegment(name)}`, depth + 1);
    }
  }
  return out;
};

// Grafts parallel schema arrays (`allOf` / `anyOf` / `oneOf`, and the
// tuple `prefixItems` → `items` pairing) element-wise by index.
const graftArray = (source: unknown, target: unknown, path: string, depth: number): unknown => {
  if (!A.isArray(source) || !A.isArray(target)) {
    return target;
  }
  return target.map((element, index) =>
    index < source.length ? graft(source[index], element, `${path}/${index}`, depth + 1) : element
  );
};

// The parallel walk. Mirrors core's `toSchemaDraft07` keyword walk exactly:
// it descends only where the lowering descends, and maps the one position
// the lowering moves — Draft 2020-12 `prefixItems` becomes the Draft-07
// `items` array (with a trailing `items` schema becoming `additionalItems`).
// Positions the lowering drops entirely are never visited, so a carrier on
// such a node is not carried (core's generator does not emit those
// positions, so this is unreachable from the real pipeline).
const graft = (source: unknown, target: unknown, path: string, depth: number): unknown => {
  if (depth >= MAX_NESTING_DEPTH) {
    throw new CarryFailure(CarrierDepthExceededError.make({ path, maxDepth: MAX_NESTING_DEPTH }));
  }
  if (!isSchemaObject(source) || !isSchemaObject(target)) {
    return target;
  }
  const out: Record<string, unknown> = { ...target };
  for (const [key, value] of R.toEntries(source)) {
    if (KeywordFamilies.isDeclared(key)) {
      out[key] = value;
      continue;
    }
    const keyPath = `${path}/${escapePointerSegment(key)}`;
    Match.value(key).pipe(
      Match.when("properties", () => {
        if (R.has(out, key)) {
          out[key] = graftMap(value, out[key], keyPath, depth);
        }
      }),
      Match.when("patternProperties", () => {
        if (R.has(out, key)) out[key] = graftMap(value, out[key], keyPath, depth);
      }),
      Match.when("additionalProperties", () => {
        if (R.has(out, key)) {
          out[key] = graft(value, out[key], keyPath, depth + 1);
        }
      }),
      Match.when("propertyNames", () => {
        if (R.has(out, key)) out[key] = graft(value, out[key], keyPath, depth + 1);
      }),
      Match.when("allOf", () => {
        if (R.has(out, key)) {
          out[key] = graftArray(value, out[key], keyPath, depth);
        }
      }),
      Match.when("anyOf", () => {
        if (R.has(out, key)) out[key] = graftArray(value, out[key], keyPath, depth);
      }),
      Match.when("oneOf", () => {
        if (R.has(out, key)) out[key] = graftArray(value, out[key], keyPath, depth);
      }),
      Match.when("prefixItems", () => {
        // The lowering rewrites 2020-12 tuples: an array `prefixItems`
        // becomes the Draft-07 `items` array; a (non-standard) single
        // schema becomes a single `items` schema.
        if (R.has(out, "items")) {
          out.items = A.isArray(value)
            ? graftArray(value, out.items, `${path}/items`, depth)
            : graft(value, out.items, `${path}/items`, depth + 1);
        }
      }),
      Match.when("items", () => {
        // With `prefixItems` present the trailing `items` schema became
        // Draft-07 `additionalItems`; otherwise `items` stayed `items`.
        if (R.has(source, "prefixItems")) {
          if (R.has(out, "additionalItems")) {
            out.additionalItems = graft(value, out.additionalItems, `${path}/additionalItems`, depth + 1);
          }
        } else if (R.has(out, "items")) {
          out.items = graft(value, out.items, keyPath, depth + 1);
        }
      }),
      Match.orElse(() => {
        // Copied-through leaves (`type`, `enum`, `pattern`, ...) carry
        // no subschemas, and everything else the lowering drops.
      })
    );
  }
  return out;
};

/**
 * Re-grafts the declared non-standard keyword families
 * ({@link KeywordFamilies}) from a Draft 2020-12 schema node onto its
 * lowered Draft-07 counterpart.
 *
 * Why this exists: annotation keys admitted into the Draft 2020-12 document
 * (core's `includeAnnotationKey`) are **dropped by core's Draft-07 lowering**,
 * whose keyword walk copies a fixed subset — verified against the installed
 * beta. Carrying `x-taplo`, `x-tombi-*`, `x-intellij-*` or the vscode set
 * into an emitted SchemaStore document therefore requires this post-lowering
 * step; it cannot ride `ToJsonSchemaOptions` alone.
 *
 * The walk mirrors the lowering's own structural rules, so every carrier
 * lands on the node the annotation was attached to — including the one
 * coordinate move the lowering makes (2020-12 `prefixItems[i]` → Draft-07
 * `items[i]`, trailing `items` → `additionalItems`). Only declared-family
 * keys are copied; nothing else about the target changes.
 *
 * `StoreDocument.fromSchema` applies this automatically to the root schema
 * and every `$defs` pool entry — annotate a schema node
 * (`Schema.String.annotate({ "x-taplo": { hidden: true } })`) and the key
 * appears in the built document. Call this directly only when driving core's
 * pipeline yourself.
 *
 * Know the boundary (core behavior, probed at the installed beta): an
 * annotation must sit on the schema **definition** node. Annotating a
 * hoisted (identifier-carrying) schema at its *usage* site — e.g.
 * `Person.annotate({...})` inside a struct field — reaches neither the
 * `$ref` node nor the pool entry, even in the 2020-12 document, so there is
 * nothing to carry.
 *
 * **Details**
 *
 * {@link AnnotationCarriers.carryResult} is the synchronous primitive;
 * {@link AnnotationCarriers.carry} wraps the same walk in an Effect span.
 *
 * **Gotchas**
 *
 * The walk maps 2020-12 `prefixItems` onto Draft-07 `items` and a trailing
 * `items` schema onto `additionalItems`. Positions the lowering drops are
 * never visited, so a carrier on those nodes is not copied. Nesting past
 * 256 levels — including cycles — fails with
 * {@link CarrierDepthExceededError}. Only {@link KeywordFamilies.isDeclared}
 * keys are copied; nothing else about the target changes.
 *
 * **Example** (Graft x-taplo from a 2020-12 node onto Draft-07)
 *
 * ```ts
 * import { AnnotationCarriers } from "@beep/scratchpad/schemastore"
 * import { Result } from "effect"
 *
 * const source = { type: "string", "x-taplo": { hidden: true } }
 * const target = { type: "string" }
 * const carried = AnnotationCarriers.carryResult(source, target)
 *
 * console.log(Result.isSuccess(carried))
 * // => true
 * if (Result.isSuccess(carried) && typeof carried.success === "object" && carried.success !== null) {
 *   console.log(Object.hasOwn(carried.success, "x-taplo"))
 *   // => true
 * }
 * ```
 *
 * @see {@link KeywordFamilies.isDeclared} for the admission predicate that decides which keys are copied.
 * @see {@link StoreDocument.fromSchema} for the pipeline that applies this walk automatically.
 * @see {@link CarrierDepthExceededError} for the typed failure when nesting exceeds 256 levels.
 * @public
 * @category combinators
 * @since 0.0.0
 */
export class AnnotationCarriers {
  private constructor() {}

  /**
   * Grafts declared-family keys from `source` (a Draft 2020-12 schema
   * node) onto `target` (its lowered Draft-07 counterpart), returning a
   * new node. Pure and synchronous — the primitive form;
   * {@link AnnotationCarriers.carry} is the same walk behind a span.
   *
   * **Example** (Copy x-taplo onto a lowered node)
   *
   * ```ts
   * import { AnnotationCarriers } from "@beep/scratchpad/schemastore"
   * import { Result } from "effect"
   *
   * const carried = AnnotationCarriers.carryResult(
   *   { type: "string", "x-taplo": { hidden: true } },
   *   { type: "string" },
   * )
   *
   * console.log(Result.isSuccess(carried))
   * // => true
   * if (Result.isSuccess(carried) && typeof carried.success === "object" && carried.success !== null) {
   *   console.log(Object.hasOwn(carried.success, "x-taplo"))
   *   // => true
   * }
   * ```
   *
   * @since 0.0.0
   */
  static carryResult(source: unknown, target: unknown): Result.Result<unknown, CarrierDepthExceededError> {
    try {
      return Result.succeed(graft(source, target, "", 0));
    } catch (cause) {
      if (cause instanceof CarryFailure) {
        return Result.fail(cause.error);
      }
      throw cause;
    }
  }

  /**
   * Effect form of {@link AnnotationCarriers.carryResult}, adding only the
   * `AnnotationCarriers.carry` span. Defined in terms of the `Result`
   * primitive — synchronous callers can use that variant directly.
   */
  static readonly carry = Effect.fn("AnnotationCarriers.carry")(
    (source: unknown, target: unknown): Effect.Effect<unknown, CarrierDepthExceededError> =>
      Effect.fromResult(AnnotationCarriers.carryResult(source, target))
  );
}
