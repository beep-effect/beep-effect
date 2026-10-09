/**
 * Test utilities for CLIs built on `effect/cli`: spawn a built bin in a
 * hermetic sandbox and read its exit code and streams as data.
 *
 * **Details**
 *
 * A separate entrypoint so a CLI's runtime import graph never loads test code;
 * see the reachability test beside it.
 *
 * @packageDocumentation
 */
export { CliTest, type RunOptions, type RunResult, type Sandbox } from "./CliTest.ts";
export { type KeyInput, TestTerminal, type TestTerminalHandle } from "./TestTerminal.ts";
