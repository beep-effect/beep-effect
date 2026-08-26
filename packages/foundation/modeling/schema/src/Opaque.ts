/**
 * Opaque payload schemas whose equivalence is declared, not inferred.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Opaque");

const alwaysEquivalent = (): ((self: unknown, that: unknown) => boolean) => () => true;

/**
 * Effect's `Defect` schema annotated so that two defects are always equivalent.
 *
 * **Details**
 *
 * A defect is an opaque thrown value: an `Error` whose stack, message, and runtime metadata
 * vary with the construction site. Comparing two defects structurally is never meaningful, and
 * under `Equal.equals` it is not even stable. Declaring the equivalence here makes the rule part
 * of the schema: an error class whose `cause` uses this schema keeps the cause as payload while
 * `S.toEquivalence(ErrorClass)` compares the declared diagnostic fields only. Decoding and
 * encoding are exactly Effect's `Defect(options)`.
 *
 * **Example** (Keep the cause as payload, never identity)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity"
 * import { Defect } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("Example")
 *
 * class FetchError extends S.TaggedError<FetchError>($I`FetchError`)(
 *   "FetchError",
 *   { url: S.String, cause: S.optionalKey(Defect()) },
 *   $I.annoteError<FetchError>("FetchError", { description: "A fetch failed." })
 * ) {}
 *
 * const same = S.toEquivalence(FetchError)
 * const a = FetchError.make({ url: "https://example.com", cause: new Error("first") })
 * const b = FetchError.make({ url: "https://example.com", cause: new Error("second") })
 * console.log(same(a, b)) // true
 * ```
 *
 * @param options - Effect `ErrorOptions` forwarded to `S.Defect` (for example `includeStack`).
 * @returns The defect schema with an always-true equivalence annotation.
 * @category schemas
 * @since 0.0.0
 */
export const Defect = (options?: Parameters<typeof S.Defect>[0]): S.Defect =>
  S.Defect(options).pipe(
    $I.annoteSchema("Defect", {
      description: "Opaque defect payload; never part of declared identity.",
      toEquivalence: alwaysEquivalent,
    })
  );

/**
 * `S.Unknown` annotated so that two values are always equivalent: an opaque payload with no
 * structural identity.
 *
 * **Details**
 *
 * Use it for tagged-error fields that carry arbitrary caller data (an offending id, a raw
 * payload) which must travel with the error but must not take part in
 * `S.toEquivalence(ErrorClass)`. Decoding and encoding are exactly `S.Unknown`.
 *
 * **Example** (Carry an offending value without making it identity)
 *
 * ```ts
 * import { $SchemaId } from "@beep/identity"
 * import { OpaqueUnknown } from "@beep/schema"
 * import * as S from "effect/Schema"
 *
 * const $I = $SchemaId.create("Example")
 *
 * class InvariantError extends S.TaggedError<InvariantError>($I`InvariantError`)(
 *   "InvariantError",
 *   { entityType: S.String, actualId: OpaqueUnknown },
 *   $I.annoteError<InvariantError>("InvariantError")
 * ) {}
 *
 * const same = S.toEquivalence(InvariantError)
 * console.log(same(InvariantError.make({ entityType: "user", actualId: 1 }), InvariantError.make({ entityType: "user", actualId: 2 }))) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OpaqueUnknown = S.Unknown.pipe(
  $I.annoteSchema("OpaqueUnknown", {
    description: "Opaque payload; never part of declared identity.",
    toEquivalence: alwaysEquivalent,
  })
);

/**
 * Runtime type of {@link OpaqueUnknown}: the payload stays `unknown`.
 *
 * **Example** (Carry an opaque payload through a helper)
 *
 * ```ts
 * import type { OpaqueUnknown } from "@beep/schema"
 *
 * const carry = (payload: OpaqueUnknown): OpaqueUnknown => payload
 * console.log(carry.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type OpaqueUnknown = typeof OpaqueUnknown.Type;
