/**
 * `CliUiTest.serializer` as a module's default export, for Vitest's `snapshotSerializers` config.
 *
 * **Details**
 *
 * Vitest's `test.snapshotSerializers` takes module paths whose default export is a serializer, so registering this
 * one needs no `expect.addSnapshotSerializer` call and no shim file of your own.
 * A separate entrypoint so a program's runtime import graph never loads test code.
 *
 * **Example** (Register the snapshot serializer in Vitest)
 *
 * ```ts
 * // vitest.config.ts
 * import { defineConfig } from "vitest/config"
 *
 * const config = defineConfig({
 *   test: { snapshotSerializers: ["@beep/scratchpad/effected/cli/ui-testing-serializer"] },
 * })
 * console.log(config.test?.snapshotSerializers?.join(",")) // @beep/scratchpad/effected/cli/ui-testing-serializer
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CliUiTest } from "./ui/testing/CliUiTest.ts";

/**
 * `CliUiTest.serializer`: it claims a string carrying escapes or token markup and prints it as token markup with each
 * line's trailing spaces trimmed. See `CliUiTest.serializer` for what it claims.
 *
 * **Example** (Normalize token markup for a snapshot)
 *
 * ```ts
 * import serializer from "@beep/scratchpad/effected/cli/ui-testing-serializer"
 * console.log(serializer.serialize("Ready  ")) // Ready
 * ```
 *
 * @public
 * @category serialization
 * @since 0.0.0
 */
const serializer: {
	readonly test: (value: unknown) => boolean;
	readonly serialize: (value: unknown) => string;
} = CliUiTest.serializer;

export default serializer;
