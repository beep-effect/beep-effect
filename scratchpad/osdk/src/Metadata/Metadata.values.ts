/**
 * Descriptive metadata an ontology definition carries next to its structure:
 * lifecycle, prominence, icon and client hints.
 *
 * **Details**
 *
 * Nothing here changes what data means. These values tell an application how
 * mature a definition is ({@link ReleaseStatus}), how eagerly to show it
 * ({@link Visibility}), how to draw it ({@link Icon}) and which free-form hints
 * a client may honour ({@link TypeClass}).
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit, MappedLiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";

const $I = $ScratchpadId.create("osdk/Metadata/Metadata.values");

// -----------------------------------------------------------------------------
// Lifecycle and prominence
// -----------------------------------------------------------------------------

/**
 * How far along its lifecycle a definition is, decoded from the wire's upper-case enum.
 *
 * **Details**
 *
 * The platform uses this one domain for object types, link types and action
 * types, and documents it only as "the release status of the entity". By
 * convention `endorsed` marks an active definition its owners recommend,
 * `experimental` one that may still change and `deprecated` one that should no
 * longer be adopted. Properties carry a richer status of their own and do not
 * use this domain.
 *
 * **Example** (Decode a release status)
 *
 * ```ts import.meta.vitest name="Decode a release status"
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ReleaseStatus } from "@beep/scratchpad/osdk/src/Metadata/index"
 *
 * const status = await Effect.runPromise(S.decodeEffect(ReleaseStatus)("EXPERIMENTAL"))
 * status // => "experimental"
 * ```
 *
 * **Example** (Decide whether new code may depend on a definition)
 *
 * ```ts import.meta.vitest name="Decide whether new code may depend on a definition"
 * import * as A from "effect/Array"
 * import { ReleaseStatus } from "@beep/scratchpad/osdk/src/Metadata/index"
 *
 * const isSafeToAdopt = ReleaseStatus.To.match({
 *   active: () => true,
 *   endorsed: () => true,
 *   experimental: () => false,
 *   deprecated: () => false,
 * })
 * const verdicts = A.map(ReleaseStatus.Pairs, ([, status]) => isSafeToAdopt(status))
 * verdicts // => [true, true, false, false]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ReleaseStatus = MappedLiteralKit([
  ["ACTIVE", "active"],
  ["ENDORSED", "endorsed"],
  ["EXPERIMENTAL", "experimental"],
  ["DEPRECATED", "deprecated"],
]).pipe(
  $I.annoteSchema("ReleaseStatus", {
    description: "How far along its lifecycle a definition is: active, endorsed, experimental or deprecated.",
  })
);

/**
 * Runtime type of {@link ReleaseStatus}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReleaseStatus = typeof ReleaseStatus.Type;

/**
 * How prominently applications should surface an object type or a property.
 *
 * **Details**
 *
 * This is a suggestion to user interfaces, never an access control: a `hidden`
 * definition is still readable by anyone allowed to read it. The wire declares
 * the same three literals twice (once for object types, once for properties);
 * here they are one domain.
 *
 * **Example** (Order definitions by prominence)
 *
 * ```ts import.meta.vitest name="Order definitions by prominence"
 * import * as A from "effect/Array"
 * import { Visibility } from "@beep/scratchpad/osdk/src/Metadata/index"
 *
 * const rank = Visibility.To.match({ prominent: () => 0, normal: () => 1, hidden: () => 2 })
 * const ranks = A.map(Visibility.Pairs, ([, visibility]) => rank(visibility))
 * ranks // => [1, 0, 2]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Visibility = MappedLiteralKit([
  ["NORMAL", "normal"],
  ["PROMINENT", "prominent"],
  ["HIDDEN", "hidden"],
]).pipe(
  $I.annoteSchema("Visibility", {
    description: "How prominently applications should surface an object type or a property.",
  })
);

/**
 * Runtime type of {@link Visibility}.
 *
 * @category models
 * @since 0.0.0
 */
export type Visibility = typeof Visibility.Type;

// -----------------------------------------------------------------------------
// Icon
// -----------------------------------------------------------------------------

const IconKind = LiteralKit(["blueprint"]);

/**
 * Icon taken from the Blueprint icon set, drawn in one colour.
 *
 * @category models
 * @since 0.0.0
 */
export class BlueprintIcon extends S.Opaque<BlueprintIcon, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("blueprint"),
    color: S.String.annotateKey({ description: "Colour the icon is drawn in, a hex code such as `#2D72D2`." }),
    name: S.NonEmptyString.annotateKey({ description: "Name of the icon in the Blueprint icon set, such as `cube`." }),
  }).pipe(
    $I.annoteSchema("BlueprintIcon", {
      description: "Icon taken from the Blueprint icon set, drawn in one colour.",
    })
  )
) {}

/**
 * Icon an application draws next to an object type.
 *
 * **Details**
 *
 * The platform declares this as a union so more icon sources can be added
 * later; today `blueprint` is its only case. Matching on it stays exhaustive
 * when a case is added.
 *
 * **Example** (Read an icon)
 *
 * ```ts import.meta.vitest name="Read an icon"
 * import { Icon } from "@beep/scratchpad/osdk/src/Metadata/index"
 *
 * const icon = Icon.cases.blueprint.make({ color: "#2D72D2", name: "cube" })
 * const label = Icon.match(icon, { blueprint: ({ color, name }) => `${name} in ${color}` })
 * label // => "cube in #2D72D2"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const Icon = IconKind.mapMembers(() => Tuple.make(BlueprintIcon)).pipe(
  S.toTaggedUnion("type"),
  $I.annoteSchema("Icon", { description: "Icon an application draws next to an object type." })
);

/**
 * Runtime type of {@link Icon}.
 *
 * @category models
 * @since 0.0.0
 */
export type Icon = typeof Icon.Type;

// -----------------------------------------------------------------------------
// Client hints
// -----------------------------------------------------------------------------

/**
 * Free-form hint attached to a property, parameter or action for the applications that render it.
 *
 * **Details**
 *
 * The platform does not interpret type classes; each application agrees on the
 * `kind` namespaces it understands. A common one is the render hint, for
 * example `{ kind: "render_hint", name: "SORTABLE" }`.
 *
 * **Example** (Describe a render hint)
 *
 * ```ts import.meta.vitest name="Describe a render hint"
 * import { TypeClass } from "@beep/scratchpad/osdk/src/Metadata/index"
 *
 * const sortable = TypeClass.make({ kind: "render_hint", name: "SORTABLE" })
 * const label = `${sortable.kind}:${sortable.name}`
 * label // => "render_hint:SORTABLE"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TypeClass extends S.Opaque<TypeClass, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.String.annotateKey({ description: "Namespace of the hint, agreed between the applications that read it." }),
    name: S.String.annotateKey({ description: "The hint itself, meaningful within its kind." }),
  }).pipe(
    $I.annoteSchema("TypeClass", {
      description: "Free-form hint attached to a definition for the applications that render it.",
    })
  )
) {}
