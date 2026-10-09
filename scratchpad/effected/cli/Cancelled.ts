import { $ScratchpadId } from "@beep/identity/packages";
import * as Runtime from "effect/Runtime";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/cli/Cancelled");

/**
 * A person backed out of an interactive prompt: they pressed escape, or the
 * prompt was interrupted.
 *
 * **Details**
 *
 * Exits `130`, the conventional status for a run ended by the user, through
 * core's own `Runtime.errorExitCode` marker, so `CliRuntime.reportFailures`
 * keeps it. Its default rendering is one line, `cancelled; nothing written`,
 * because nothing has been written by the time a prompt is cancelled and a
 * stack trace would only alarm. A consumer `render` still overrides the line, and can hand off to it: the line is
 * the error's `message`, so `error.message` and `String(error)` carry it.
 *
 * **Example** (Inspect a cancelled prompt)
 *
 * ```ts
 * import { Cancelled } from "@beep/scratchpad/effected/cli/Cancelled";
 *
 * console.log(Cancelled.make({ reason: "escape" }).message); // cancelled; nothing written
 * ```
 *
 * @public
 * @category errors
 * @since 0.0.0
 */
export class Cancelled extends S.TaggedError<Cancelled>($I`Cancelled`)("Cancelled", {
	reason: S.Literals(["escape", "interrupt"]).annotateKey({ description: "Whether the person pressed escape or the interactive prompt was interrupted" }),
}, $I.annote("Cancelled", { description: "A person backed out of an interactive prompt: they pressed escape, or the prompt was interrupted." })) {
	/**
 * The one line, `cancelled; nothing written`.
 *
 * **Details**
 *
 * A prototype getter, not a field, so it is not part of the encoded form, equality or a JSON dump. Assigning to
 * it is ignored: a library that rewrites `error.message` (to prefix a context, say) must not make this error throw,
 * which a getter-only property does in strict mode. The line is fixed.
 *
 * **Example** (Read the fixed cancellation message)
 *
 * ```ts
 * import { Cancelled } from "@beep/scratchpad/effected/cli/Cancelled";
 *
 * console.log(Cancelled.make({ reason: "interrupt" }).message); // cancelled; nothing written
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
	override get message(): string {
		return "cancelled; nothing written";
	}

	override set message(_value: string) {
		// Ignored by design: see the getter.
	}

	/**
 * The process exit code: `130`.
 *
 * **Details**
 *
 * A prototype getter rather than an own field, so a JSON or logger dump of the error does not carry the
 * runtime marker.
 *
 * **Example** (Read the cancellation exit code)
 *
 * ```ts
 * import { Cancelled } from "@beep/scratchpad/effected/cli/Cancelled";
 * import * as Runtime from "effect/Runtime";
 *
 * console.log(Cancelled.make({ reason: "escape" })[Runtime.errorExitCode]); // 130
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
	override get [Runtime.errorExitCode](): number {
		return 130;
	}
}
