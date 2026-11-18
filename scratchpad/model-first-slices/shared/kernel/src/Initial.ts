import * as A from "@beep/utils/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

/**
 * What every field with an initial value says about itself: what it holds
 * and what it starts as.
 *
 * **Details**
 *
 * The helpers below put this on the key before the default. A key annotation
 * added after a decoding default is left out of generated JSON Schema, so it
 * would never reach an OpenAPI document or a tool schema.
 *
 * @category models
 * @since 0.0.0
 */
export type Described = { readonly description: string };

/** A field of `Value` that has no constructor default yet. */
type Field<Value> = S.Top & S.WithoutConstructorDefault & { readonly Type: Value; readonly "~type.make.in": Value };

/**
 * A struct field that starts at `initial`: `make` may leave it out, and a
 * decoded value whose key is missing reads `initial`. The value is always
 * written when encoded.
 *
 * **Gotchas**
 *
 * Give a field an initial value only when one value is canonical for it. A
 * field whose empty value is the widest one (a grant's `expires`, its
 * `operations`, a delegation reference, an allowance) takes none: it stays
 * required, so leaving it out is refused.
 *
 * **Example** (A counter that starts at zero)
 * ```ts
 * import * as Initial from "@proto/kernel/Initial";
 * import * as S from "effect/Schema";
 *
 * const Tally = S.Struct({
 *   name: S.String,
 *   count: S.Int.pipe(Initial.of(0, { description: "Steps counted; none at first." })),
 * });
 * const fresh = Tally.make({ name: "steps" });
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const of: {
  <Value>(
    initial: Value,
    described: Described,
  ): <F extends Field<Value> & { readonly Rebuild: F }>(field: F) => S.withDecodingDefaultTypeKey<S.withConstructorDefault<F>>;
  <Value, F extends Field<Value> & { readonly Rebuild: F }>(
    field: F,
    initial: Value,
    described: Described,
  ): S.withDecodingDefaultTypeKey<S.withConstructorDefault<F>>;
} = dual(3, <Value, F extends Field<Value> & { readonly Rebuild: F }>(field: F, initial: Value, described: Described) => {
  // Annotating a schema gives back the schema itself, which the bound on `F` states.
  const annotated: F = field.pipe(S.annotateKey<F>(described));
  return annotated.pipe(
    S.withConstructorDefault<F>(Effect.succeed(initial)),
    S.withDecodingDefaultTypeKey<S.withConstructorDefault<F>>(Effect.succeed(initial)),
  );
});

/**
 * An array field that starts empty: `make` may leave it out, and a decoded
 * value whose key is missing reads `[]`.
 *
 * **Example** (A view that starts with no grants)
 * ```ts
 * import * as Initial from "@proto/kernel/Initial";
 * import * as S from "effect/Schema";
 *
 * const HolderGrantsState = S.Struct({
 *   grants: Initial.empty(S.String, { description: "The grants held; none at first." }),
 * });
 * const initial = HolderGrantsState.make({});
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty: {
  (described: Described): <Element extends S.Constraint>(element: Element) => S.withDecodingDefaultTypeKey<S.withConstructorDefault<S.$Array<Element>>>;
  <Element extends S.Constraint>(element: Element, described: Described): S.withDecodingDefaultTypeKey<S.withConstructorDefault<S.$Array<Element>>>;
} = dual(2, <Element extends S.Constraint>(element: Element, described: Described) =>
  S.Array(element).pipe(
    S.annotateKey(described),
    S.withConstructorDefault(Effect.succeed(A.empty<Element["~type.make"]>())),
    S.withDecodingDefaultTypeKey(Effect.succeed(A.empty<Element["Type"]>())),
  ),
);

/**
 * An optional field that starts absent: `make` may leave it out, and it is
 * `O.none()` exactly when its key is missing from the encoded value. `null`
 * is not accepted.
 *
 * **Details**
 *
 * `S.OptionFromOptionalKey` already reads a missing key as `O.none()`, so
 * this needs no decoding default.
 *
 * **Example** (A claim that starts with no proposal)
 * ```ts
 * import * as Initial from "@proto/kernel/Initial";
 * import * as S from "effect/Schema";
 *
 * const Review = S.Struct({
 *   claim: S.String,
 *   proposal: Initial.none(S.String, { description: "The proposal; absent until one is made." }),
 * });
 * const fresh = Review.make({ claim: "claim_1" });
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const none: {
  (described: Described): <Value extends S.Top & { readonly Rebuild: Value }>(value: Value) => S.withConstructorDefault<S.OptionFromOptionalKey<Value>>;
  <Value extends S.Top & { readonly Rebuild: Value }>(value: Value, described: Described): S.withConstructorDefault<S.OptionFromOptionalKey<Value>>;
} = dual(2, <Value extends S.Top & { readonly Rebuild: Value }>(value: Value, described: Described) => {
  const annotated: Value = value.pipe(S.annotateKey<Value>(described));
  return S.OptionFromOptionalKey(annotated).pipe(S.withConstructorDefault(Effect.succeedNone));
});
