import * as Data from "effect/Data";
import * as Runtime from "effect/Runtime";

/**
 * The failure `CliRuntime.main` raises when a successful program recorded a
 * non-zero exit code through `CliExit`. Private: nothing outside this package
 * constructs or matches it, and `reportFailures` never renders it.
 *
 * @internal
 */
export class ExitRequested extends Data.TaggedError("ExitRequested")<{ readonly message: string }> {
	override readonly [Runtime.errorReported] = false;
	override readonly [Runtime.errorExitCode]: number;

	constructor(code: number) {
		super({ message: `exit ${code}` });
		this.name = "ExitRequested";
		this[Runtime.errorExitCode] = code;
	}
}
