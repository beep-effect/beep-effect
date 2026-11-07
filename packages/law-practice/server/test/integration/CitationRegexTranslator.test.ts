import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Num from "effect/Number";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  citationBunTestExecutable,
  makeCitationNodeTestRuntime,
  makeCitationObservedSpawner,
} from "../CitationNativeSpawner.fixtures.ts";

const $I = $LawPracticeServerId.create("test/integration/CitationRegexTranslator");
const Reply = S.fromJsonString(
  S.Struct({
    runtime: CitationNativeRuntimeKind,
    runtimeVersion: S.NonEmptyString.check(S.isMaxLength(64)),
    instances: S.Natural,
    maxUtf16: S.Natural,
    codePointChecks: S.Natural,
    alphabetPointChecks: S.Natural,
    alphabetCaptureMatches: S.Natural,
    programInstances: S.Natural,
    programMaxUtf16: S.Int.check(S.isBetween({ minimum: 0, maximum: 4096 })),
    programCaptureMatches: S.Natural,
    witnessInstances: S.Natural,
    witnessMatches: S.Natural,
    witnessEmptyInstances: S.Natural,
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
  for (const [kind, smoke] of A.cartesian(CitationNativeRuntimeKind.literals, [false, true])) {
    it.effect(
      smoke
        ? `smoke checks three source witnesses under ${kind}`
        : `compiles every extractor and checks every scalar against source classes plus controlled captures under ${kind}`,
      () =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const subjectUrl = new URL(
            "../../../../../goals/citation-extraction-engine/ops/qualify-regex-translator.child.mjs",
            import.meta.url
          );
          const root = new URL("../../../../../", import.meta.url);
          const versionFile = new URL(kind === "bun" ? ".bun-version" : ".nvmrc", root);
          const citationResult1 = yield* fs.readFileString(NodeURL.fileURLToPath(versionFile));
          const expectedVersion = Str.trim(citationResult1);
          const runtime =
            kind === "node"
              ? yield* fs
                  .makeTempDirectoryScoped({ prefix: "citation-node-corpus-" })
                  .pipe(Effect.flatMap((cwd) => makeCitationNodeTestRuntime(NodeURL.fileURLToPath(subjectUrl), cwd)))
              : { executable: yield* citationBunTestExecutable, workerFile: NodeURL.fileURLToPath(subjectUrl) };
          const native = yield* makeCitationObservedSpawner();
          const runSubject = Effect.fn("Qualification.runRegexSubject")(function* (subject: number) {
            const completed = yield* Effect.scoped(
              Effect.gen(function* () {
                const child = yield* native.spawner.spawn(
                  ChildProcess.make(
                    runtime.executable,
                    [
                      ...(kind === "bun" ? ["--no-env-file", "--no-install"] : []),
                      runtime.workerFile,
                      smoke ? "--witness-smoke" : subject === 0 ? "--baseline" : `--program-shard=${subject - 1}`,
                      subjectUrl.href,
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
                      if (bytes > 2048) {
                        return yield* Effect.die("qualification reply exceeded its fixed bound");
                      }
                      return new TextDecoder("utf-8", { fatal: true }).decode(chunk);
                    })
                  ),
                  Stream.runFold(
                    () => "",
                    (text, chunk) => text + chunk
                  )
                );
                const citationResult2 = yield* child.exitCode;
                expect(citationResult2, text).toBe(0);
                return { child, reply: yield* S.decodeEffect(Reply)(text) };
              })
            ).pipe(Effect.timeout(Duration.seconds(90)));
            const citationResult3 = yield* completed.child.isRunning;
            expect(citationResult3).toBe(false);
            expect(completed.reply.runtime).toBe(kind);
            expect(completed.reply.runtimeVersion).toBe(expectedVersion);
            expect(completed.reply.programInstances).toBe(
              smoke
                ? 3
                : subject === 0
                  ? 0
                  : Math.floor((subject * 13610) / 16) - Math.floor(((subject - 1) * 13610) / 16)
            );
            return completed.reply;
          });
          const replies = yield* Effect.forEach(smoke ? [0] : A.range(0, 16), runSubject, { concurrency: 2 });
          const citationResult4 = yield* native.snapshot;
          expect(citationResult4).toEqual({ spawned: smoke ? 1 : 17, confirmed: smoke ? 1 : 17 });
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
            witnessInstances: sum((reply) => reply.witnessInstances),
            witnessMatches: sum((reply) => reply.witnessMatches),
            witnessEmptyInstances: sum((reply) => reply.witnessEmptyInstances),
            cases: sum((reply) => reply.cases),
            captureMatches: sum((reply) => reply.captureMatches),
          };
          if (smoke) {
            expect(totals).toMatchObject({
              programInstances: 3,
              witnessInstances: 3,
              witnessMatches: 6,
              witnessEmptyInstances: 3,
            });
            return;
          }
          expect(totals).toEqual({
            instances: 13610,
            maxUtf16: 3183,
            codePointChecks: 4456448,
            alphabetPointChecks: 4456448,
            alphabetCaptureMatches: 2,
            programInstances: 13610,
            programCaptureMatches: 26,
            witnessInstances: 13610,
            witnessMatches: 27216,
            witnessEmptyInstances: 13610,
            cases: 28,
            captureMatches: 23,
          });
        }).pipe(Effect.timeout(Duration.minutes(14))),
      { timeout: smoke ? 30_000 : 900_000 }
    );
  }
});
