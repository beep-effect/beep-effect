import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/engine/Remediation");

/**
 * What a caller — usually an agent — should do after a failure.
 *
 * **Details**
 *
 * `hint` is the human-readable instruction. `suggestedTool` and `suggestedArgs`
 * optionally name the tool to call next and the arguments to call it with, so
 * an agent can act without parsing the hint. The optional keys are
 * `optionalKey`: omit them rather than passing an explicit `undefined`, which
 * is rejected instead of silently encoded.
 *
 * **Example** (Suggest a validation tool and its arguments)
 *
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
	hint: S.String.annotateKey({ description: "The human-readable instruction for what the caller should do after a failure" }),
	suggestedTool: S.optionalKey(S.String).annotateKey({ description: "The tool an agent should call next to address the failure, when one is suggested" }),
	suggestedArgs: S.optionalKey(S.Record(S.String, S.Unknown)).annotateKey({ description: "The arguments an agent should pass to the suggested tool, when provided" }),
}).pipe($I.annoteSchema("Remediation", { description: "What a caller — usually an agent — should do after a failure." }));

/**
 * A decoded {@link (Remediation:variable)}.
 *
 * @public
 */
export type Remediation = typeof Remediation.Type;
