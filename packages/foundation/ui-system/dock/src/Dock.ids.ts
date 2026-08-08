/**
 * Schema-first domain algebra for the Dockview greenfield POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { Number as N } from "effect";
import * as S from "effect/Schema";

const $I = $DockId.create("Dock.ids");

/**
 * Branded stable identity for one panel instance.
 *
 * **Example** (Make and check PanelId)
 *
 * ```ts
 * import { PanelId } from "@beep/dock"
 *
 * const id = PanelId.make("panel-one")
 * console.log(PanelId.is(id)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const PanelId = S.NonEmptyString.pipe(
  S.brand("DockPanelId"),
  $I.annoteSchema("PanelId", {
    description: "Stable identity for one panel instance in a dock workspace.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
/**
 * Decoded panel identifier.
 *
 * **Example** (Typed PanelId assignment)
 *
 * ```ts
 * import { PanelId } from "@beep/dock"
 *
 * const id: PanelId = PanelId.make("panel-one")
 * console.log(id) // "panel-one"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type PanelId = typeof PanelId.Type;

/**
 * Branded stable identity for a non-empty tab group.
 *
 * **Example** (Make and check GroupId)
 *
 * ```ts
 * import { GroupId } from "@beep/dock"
 *
 * const id = GroupId.make("group-one")
 * console.log(GroupId.is(id)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const GroupId = S.NonEmptyString.pipe(
  S.brand("DockGroupId"),
  $I.annoteSchema("GroupId", {
    description: "Stable identity for one non-empty tab group.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
/**
 * Decoded tab-group identifier.
 *
 * **Example** (Typed GroupId assignment)
 *
 * ```ts
 * import { GroupId } from "@beep/dock"
 *
 * const id: GroupId = GroupId.make("group-one")
 * console.log(id) // "group-one"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type GroupId = typeof GroupId.Type;

/**
 * Branded stable identity for a binary layout split.
 *
 * **Example** (Make and check SplitId)
 *
 * ```ts
 * import { SplitId } from "@beep/dock"
 *
 * const id = SplitId.make("split-one")
 * console.log(SplitId.is(id)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SplitId = S.NonEmptyString.pipe(
  S.brand("DockSplitId"),
  $I.annoteSchema("SplitId", {
    description: "Stable identity for one binary layout split.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
/**
 * Decoded binary-split identifier.
 *
 * **Example** (Typed SplitId assignment)
 *
 * ```ts
 * import { SplitId } from "@beep/dock"
 *
 * const id: SplitId = SplitId.make("split-one")
 * console.log(id) // "split-one"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SplitId = typeof SplitId.Type;

/**
 * Branded causal identity for a top-level command and its events.
 *
 * **Example** (Make and check CommandId)
 *
 * ```ts
 * import { CommandId } from "@beep/dock"
 *
 * const id = CommandId.make("command-open-one")
 * console.log(CommandId.is(id)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CommandId = S.NonEmptyString.pipe(
  S.brand("DockCommandId"),
  $I.annoteSchema("CommandId", {
    description: "Causal identity shared by a command and its emitted events.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
/**
 * Decoded command identifier.
 *
 * **Example** (Typed CommandId assignment)
 *
 * ```ts
 * import { CommandId } from "@beep/dock"
 *
 * const id: CommandId = CommandId.make("command-open-one")
 * console.log(id) // "command-open-one"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type CommandId = typeof CommandId.Type;

/**
 * Branded host-registry key for a framework-specific panel renderer.
 *
 * **Example** (Make and check RendererKey)
 *
 * ```ts
 * import { RendererKey } from "@beep/dock"
 *
 * const key = RendererKey.make("markdown-preview")
 * console.log(RendererKey.is(key)) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const RendererKey = S.NonEmptyString.pipe(
  S.brand("DockRendererKey"),
  $I.annoteSchema("RendererKey", {
    description: "Renderer-neutral key resolved by a host adapter outside dockview-core.",
  }),
  SchemaUtils.withStatics((schema) => ({
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
/**
 * Decoded renderer registry key.
 *
 * **Example** (Typed RendererKey assignment)
 *
 * ```ts
 * import { RendererKey } from "@beep/dock"
 *
 * const key: RendererKey = RendererKey.make("markdown-preview")
 * console.log(key) // "markdown-preview"
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type RendererKey = typeof RendererKey.Type;

/**
 * Integer basis-point share for one child of a binary split.
 *
 * **Example** (Complement split ratio shares)
 *
 * ```ts
 * import { SplitRatio } from "@beep/dock"
 *
 * const left = SplitRatio.make(6_000)
 * const right = SplitRatio.complement(left)
 * console.log(right) // 4000
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const SplitRatio = S.Int.check(
  S.isBetween({
    minimum: 1_000,
    maximum: 9_000,
  })
).pipe(
  S.brand("DockSplitRatio"),
  $I.annoteSchema("SplitRatio", {
    description: "Exact child share in basis points, bounded from ten through ninety percent.",
  }),
  SchemaUtils.withStatics((schema) => ({
    complement: (ratio: typeof schema.Type) => schema.make(N.subtract(10_000, ratio)),
    equals: SchemaUtils.toEquivalence(schema),
    is: S.is(schema),
  }))
);
/**
 * Decoded split share in integer basis points.
 *
 * **Example** (Typed SplitRatio assignment)
 *
 * ```ts
 * import { SplitRatio } from "@beep/dock"
 *
 * const ratio: SplitRatio = SplitRatio.make(5_000)
 * console.log(ratio) // 5000
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export type SplitRatio = typeof SplitRatio.Type;
