/**
 * Declared schemas for the values an option record carries that no data schema describes: a number that may be
 * non-finite, a path-display callback and the links service.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import type { CliLinksShape } from "../CliLinks.ts";

const $I = $CliKitId.create("internal/declared");

/**
 * Any JavaScript number, the non-finite ones included: a width of `Infinity` means unbounded, and the renderers
 * normalize `NaN` themselves.
 *
 * **Example** (Accept an unbounded width)
 *
 * ```ts
 * import { AnyNumber } from "@beep/cli-kit/internal/declared"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(AnyNumber)(Number.POSITIVE_INFINITY)) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const AnyNumber = S.declare<number>(P.isNumber).pipe(
  $I.annoteSchema("AnyNumber", { description: "Any JavaScript number, the non-finite ones included." })
);

/**
 * A callback that turns an absolute path into its display form, for example relative to the workspace.
 *
 * **Example** (Accept a path display callback)
 *
 * ```ts
 * import { DisplayPath } from "@beep/cli-kit/internal/declared"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(DisplayPath)((absolute: string) => absolute)) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const DisplayPath = S.declare<(absolute: string) => string>((value): value is (absolute: string) => string =>
  P.isFunction(value)
).pipe($I.annoteSchema("DisplayPath", { description: "A callback turning an absolute path into its display form." }));

/**
 * **Example** (Reject a record without a target function)
 *
 * ```ts
 * import { LinksService } from "@beep/cli-kit/internal/declared"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(LinksService)({ mode: "off" })) // false
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const LinksService = S.declare<CliLinksShape>(
  (value): value is CliLinksShape =>
    P.hasProperty(value, "mode") && P.hasProperty(value, "target") && P.isFunction(value.target)
).pipe($I.annoteSchema("LinksService", { description: "The links service value: a mode and a target function." }));
