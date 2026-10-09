/**
 * Transport-neutral crash guards for a server process: `ProcessGuard.run`
 * listens for stray exceptions and rejections before the server's module
 * graph loads. This entrypoint imports only effect/* packages.
 *
 * @packageDocumentation
 */
export {
	ProcessGuard,
	type ProcessGuardControl,
	type ProcessGuardHost,
	ProcessGuardInjection,
	type ProcessGuardOptions,
	ProcessGuardPolicy,
} from "./ProcessGuard.ts";
