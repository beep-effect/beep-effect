/** Valid parser reply followed by abnormal exit; qualification only.
 * @internal @packageDocumentation @since 0.0.0
 */

import { citationRecognizerWorkerProgram } from "@beep/law-practice-server/internal/Citation/RecognizerWorkerProgram";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunStdio from "@effect/platform-bun/BunStdio";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Runtime from "effect/Runtime";

const main = Layer.build(BunStdio.layer).pipe(
  Effect.flatMap((context) => citationRecognizerWorkerProgram.pipe(Effect.provideContext(context))),
  Effect.scoped
);
BunRuntime.runMain(main, {
  teardown: (exit, onExit) => Runtime.defaultTeardown(exit, (code) => onExit(code === 0 || code === 130 ? 7 : code)),
});
