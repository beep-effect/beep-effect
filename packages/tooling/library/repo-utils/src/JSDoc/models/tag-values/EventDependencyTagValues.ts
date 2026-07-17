/**
 * Event and dependency tag occurrence shapes.
 *
 * @packageDocumentation
 * @category models
 * @since 0.0.0
 */
import { $RepoUtilsId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { nameField, optionalDesc, optionalName } from "./_fields.ts";

const $I = $RepoUtilsId.create("JSDoc/models/tag-values/EventDependencyTagValues");

/**
 * Schema-backed value for a parsed `fires` tag occurrence: documents an event a symbol emits.
 *
 * @example
 * ```ts
 * import { FiresValue } from "@beep/repo-utils/JSDoc/models/tag-values/EventDependencyTagValues"
 *
 * const tag = FiresValue.make({
 *   name: "repo:changed",
 *   description: "Parsed tag text."
 * })
 * const tagName: "fires" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class FiresValue extends S.TaggedClass<FiresValue>($I`FiresValue`)(
  "fires",
  { ...optionalName, ...optionalDesc },
  $I.annote("FiresValue", {
    description: "Occurrence shape for @fires — documents an event a symbol emits.",
  })
) {}

/**
 * Schema-backed value for a parsed `listens` tag occurrence: documents an event a symbol listens for.
 *
 * @example
 * ```ts
 * import { ListensValue } from "@beep/repo-utils/JSDoc/models/tag-values/EventDependencyTagValues"
 *
 * const tag = ListensValue.make({
 *   name: "repo:changed",
 *   description: "Parsed tag text."
 * })
 * const tagName: "listens" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ListensValue extends S.TaggedClass<ListensValue>($I`ListensValue`)(
  "listens",
  { ...optionalName, ...optionalDesc },
  $I.annote("ListensValue", {
    description: "Occurrence shape for @listens — documents an event a symbol listens for.",
  })
) {}

/**
 * Schema-backed value for a parsed `event` tag occurrence: documents an event.
 *
 * @example
 * ```ts
 * import { EventValue } from "@beep/repo-utils/JSDoc/models/tag-values/EventDependencyTagValues"
 *
 * const tag = EventValue.make({
 *   name: "repo:changed",
 *   description: "Parsed tag text."
 * })
 * const tagName: "event" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class EventValue extends S.TaggedClass<EventValue>($I`EventValue`)(
  "event",
  { ...optionalName, ...optionalDesc },
  $I.annote("EventValue", {
    description: "Occurrence shape for @event — documents an event.",
  })
) {}

/**
 * Schema-backed value for a parsed `requires` tag occurrence: documents a dependency.
 *
 * @example
 * ```ts
 * import { RequiresValue } from "@beep/repo-utils/JSDoc/models/tag-values/EventDependencyTagValues"
 *
 * const tag = RequiresValue.make({ name: "effect" })
 * const tagName: "requires" = tag._tag
 * console.log(tagName)
 * ```
 * @category models
 * @since 0.0.0
 */
export class RequiresValue extends S.TaggedClass<RequiresValue>($I`RequiresValue`)(
  "requires",
  { ...nameField },
  $I.annote("RequiresValue", {
    description: "Occurrence shape for @requires — documents a dependency.",
  })
) {}
