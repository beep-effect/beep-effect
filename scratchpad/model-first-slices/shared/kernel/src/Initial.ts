import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

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
 * const Tally = S.Struct({ name: S.String, count: S.Int.pipe(Initial.of(0)) });
 * const fresh = Tally.make({ name: "steps" });
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const of =
  <Value>(initial: Value) =>
  <Field extends S.Top & S.WithoutConstructorDefault & { readonly Type: Value; readonly "~type.make.in": Value }>(field: Field) =>
    field.pipe(S.withConstructorDefault(Effect.succeed(initial)), S.withDecodingDefaultTypeKey(Effect.succeed(initial)));

/**
 * An array field that starts empty: `make` may leave it out, and a decoded
 * value whose key is missing reads `[]`.
 *
 * **Example** (A view that starts with no grants)
 * ```ts
 * import * as Initial from "@proto/kernel/Initial";
 * import * as S from "effect/Schema";
 *
 * const HolderGrantsState = S.Struct({ grants: Initial.empty(S.String) });
 * const initial = HolderGrantsState.make({});
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const empty = <Element extends S.Constraint>(element: Element) =>
  S.Array(element).pipe(
    S.withConstructorDefault(Effect.succeed(A.empty<Element["~type.make"]>())),
    S.withDecodingDefaultTypeKey(Effect.succeed(A.empty<Element["Type"]>())),
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
 * const Review = S.Struct({ claim: S.String, proposal: Initial.none(S.String) });
 * const fresh = Review.make({ claim: "claim_1" });
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const none = <Value extends S.Top>(value: Value) =>
  S.OptionFromOptionalKey(value).pipe(S.withConstructorDefault(Effect.succeedNone));
