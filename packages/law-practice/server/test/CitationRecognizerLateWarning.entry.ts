/** Diagnostic after the supplied protocol has delivered its reply and EOF.
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
  // Runtime teardown is the terminal I/O boundary; wait for this diagnostic's
  // write before invoking the supplied default process-exit policy.
  teardown: (exit, onExit) => {
    process.stderr.write("PRIVATE-LATE-WORKER-SENTINEL", () => Runtime.defaultTeardown(exit, onExit));
  },
});
