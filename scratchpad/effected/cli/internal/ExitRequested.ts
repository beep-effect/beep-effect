import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Runtime from "effect/Runtime";

const $I = $ScratchpadId.create("effected/cli/internal/ExitRequested");

/**
 * The failure `CliRuntime.main` raises when a successful program recorded a
 * non-zero exit code through `CliExit`. Private: nothing outside this package
 * constructs or matches it, and `reportFailures` never renders it.
 *
 * **Example** (Represent a requested process exit)
 *
 * ```ts
 * import { ExitRequested } from "@beep/scratchpad/effected/cli/internal/ExitRequested"
 *
 * const exit = ExitRequested.make({ code: 2 })
 * console.log(exit.message) // exit 2
 * ```
 *
 * @internal
 * @category errors
 * @since 0.0.0
 */
export class ExitRequested extends S.TaggedError<ExitRequested>($I`ExitRequested`)(
	"ExitRequested",
	{
		code: S.Finite.annotate({ description: "The non-zero exit code recorded by a successful CLI program." }),
	},
	$I.annote("ExitRequested", { description: "A successful CLI program requested a non-zero process exit without a failure report." }),
) {
	override readonly name = "ExitRequested";
	override readonly [Runtime.errorReported] = false;

	/**
	 * Describes the requested process exit without a failure report.
	 *
	 * **Example** (Read the exit message)
	 *
	 * ```ts
	 * import { ExitRequested } from "@beep/scratchpad/effected/cli/internal/ExitRequested"
	 *
	 * console.log(ExitRequested.make({ code: 3 }).message) // exit 3
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get message(): string {
		return `exit ${this.code}`;
	}

	/**
	 * Exposes the recorded exit code to the Effect runtime.
	 *
	 * **Example** (Read the runtime exit code)
	 *
	 * ```ts
	 * import { ExitRequested } from "@beep/scratchpad/effected/cli/internal/ExitRequested"
	 *
	 * import * as Runtime from "effect/Runtime"
	 *
	 * console.log(ExitRequested.make({ code: 3 })[Runtime.errorExitCode]) // 3
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	override get [Runtime.errorExitCode](): number {
		return this.code;
	}
}
