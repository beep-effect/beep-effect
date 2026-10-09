/**
 * Transport-neutral crash guards for a server process: `ProcessGuard.run`
 * listens for stray exceptions and rejections before the server's module
 * graph loads. This entrypoint has no runtime import at all.
 *
 * @packageDocumentation
 */
export {
	ProcessGuard,
	type ProcessGuardControl,
	type ProcessGuardHost,
	type ProcessGuardInjection,
	type ProcessGuardOptions,
	type ProcessGuardPolicy,
} from "./ProcessGuard.ts";
