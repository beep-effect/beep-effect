/** Real recognizer followed by non-cooperative work; qualification only.
 * @internal @packageDocumentation @since 0.0.0
 */
import { recognizeEyecite } from "@beep/eyecite/recognize";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";

const main = Layer.build(BunFileSystem.layer).pipe(
  Effect.flatMap((context) =>
    Effect.gen(function* () {
      yield* recognizeEyecite({ source: "35 U.S.C. 101", sourceUtf16: 100, candidates: 10 });
      const fs = yield* FileSystem.FileSystem;
      yield* fs.writeFileString("started", "ready");
      return yield* Effect.sync(() => {
        for (;;) {
          /* only this owned child is blocked */
        }
      });
    }).pipe(Effect.provideContext(context))
  ),
  Effect.scoped
);
BunRuntime.runMain(main);
