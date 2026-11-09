/**
 * Typed status fields with an ordered lifecycle and a guard against backward
 * moves.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $AgentMemoryStoreId.create("StatusLifecycle.models");

/**
 * One value of a typed status field, such as `active` or `completed`.
 *
 * **Example** (Brand a status value)
 *
 * ```ts
 * import { StatusValue } from "@beep/agent-memory-store"
 *
 * console.log(StatusValue.make("active"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StatusValue = S.NonEmptyString.pipe(
  S.brand("StatusValue"),
  $I.annoteSchema("StatusValue", {
    description: "One value of a typed status field.",
  })
);

/**
 * Runtime type for {@link StatusValue}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type StatusValue = typeof StatusValue.Type;

/**
 * Ordered lifecycle of one status field.
 *
 * **Details**
 *
 * `order` lists the field's values from earliest to latest and may not repeat
 * a value. Decision `status-generated-from-manifest`: admission permits only
 * forward or same-position moves along this order (S14b: backward moves
 * regress 12/14 without the guard).
 *
 * **Example** (Declare a goal status lifecycle)
 *
 * ```ts
 * import { StatusLifecycle, StatusValue } from "@beep/agent-memory-store"
 *
 * const lifecycle = StatusLifecycle.make({
 *   field: "status",
 *   order: [StatusValue.make("draft"), StatusValue.make("active"), StatusValue.make("completed")],
 * })
 * console.log(lifecycle.order.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatusLifecycle extends S.Opaque<StatusLifecycle, { readonly brand: unique symbol }>()(
  S.Struct({
    field: S.NonEmptyString.annotateKey({ description: "Name of the typed status field." }),
    order: S.NonEmptyArray(StatusValue)
      .check(
        S.isUnique(
          $I.annote("StatusLifecycleUniqueOrderCheck", {
            title: "Status Lifecycle Unique Order",
            description: "A lifecycle lists each status value at most once.",
            message: "Expected every status value in the lifecycle order to be distinct.",
          })
        )
      )
      .annotateKey({ description: "Status values from earliest to latest, without duplicates." }),
  }).pipe(
    $I.annoteSchema("StatusLifecycle", {
      description: "Ordered lifecycle of one typed status field.",
    })
  )
) {}

/**
 * A requested change of one status field.
 *
 * **Details**
 *
 * `from` is absent when the field has no value yet.
 *
 * **Example** (Request a forward move)
 *
 * ```ts
 * import { StatusTransition, StatusValue } from "@beep/agent-memory-store"
 * import * as O from "effect/Option"
 *
 * const transition = StatusTransition.make({
 *   field: "status",
 *   from: O.some(StatusValue.make("active")),
 *   to: StatusValue.make("completed"),
 * })
 * console.log(transition.to)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatusTransition extends S.Opaque<StatusTransition, { readonly brand: unique symbol }>()(
  S.Struct({
    field: S.NonEmptyString.annotateKey({ description: "Name of the typed status field." }),
    from: S.OptionFromOptionalKey(StatusValue).annotateKey({
      description: "Current value of the field, absent when the field is unset.",
    }),
    to: StatusValue.annotateKey({ description: "Requested value of the field." }),
  }).pipe(
    $I.annoteSchema("StatusTransition", {
      description: "A requested change of one typed status field.",
    })
  )
) {}

/**
 * Checks whether a lifecycle permits a status transition.
 *
 * **Details**
 *
 * The transition must name the lifecycle's field and its `to` value must be in
 * the lifecycle. A transition from an unset field is allowed; otherwise `from`
 * must be in the lifecycle and `to` must sit at the same position or later.
 *
 * **Example** (Reject a backward move)
 *
 * ```ts
 * import { lifecycleAllows, StatusLifecycle, StatusTransition, StatusValue } from "@beep/agent-memory-store"
 * import * as O from "effect/Option"
 *
 * const lifecycle = StatusLifecycle.make({
 *   field: "status",
 *   order: [StatusValue.make("draft"), StatusValue.make("active")],
 * })
 * const backward = StatusTransition.make({
 *   field: "status",
 *   from: O.some(StatusValue.make("active")),
 *   to: StatusValue.make("draft"),
 * })
 * console.log(lifecycleAllows(lifecycle, backward)) // false
 * ```
 *
 * @param lifecycle - The lifecycle of the status field.
 * @param transition - The requested transition.
 * @returns `true` when the move is forward or stays in place.
 * @category predicates
 * @since 0.0.0
 */
export const lifecycleAllows: {
  (transition: StatusTransition): (lifecycle: StatusLifecycle) => boolean;
  (lifecycle: StatusLifecycle, transition: StatusTransition): boolean;
} = dual(2, (lifecycle: StatusLifecycle, transition: StatusTransition): boolean => {
  const positionOf = (value: StatusValue): O.Option<number> => A.findFirstIndex(lifecycle.order, Equal.equals(value));
  return (
    Equal.equals(lifecycle.field, transition.field) &&
    pipe(
      positionOf(transition.to),
      O.exists((to) =>
        O.match(transition.from, {
          onNone: () => true,
          onSome: flow(
            positionOf,
            O.exists((from) => to >= from)
          ),
        })
      )
    )
  );
});
