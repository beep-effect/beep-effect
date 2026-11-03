import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Num from "effect/Number";
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
    programInstances: S.Natural,
    programMaxUtf16: S.Int.check(S.isBetween({ minimum: 0, maximum: 4096 })),
    programCaptureMatches: S.Natural,
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
        const runSubject = Effect.fn("Qualification.runRegexSubject")(function* (subject: number) {
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
                    subject === 0 ? "--baseline" : `--program-shard=${subject - 1}`,
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
          expect(completed.reply.programInstances).toBe(
            subject === 0 ? 0 : Math.floor((subject * 13610) / 16) - Math.floor(((subject - 1) * 13610) / 16)
          );
          return completed.reply;
        });
        const replies = yield* Effect.forEach(A.range(0, 16), runSubject, { concurrency: 2 });
        expect(yield* native.snapshot).toEqual({ spawned: 17, confirmed: 17 });
        const sum = (pick: (reply: typeof Reply.Type) => number) =>
          A.reduce(replies, 0, (total, reply) => total + pick(reply));
        expect(A.reduce(replies, 0, (maximum, reply) => Num.max(maximum, reply.programMaxUtf16))).toBeGreaterThan(0);
        const totals = {
          instances: sum((reply) => reply.instances),
          maxUtf16: A.reduce(replies, 0, (maximum, reply) => Num.max(maximum, reply.maxUtf16)),
          codePointChecks: sum((reply) => reply.codePointChecks),
          alphabetPointChecks: sum((reply) => reply.alphabetPointChecks),
          alphabetCaptureMatches: sum((reply) => reply.alphabetCaptureMatches),
          programInstances: sum((reply) => reply.programInstances),
          programCaptureMatches: sum((reply) => reply.programCaptureMatches),
          cases: sum((reply) => reply.cases),
          captureMatches: sum((reply) => reply.captureMatches),
        };
        expect(totals).toEqual({
          instances: 13610,
          maxUtf16: 3183,
          codePointChecks: 4456448,
          alphabetPointChecks: 4456448,
          alphabetCaptureMatches: 2,
          programInstances: 13610,
          programCaptureMatches: 26,
          cases: 28,
          captureMatches: 23,
        });
      }).pipe(Effect.timeout(Duration.minutes(14))),
    { timeout: 900_000 }
  );
});
