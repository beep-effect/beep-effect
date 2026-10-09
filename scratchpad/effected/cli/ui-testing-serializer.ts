/**
 * `CliUiTest.serializer` as a module's default export, for Vitest's `snapshotSerializers` config.
 *
 * @remarks
 * Vitest's `test.snapshotSerializers` takes module paths whose default export is a serializer, so registering this
 * one needs no `expect.addSnapshotSerializer` call and no shim file of your own:
 *
 * ```ts
 * // vitest.config.ts
 * import { defineConfig } from "vitest/config"
 *
 * export default defineConfig({
 *   test: { snapshotSerializers: ["@effected/cli/ui/testing/serializer"] },
 * })
 * ```
 *
 * A separate entrypoint so a program's runtime import graph never loads test code.
 *
 * @packageDocumentation
 */
import { CliUiTest } from "./ui/testing/CliUiTest.ts";

/**
 * `CliUiTest.serializer`: it claims a string carrying escapes or token markup and prints it as token markup with each
 * line's trailing spaces trimmed. See `CliUiTest.serializer` for what it claims.
 *
 * @public
 */
const serializer: {
	readonly test: (value: unknown) => boolean;
	readonly serialize: (value: unknown) => string;
} = CliUiTest.serializer;

export default serializer;
