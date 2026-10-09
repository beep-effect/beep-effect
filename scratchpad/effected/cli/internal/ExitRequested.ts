import { Runtime } from "effect";

/**
 * The failure `CliRuntime.main` raises when a successful program recorded a
 * non-zero exit code through `CliExit`. Private: nothing outside this package
 * constructs or matches it, and `reportFailures` never renders it.
 *
 * @internal
 */
export class ExitRequested extends Error {
	readonly [Runtime.errorReported] = false;
	readonly [Runtime.errorExitCode]: number;

	constructor(code: number) {
		super(`exit ${code}`);
		this.name = "ExitRequested";
		this[Runtime.errorExitCode] = code;
	}
}
