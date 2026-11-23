/**
 * The colour level of one output stream, and the one pure decision that computes it from an environment record.
 *
 * **Details**
 *
 * `fromEnv` is the synchronous entrypoint for callers without a layer (a colour library deciding at import time):
 * `FORCE_COLOR` decides alone when present, then `NO_COLOR`, `NODE_DISABLE_COLORS` and `TERM=dumb` disable, then a
 * stream that is not a TTY has none, then Node's `getColorDepth` table decides.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RuntimeEnvId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import { colorDepth } from "./internal/colorDepth.ts";
import type { Env } from "./internal/types.ts";

const $I = $RuntimeEnvId.create("ColorLevel");

/**
 * **Example** (Validate truecolor support)
 *
 * ```ts
 * import { ColorLevel } from "@beep/runtime-env/ColorLevel";
 * import * as S from "effect/Schema";
 * console.log(S.is(ColorLevel)("truecolor")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ColorLevel = LiteralKit(["none", "basic", "256", "truecolor"]).pipe(
  $I.annoteSchema("ColorLevel", {
    description: "The colour support of one output stream: none, 16 colours, 256 colours or truecolor.",
  })
);

/**
 * @category type-level
 * @since 0.0.0
 */
export type ColorLevel = typeof ColorLevel.Type;

/**
 * The colour level of a stream, decided from an environment record and whether the stream is a TTY.
 *
 * **Details**
 *
 * A pure function of its arguments: no `Config`, no `process`, no service. `FORCE_COLOR` present decides alone and
 * exactly (`""`, `1` or `true` give `basic`, `2` gives `256`, `3` gives `truecolor`, anything else gives `none`), so it
 * beats `NO_COLOR` and the TTY check. Otherwise a non-empty `NO_COLOR` or `NODE_DISABLE_COLORS`, or `TERM=dumb`, gives
 * `none`; a stream that is not a TTY gives `none` (CI alone never enables colour); then Node's terminal table decides,
 * reading `OS=Windows_NT` in place of the platform check. Pass the record as the host holds it: an `undefined` value
 * is unset, and an empty `FORCE_COLOR` counts as present.
 *
 * **Example** (Decide colour for a piped and a terminal stream)
 *
 * ```ts
 * import * as ColorLevel from "@beep/runtime-env/ColorLevel";
 * import { pipe } from "effect/Function";
 *
 * console.log(ColorLevel.fromEnv({ COLORTERM: "truecolor" }, false)) // none
 * console.log(pipe({ COLORTERM: "truecolor" }, ColorLevel.fromEnv(true))) // truecolor
 * ```
 *
 * @param env - variable name to value, in the plain shape a host holds
 * @param isTTY - whether the stream the level is for is attached to a terminal
 * @category utilities
 * @since 0.0.0
 */
export const fromEnv: {
  (isTTY: boolean): (env: typeof Env.Encoded) => ColorLevel;
  (env: typeof Env.Encoded, isTTY: boolean): ColorLevel;
} = dual(2, (env: typeof Env.Encoded, isTTY: boolean): ColorLevel => colorDepth(env, isTTY));
