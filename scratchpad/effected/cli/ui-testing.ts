/**
 * Test utilities for the interactive screens of `@effected/cli/ui`: mount a screen on in-memory streams, drive it
 * with keys and read its frames.
 *
 * @remarks
 * A separate entrypoint so a program's runtime import graph never loads test code.
 *
 * @packageDocumentation
 */
export {
	CliUiTest,
	type CliUiTestHandle,
	type CliUiTestLive,
	type CliUiTestNextOptions,
	type CliUiTestOptions,
	type CliUiTestScreen,
	type CliUiTestSession,
	type CliUiTestSessionOptions,
	type CliUiTestView,
} from "./ui/testing/CliUiTest.ts";
