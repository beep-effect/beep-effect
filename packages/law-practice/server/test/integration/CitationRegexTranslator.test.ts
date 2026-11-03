import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { makeCitationObservedSpawner } from "../CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/integration/CitationRegexTranslator");
const Reply = S.fromJsonString(
  S.Struct({
    instances: S.Natural,
    maxUtf16: S.Natural,
    codePointChecks: S.Natural,
    alphabetPointChecks: S.Natural,
    alphabetCaptureMatches: S.Natural,
    cases: S.Natural,
    captureMatches: S.Natural,
  })
).pipe(
  $I.annoteSchema("Reply", {
    description: "Bounded source-free totals from the fixed native translator qualification subject.",
  })
);
// Full native qualification runs in hosted integration, never the package unit task.
it.layer(BunServices.layer, { excludeTestServices: true })("native regex translation", (it) => {
  it.effect(
    "compiles every extractor and checks every scalar against source classes plus controlled captures",
    () =>
      Effect.gen(function* () {
        const native = yield* makeCitationObservedSpawner();
        const completed = yield* Effect.scoped(
          Effect.gen(function* () {
            const child = yield* native.spawner.spawn(
              ChildProcess.make(
                process.execPath,
                [
                  "--no-env-file",
                  "--no-install",
                  NodeURL.fileURLToPath(
                    new URL(
                      "../../../../../goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs",
                      import.meta.url
                    )
                  ),
                ],
                {
                  env: {},
                  extendEnv: false,
                  shell: false,
                  detached: false,
                  stdin: "ignore",
                  stdout: "pipe",
                  stderr: "ignore",
                  killSignal: "SIGKILL",
                  forceKillAfter: Duration.zero,
                }
              )
            );
            let bytes = 0;
            const text = yield* child.stdout.pipe(
              Stream.mapEffect((chunk) =>
                Effect.gen(function* () {
                  bytes += chunk.byteLength;
                  if (bytes > 2048) return yield* Effect.die("qualification reply exceeded its fixed bound");
                  return new TextDecoder("utf-8", { fatal: true }).decode(chunk);
                })
              ),
              Stream.runFold(
                () => "",
                (text, chunk) => text + chunk
              )
            );
            expect(yield* child.exitCode, text).toBe(0);
            return { child, reply: yield* S.decodeEffect(Reply)(text) };
          })
        ).pipe(Effect.timeout(Duration.seconds(90)));
        expect(yield* completed.child.isRunning).toBe(false);
        expect(yield* native.snapshot).toEqual({ spawned: 1, confirmed: 1 });
        expect(completed.reply).toEqual({
          instances: 13610,
          maxUtf16: 3183,
          codePointChecks: 4456448,
          alphabetPointChecks: 4456448,
          alphabetCaptureMatches: 2,
          cases: 28,
          captureMatches: 23,
        });
      }),
    { timeout: 120_000 }
  );
});
