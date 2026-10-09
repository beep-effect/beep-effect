// Ported from std-osc8 v0.2.0 (MIT, C. Spencer Beggs), src/env.ts. Pure: no process reads.
/**
 * Truthy semantics for env-var detection.
 *
 * - "default": Unset, empty, "0", "false", "off", "no" → false. Anything else → true.
 *   Used for FORCE_HYPERLINK / NO_HYPERLINK.
 * - "no-color": Per no-color.org spec, any non-empty value → true (even "0").
 */
export type TruthySpec = "default" | "no-color";

const DEFAULT_FALSY = new Set(["0", "false", "off", "no"]);

/**
 * Evaluate whether an env-var value should be considered truthy.
 *
 * @param value - The env-var value (commonly `process.env.SOMETHING`).
 * @param spec - Which semantics to apply. Default: "default".
 */
export const envIsTruthy = (value: string | undefined, spec: TruthySpec = "default"): boolean => {
	if (value === undefined || value === "") return false;
	if (spec === "no-color") return true;
	return !DEFAULT_FALSY.has(value.toLowerCase());
};
