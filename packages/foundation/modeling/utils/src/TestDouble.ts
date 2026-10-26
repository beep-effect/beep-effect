/**
 * The one way an unstubbed test-double member fails.
 *
 * **Details**
 *
 * A `makeTest` double's unstubbed member must fail rather than silently
 * succeed: a stub that returns nothing teaches a test that nothing happened.
 * The failure names the double, the member and the override that fixes it,
 * and the wording lives here once so every package's doubles report it the
 * same way. Both behaviours raise {@link UnstubbedMemberError}: {@link unstubbed}
 * builds members that die as effects, and {@link unstubbedFor} builds members
 * that throw synchronously when called, with {@link unstubbedShapeFor}
 * filling a whole double from a member record.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $UtilsId.create("TestDouble");

/**
 * A test-double member was called without an override.
 *
 * **Example** (Construct an unstubbed-member error)
 *
 * ```ts
 * import { UnstubbedMemberError } from "@beep/utils/TestDouble"
 *
 * const error = UnstubbedMemberError.make({ message: "Cache: save() needs an override." })
 * console.log(error.message) // Cache: save() needs an override.
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class UnstubbedMemberError extends S.TaggedError<UnstubbedMemberError, { readonly brand: unique symbol }>(
  $I`UnstubbedMemberError`
)(
  "UnstubbedMemberError",
  {
    message: S.String.pipe(
      $I.annoteKey("UnstubbedMemberError.message", {
        description: "The test-double member that needs an override.",
      })
    ),
  },
  $I.annoteError<UnstubbedMemberError>("UnstubbedMemberError", {
    description: "A test-double member was called without an override.",
  })
) {}

/**
 * The die-on-call members of `<double>.makeTest`: `dies("save")` is an
 * `Effect` that defects naming `save` when run. Each double binds its own name
 * once, then lists its members.
 *
 * **Example** (Construct a failing test-double member)
 *
 * ```ts
 * import { unstubbed } from "@beep/utils/TestDouble"
 * import * as Effect from "effect/Effect"
 *
 * const dies = unstubbed("Cache")
 * const save = dies("save")
 * console.log(Effect.isEffect(save)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const unstubbed =
  (double: string) =>
  (member: string): Effect.Effect<never> =>
    Effect.die(
      UnstubbedMemberError.make({
        message: `${double}: ${member}() was called but not stubbed — pass a \`${member}\` override.`,
      })
    );

/**
 * How a test double's unstubbed member was used: called as a function, or
 * read as a value.
 *
 * **Example** (Validate an access kind)
 *
 * ```ts
 * import { UnstubbedAccess } from "@beep/utils/TestDouble"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UnstubbedAccess)("read")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnstubbedAccess = S.Literals(["called", "read"]).pipe(
  $I.annoteSchema("UnstubbedAccess", {
    description: "How a test double's unstubbed member was used: called as a function, or read as a value.",
  })
);

/**
 * The values accepted by {@link UnstubbedAccess}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UnstubbedAccess = typeof UnstubbedAccess.Type;

/**
 * The test double a synchronous unstubbed thrower reports for.
 *
 * **Example** (Describe a double whose members are read)
 *
 * ```ts
 * import { UnstubbedTarget } from "@beep/utils/TestDouble"
 *
 * const target = UnstubbedTarget.make({ service: "Repository", access: "read" })
 * console.log(target.service) // "Repository"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class UnstubbedTarget extends S.Opaque<UnstubbedTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The service whose `makeTest` built the double. */
    service: S.String.pipe(
      $I.annoteKey("UnstubbedTarget.service", { description: "The service whose `makeTest` built the double." })
    ),
    /** What the caller should do instead; defaults to `pass an override`. */
    hint: S.optionalKey(S.String).pipe(
      $I.annoteKey("UnstubbedTarget.hint", {
        description: "What the caller should do instead; defaults to `pass an override`.",
      })
    ),
    /** How unstubbed members are used; defaults to `called`. */
    access: S.optionalKey(UnstubbedAccess).pipe(
      $I.annoteKey("UnstubbedTarget.access", { description: "How unstubbed members are used; defaults to `called`." })
    ),
  }).pipe(
    $I.annoteSchema("UnstubbedTarget", { description: "The test double a synchronous unstubbed thrower reports for." })
  )
) {}

/**
 * Companion types for {@link UnstubbedTarget}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace UnstubbedTarget {
  /**
   * The plain, unbranded target {@link unstubbedFor} accepts.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof UnstubbedTarget.Encoded;
}

/**
 * Build the synchronous thrower a service's `makeTest` uses for members
 * without an override.
 *
 * **Details**
 *
 * The thrower raises {@link UnstubbedMemberError} with the message
 * `<service>.makeTest: <member>() was called but not stubbed — <hint>.`
 * A double whose unstubbed members are read as values rather than called
 * sets `access: "read"`, and the message reads `<member> was read` instead.
 * Use {@link unstubbed} when the member is itself an `Effect` that should die
 * when run rather than throw when called.
 *
 * **Example** (Throw for an unstubbed member)
 *
 * ```ts
 * import { unstubbedFor } from "@beep/utils/TestDouble"
 *
 * const unstubbed = unstubbedFor({ service: "CheckRun" })
 * try {
 *   unstubbed("create")
 * } catch (error) {
 *   console.log(String(error).includes("CheckRun.makeTest: create()")) // true
 * }
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const unstubbedFor =
  ({ service, hint = "pass an override", access = "called" }: UnstubbedTarget.Encoded) =>
  (member: string): never => {
    const used = access === "read" ? `${member} was read` : `${member}() was called`;
    throw UnstubbedMemberError.make({
      message: `${service}.makeTest: ${used} but not stubbed — ${hint}.`,
    });
  };

/**
 * How an unstubbed member of a whole test-double shape fails: a function that
 * throws when called, or an effect that dies when run.
 *
 * **Example** (Validate a member kind)
 *
 * ```ts
 * import { UnstubbedMember } from "@beep/utils/TestDouble"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(UnstubbedMember)("effect")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UnstubbedMember = S.Literals(["call", "effect"]).pipe(
  $I.annoteSchema("UnstubbedMember", {
    description: "How an unstubbed member fails: a function that throws when called, or an effect that dies when run.",
  })
);

/**
 * The values accepted by {@link UnstubbedMember}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type UnstubbedMember = typeof UnstubbedMember.Type;

/**
 * Build a whole test-double shape whose every member fails through
 * {@link unstubbedFor}.
 *
 * **Details**
 *
 * `members` names every key of the shape (the mapped type makes the record
 * exhaustive) and how it fails: a `"call"` member becomes a function that
 * throws, an `"effect"` member an effect that dies when run. A service's
 * `makeTest` spreads its overrides over the result. The final assertion is the
 * one place the member record meets the service's own signatures; a thrower
 * returns `never`, which every member signature accepts.
 *
 * **Example** (Build an all-unstubbed double)
 *
 * ```ts
 * import { unstubbedShapeFor } from "@beep/utils/TestDouble"
 * import * as Effect from "effect/Effect"
 *
 * interface CacheShape {
 *   readonly save: (key: string) => Effect.Effect<void>
 *   readonly size: Effect.Effect<number>
 * }
 *
 * const cache = unstubbedShapeFor({ service: "Cache" })<CacheShape>({ save: "call", size: "effect" })
 * console.log(Effect.isEffect(cache.size)) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const unstubbedShapeFor = (target: UnstubbedTarget.Encoded) => {
  const thrower = unstubbedFor(target);
  const memberOf = (kind: UnstubbedMember, member: string) =>
    kind === "effect" ? Effect.suspend((): Effect.Effect<never> => thrower(member)) : () => thrower(member);
  return <Shape extends object>(members: { readonly [K in keyof Shape & string]-?: UnstubbedMember }): Shape =>
    R.map(members, memberOf) as unknown as Shape;
};
