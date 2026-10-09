import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import * as Runtime from "effect/Runtime";

const $I = $ScratchpadId.create("effected/cli/internal/ExitRequested");

/**
 * The failure `CliRuntime.main` raises when a successful program recorded a
 * non-zero exit code through `CliExit`. Private: nothing outside this package
 * constructs or matches it, and `reportFailures` never renders it.
 *
 * @internal
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

	override get message(): string {
		return `exit ${this.code}`;
	}

	override get [Runtime.errorExitCode](): number {
		return this.code;
	}
}
