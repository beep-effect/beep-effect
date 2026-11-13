/**
 * Typed status fields inside node text: the lifecycles admission knows and
 * the token rule that reads and moves a status value in a node's text.
 *
 * **Details**
 *
 * Decision `status-values-are-manifest-data`: a status field's values and
 * their order come from the manifest at runtime as a {@link StatusLifecycle}.
 * {@link StatusFields} is the set of lifecycles one admission layer applies.
 *
 * A node is a typed status field for a field when its text holds exactly one
 * value of that field's lifecycle as a whole token, such as `active` in the
 * table row `| P2 | active |` or the frontmatter line `status: active`. A
 * token is bounded by the text's ends or by characters that are not letters,
 * digits, `_` or `-`, so `progress` is not read inside `in-progress`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Regex from "effect/RegExp";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { StatusLifecycle, StatusTransition, StatusValue } from "./StatusLifecycle.models.ts";

const $I = $AgentMemoryStoreId.create("StatusField.models");

/**
 * The status lifecycles one admission layer applies, one per field.
 *
 * **Details**
 *
 * A `setStatus` operation names its field in its transition; admission looks
 * the field up here. An empty set makes every `setStatus` a rejected
 * `statusOutsideLifecycle` write. Two lifecycles may not name the same field.
 *
 * **Example** (Declare the goal status field)
 *
 * ```ts
 * import { StatusFields, StatusLifecycle, StatusValue } from "@beep/agent-memory-store"
 *
 * const fields = StatusFields.make({
 *   lifecycles: [
 *     StatusLifecycle.make({
 *       field: "status",
 *       order: [StatusValue.make("pending"), StatusValue.make("active"), StatusValue.make("complete")],
 *     }),
 *   ],
 * })
 * console.log(fields.lifecycles.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatusFields extends S.Opaque<StatusFields, { readonly brand: unique symbol }>()(
  S.Struct({
    lifecycles: S.Array(StatusLifecycle)
      .check(
        S.makeFilter(
          (lifecycles: ReadonlyArray<StatusLifecycle>) =>
            A.dedupe(A.map(lifecycles, (lifecycle) => lifecycle.field)).length === lifecycles.length,
          $I.annote("StatusFieldsUniqueFieldCheck", {
            title: "Status Fields Unique Field",
            description: "Each status field has one lifecycle.",
            message: "Expected every lifecycle to name a different status field.",
          })
        )
      )
      .annotateKey({ description: "One lifecycle per typed status field." }),
  }).pipe(
    $I.annoteSchema("StatusFields", {
      description: "The status lifecycles one admission layer applies, one per field.",
    })
  )
) {}

/**
 * Finds the lifecycle of one status field.
 *
 * **Example** (Look up a field's lifecycle)
 *
 * ```ts
 * import { lifecycleOf, StatusFields } from "@beep/agent-memory-store"
 *
 * const fields = StatusFields.make({ lifecycles: [] })
 * console.log(lifecycleOf(fields, "status")) // Option.none()
 * ```
 *
 * @param fields - The status fields admission applies.
 * @param field - The status field name.
 * @returns The field's lifecycle, or none when the field has none.
 * @category utilities
 * @since 0.0.0
 */
export const lifecycleOf: {
  (field: string): (fields: StatusFields) => O.Option<StatusLifecycle>;
  (fields: StatusFields, field: string): O.Option<StatusLifecycle>;
} = dual(
  2,
  (fields: StatusFields, field: string): O.Option<StatusLifecycle> =>
    A.findFirst(fields.lifecycles, (lifecycle) => lifecycle.field === field)
);

const tokenOf = (value: StatusValue): RegExp =>
  new RegExp(`(?<![\\p{L}\\p{N}_-])${Regex.escape(value)}(?![\\p{L}\\p{N}_-])`, "gu");

// The offsets of every whole-token occurrence of `value` in the text.
const offsetsOf = (text: string, value: StatusValue): ReadonlyArray<number> =>
  A.getSomes(A.map(A.fromIterable(Str.matchAll(tokenOf(value))(text)), (match) => O.fromUndefinedOr(match.index)));

// Every whole-token occurrence of a lifecycle value in the text, with its offset.
const occurrences = (lifecycle: StatusLifecycle, text: string): ReadonlyArray<readonly [StatusValue, number]> =>
  A.flatMap(lifecycle.order, (value) => A.map(offsetsOf(text, value), (offset) => [value, offset] as const));

// The one whole-token occurrence of a lifecycle value in the text.
const soleOccurrence = (lifecycle: StatusLifecycle, text: string): O.Option<readonly [StatusValue, number]> => {
  const found = occurrences(lifecycle, text);
  return found.length === 1 ? A.head(found) : O.none();
};

// A whole token: a nonempty run of letters, digits, `_` and `-`.
const wholeToken = /^[\p{L}\p{N}_-]+$/u;

/**
 * Reads the value a node's text holds for a status field.
 *
 * **Details**
 *
 * The text holds a value when exactly one whole token of the text is a value
 * of the lifecycle; no token, or more than one, reads as none, and admission
 * then refuses to move the field.
 *
 * **Example** (Read the status cell of a table row)
 *
 * ```ts
 * import { StatusLifecycle, StatusValue, statusValueIn } from "@beep/agent-memory-store"
 *
 * const lifecycle = StatusLifecycle.make({
 *   field: "status",
 *   order: [StatusValue.make("pending"), StatusValue.make("active")],
 * })
 * console.log(statusValueIn(lifecycle, "| P2 | active |")) // Option.some("active")
 * ```
 *
 * @param lifecycle - The lifecycle of the status field.
 * @param text - The node text.
 * @returns The one lifecycle value the text holds, or none.
 * @category utilities
 * @since 0.0.0
 */
export const statusValueIn: {
  (text: string): (lifecycle: StatusLifecycle) => O.Option<StatusValue>;
  (lifecycle: StatusLifecycle, text: string): O.Option<StatusValue>;
} = dual(
  2,
  (lifecycle: StatusLifecycle, text: string): O.Option<StatusValue> =>
    O.map(soleOccurrence(lifecycle, text), ([value]) => value)
);

/**
 * Reads an edit of a node's text as a move of one status field.
 *
 * **Details**
 *
 * The edit is a status move when `before` holds exactly one whole-token value
 * of the lifecycle (as {@link statusValueIn} reads it) and `after` is `before`
 * with exactly that token replaced by another whole token: every other byte
 * is unchanged. The new token need not be a lifecycle value, so a move outside
 * the lifecycle still reads as a move and admission refuses it with
 * `statusOutsideLifecycle` instead of taking it as free text. Any other edit
 * reads as none (decision `op-capture-types-a-status-token-swap`).
 *
 * **Example** (Read a status cell edit as a move)
 *
 * ```ts
 * import { StatusLifecycle, StatusValue, statusMoveBetween } from "@beep/agent-memory-store"
 *
 * const lifecycle = StatusLifecycle.make({
 *   field: "status",
 *   order: [StatusValue.make("pending"), StatusValue.make("complete")],
 * })
 * console.log(statusMoveBetween(lifecycle, "| P2 | pending |", "| P2 | complete |")) // Option.some(transition)
 * ```
 *
 * @param lifecycle - The lifecycle of the status field.
 * @param before - The node text the edit started from.
 * @param after - The edited node text.
 * @returns The move from the value `before` holds to the token `after` puts in its place, or none.
 * @category utilities
 * @since 0.0.0
 */
export const statusMoveBetween: {
  (before: string, after: string): (lifecycle: StatusLifecycle) => O.Option<StatusTransition>;
  (lifecycle: StatusLifecycle, before: string, after: string): O.Option<StatusTransition>;
} = dual(
  3,
  (lifecycle: StatusLifecycle, before: string, after: string): O.Option<StatusTransition> =>
    O.flatMap(soleOccurrence(lifecycle, before), ([from, offset]) => {
      const prefix = Str.slice(0, offset)(before);
      const suffix = Str.slice(offset + from.length)(before);
      const token = Str.slice(prefix.length, after.length - suffix.length)(after);
      const spliced =
        prefix.length + suffix.length < after.length &&
        Str.startsWith(prefix)(after) &&
        Str.endsWith(suffix)(after) &&
        token !== from &&
        wholeToken.test(token);
      return spliced
        ? O.some(StatusTransition.make({ field: lifecycle.field, from: O.some(from), to: StatusValue.make(token) }))
        : O.none();
    })
);

/**
 * Replaces the status value a node's text holds with another value, leaving
 * every other byte of the text as it was.
 *
 * **Details**
 *
 * `from` is the value {@link statusValueIn} read from the same text, so the
 * text holds it as exactly one whole token and exactly that token changes; a
 * text that holds no whole `from` token is returned unchanged. The new value
 * is spliced in by offset, so no character of it is read as a pattern.
 *
 * **Example** (Complete a status cell)
 *
 * ```ts
 * import { replaceStatusValue, StatusValue } from "@beep/agent-memory-store"
 *
 * const text = replaceStatusValue("| P2 | active |", StatusValue.make("active"), StatusValue.make("complete"))
 * console.log(text) // "| P2 | complete |"
 * ```
 *
 * @param text - The node text.
 * @param from - The value the text holds as one whole token.
 * @param to - The value to write in its place.
 * @returns The text with the first `from` token replaced by `to`.
 * @category utilities
 * @since 0.0.0
 */
export const replaceStatusValue: {
  (from: StatusValue, to: StatusValue): (text: string) => string;
  (text: string, from: StatusValue, to: StatusValue): string;
} = dual(3, (text: string, from: StatusValue, to: StatusValue): string =>
  O.match(A.head(offsetsOf(text, from)), {
    onNone: () => text,
    onSome: (offset) => `${Str.slice(0, offset)(text)}${to}${Str.slice(offset + from.length)(text)}`,
  })
);
