// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/env.ts. Pure: no process reads.
import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";

const $I = $ScratchpadId.create("effected/env/internal/osc8/env");

/**
 * Selects truthy semantics for env-var detection.
 *
 * **Details**
 *
 * - "default": Unset, empty, "0", "false", "off", "no" → false. Anything else → true.
 * Used for FORCE_HYPERLINK / NO_HYPERLINK.
 * - "no-color": Per no-color.org spec, each non-empty value → true (even "0").
 *
 * **Example** (Validate the NO_COLOR truthiness policy)
 *
 * ```ts
 * import { TruthySpec } from "@beep/scratchpad/effected/env/internal/osc8/env";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(TruthySpec)("no-color")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TruthySpec = LiteralKit(["default", "no-color"]).annotate($I.annote("TruthySpec", { description: "Truthy semantics for env-var detection: default flags or any non-empty NO_COLOR value." }));
/**
 * Truthiness policy accepted by the {@link TruthySpec} schema.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TruthySpec = typeof TruthySpec.Type;

const DEFAULT_FALSY = HashSet.make("0", "false", "off", "no");

/**
 * Evaluate whether an env-var value should be considered truthy.
 *
 * **Details**
 *
 * Direct calls pass both the value and specification; pass `undefined` for default semantics.
 * Calls with zero or one argument return a function accepting the env-var value.
 *
 * **Example** (Evaluate direct and pipeable flags)
 *
 * ```ts
 * import { pipe } from "effect/Function";
 * import { envIsTruthy } from "@beep/scratchpad/effected/env/internal/osc8/env";
 *
 * console.log(envIsTruthy("false", "default")) // false
 * console.log(pipe("0", envIsTruthy("no-color"))) // true
 * console.log(pipe("false", envIsTruthy())) // false
 * ```
 *
 * @param value - The env-var value (commonly `process.env.SOMETHING`).
 * @param spec - Which semantics to apply. Default: "default".
 * @category predicates
 * @since 0.0.0
 */
export const envIsTruthy: {
	(): (value: string | undefined) => boolean;
	(spec: TruthySpec | undefined): (value: string | undefined) => boolean;
	(value: string | undefined, spec: TruthySpec | undefined): boolean;
} = dual(2, (value: string | undefined, spec: TruthySpec = "default"): boolean => {
	if (value === undefined || value === "") return false;
	if (spec === "no-color") return true;
	return !HashSet.has(DEFAULT_FALSY, value.toLowerCase());
});
