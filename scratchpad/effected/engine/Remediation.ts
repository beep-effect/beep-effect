import * as S from "effect/Schema";

/**
 * What a caller — usually an agent — should do after a failure.
 *
 * @remarks
 * `hint` is the human-readable instruction. `suggestedTool` and `suggestedArgs`
 * optionally name the tool to call next and the arguments to call it with, so
 * an agent can act without parsing the hint. The optional keys are
 * `optionalKey`: omit them rather than passing an explicit `undefined`, which
 * is rejected instead of silently encoded.
 *
 * @example
 * ```ts
 * import { Remediation } from "./index.ts"
 *
 * const remediation: Remediation = {
 * 	hint: "Run the validator on the whole bundle first.",
 * 	suggestedTool: "validate_bundle",
 * 	suggestedArgs: { strict: true },
 * }
 * ```
 *
 * @public
 */
export const Remediation = S.Struct({
	hint: S.String,
	suggestedTool: S.optionalKey(S.String),
	suggestedArgs: S.optionalKey(S.Record(S.String, S.Unknown)),
});

/**
 * A decoded {@link (Remediation:variable)}.
 *
 * @public
 */
export type Remediation = typeof Remediation.Type;
