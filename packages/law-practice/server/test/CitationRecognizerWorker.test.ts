import * as NodeURL from "node:url";
import { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
import {
  CitationRecognizerFailure,
  makeCitationRecognizerWorker,
} from "@beep/law-practice-server/internal/Citation/RecognizerWorker";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { it } from "@beep/test-runner";
import * as BunServices from "@effect/platform-bun/BunServices";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Tuple from "effect/Tuple";
import * as TestClock from "effect/testing/TestClock";
import { makeCitationBundledTestRuntime, makeCitationObservedSpawner } from "./CitationNativeSpawner.fixtures.ts";
import type { EyeciteRecognizeOutput } from "@beep/eyecite";
import type { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";

const Range = S.Struct({ start: S.Natural, end: S.Natural, quote: S.String });
const Profile = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        id: S.String,
        text: S.String,
        expected: S.Array(S.Struct({ form: S.String, anchor: Range, antecedent: S.NullOr(Range) })),
      })
    ),
  })
);
const forms = {
  case: "full-case",
  shortFormCase: "short-case",
  id: "id",
  supra: "supra",
  statute: "usc",
  regulation: "cfr",
};
const fixture = Effect.fnUntraced(function* (kind: CitationNativeRuntimeKind) {
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: `citation-recognizer-${kind}-` });
  const entry =
    kind === "bun"
      ? new URL("../src/internal/Citation/RecognizerWorker.entry.ts", import.meta.url)
      : new URL("../src/internal/Citation/RecognizerWorker.node.entry.ts", import.meta.url);
  const runtime = yield* makeCitationBundledTestRuntime(kind, NodeURL.fileURLToPath(entry), cwd);
  return { fs, runtime };
});
it.layer(BunServices.layer, { excludeTestServices: true })("actual pinned recognizer process", (it) => {
  for (const kind of CitationNativeRuntimeKind.literals) {
    it.effect(
      `${kind} recognizes all frozen forms and original ranges with independent physical exits`,
      () =>
        Effect.gen(function* () {
          const { fs, runtime } = yield* fixture(kind);
          const raw = yield* fs.readFileString(
            NodeURL.fileURLToPath(
              new URL(
                "../../../../goals/citation-extraction-engine/history/evidence/2026-11-08-six-form-selection/profile.frozen.json.txt",
                import.meta.url
              )
            )
          );
          const profile = yield* S.decodeEffect(Profile)(raw);
          const { limits } = yield* defaultCitationEnginePolicy;
          const observed = yield* makeCitationObservedSpawner();
          const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
            Effect.provideService(ChildProcessSpawner, observed.spawner)
          );
          let occurrences = 0;
          for (const row of profile.cases) {
            const closed: Effect.Effect<
              EyeciteRecognizeOutput,
              CitationRecognizerFailure | CitationSafetyLimitExceeded
            > = worker.recognize(row.text);
            const output = yield* closed;
            expect(
              A.map(output.tokens, (token) => forms[token.type]),
              row.id
            ).toEqual(A.map(row.expected, (token) => token.form));
            for (let index = 0; index < A.length(output.tokens); index++) {
              const token = A.getUnsafe(output.tokens, index);
              const expected = A.getUnsafe(row.expected, index);
              const start =
                token.type === "supra" && expected.antecedent !== null
                  ? expected.antecedent.start
                  : expected.anchor.start;
              expect(token.range, row.id).toEqual({ start, end: expected.anchor.end });
            }
            occurrences += A.length(output.tokens);
            const state = yield* worker.snapshot;
            expect(state).toMatchObject({ processes: 0, quarantined: 0 });
          }
          expect(occurrences).toBe(33);
          const physical = yield* observed.snapshot;
          expect(physical).toEqual({ spawned: 29, confirmed: 29 });
        }),
      { timeout: 30_000 }
    );
  }
  it.effect("redacts failure of independent exit acknowledgement after actual child exit", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture("bun");
      const { limits } = yield* defaultCitationEnginePolicy;
      const observed = yield* makeCitationObservedSpawner();
      const spawner = ChildProcessSpawner.of({
        ...observed.spawner,
        spawn: Effect.fnUntraced(function* (command) {
          const child = yield* observed.spawner.spawn(command);
          return {
            ...child,
            exitCode: child.exitCode.pipe(
              Effect.andThen(
                Effect.fail(
                  PlatformError.systemError({
                    module: "ChildProcess",
                    method: "exitCode",
                    _tag: "Unknown",
                    cause: "PRIVATE-EXIT-CAUSE",
                  })
                )
              )
            ),
          };
        }),
      });
      const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, spawner)
      );
      const failure = yield* worker.recognize("35 U.S.C. 101").pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognizerFailure", reason: "channel-failed" });
      expect(failure).not.toHaveProperty("cause");
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
    })
  );
  it.effect("refuses invalid installation and non-string source without spawning", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture("bun");
      const { limits } = yield* defaultCitationEnginePolicy;
      const observed = yield* makeCitationObservedSpawner();
      const invalid = yield* makeCitationRecognizerWorker(limits, {}).pipe(Effect.flip);
      expect(invalid).toMatchObject({ _tag: "CitationRecognizerFailure", reason: "invalid-runtime" });
      const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const failure = yield* worker.recognize({ source: "PRIVATE-SOURCE" }).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognizerFailure", reason: "invalid-input" });
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 0, confirmed: 0 });
    })
  );
  it.effect("refuses source before spawn and complete candidate overflow after acknowledged retirement", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture("bun");
      const { limits } = yield* defaultCitationEnginePolicy;
      const observed = yield* makeCitationObservedSpawner();
      const tiny = yield* makeCitationRecognizerWorker({ ...limits, sourceUtf16: 1 }, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const sourceFailure = yield* tiny.recognize("private-source").pipe(Effect.flip);
      expect(sourceFailure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "sourceUtf16" });
      const before = yield* observed.snapshot;
      expect(before).toEqual({ spawned: 0, confirmed: 0 });
      const limited = yield* makeCitationRecognizerWorker({ ...limits, candidates: 1 }, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const candidateFailure = yield* limited.recognize("35 U.S.C. 101; 35 U.S.C. 102").pipe(Effect.flip);
      expect(candidateFailure).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "candidates" });
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
    })
  );
  it.effect("refuses an outbound request before any stdin bytes exceed its captured ceiling", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture("bun");
      const { limits } = yield* defaultCitationEnginePolicy;
      const observed = yield* makeCitationObservedSpawner();
      let bytesWritten = 0;
      const spawner = ChildProcessSpawner.of({
        ...observed.spawner,
        spawn: Effect.fnUntraced(function* (command) {
          const child = yield* observed.spawner.spawn(command);
          return {
            ...child,
            stdin: child.stdin.pipe(
              Sink.mapInputEffect((bytes) =>
                Effect.sync(() => {
                  bytesWritten += bytes.byteLength;
                  return bytes;
                })
              )
            ),
          };
        }),
      });
      const worker = yield* makeCitationRecognizerWorker({ ...limits, processMessageBytes: 1 }, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, spawner)
      );
      const failure = yield* worker.recognize("35 U.S.C. 101").pipe(Effect.flip);
      expect(failure._tag).toBe("CitationRecognizerFailure");
      expect(bytesWritten).toBe(0);
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
    })
  );
  it.effect("refuses an oversized actual parser response before stdout writes a frame", () =>
    Effect.gen(function* () {
      const { runtime } = yield* fixture("bun");
      const { limits } = yield* defaultCitationEnginePolicy;
      const observed = yield* makeCitationObservedSpawner();
      let maximumWrite = 0;
      let maximumRead = 0;
      const spawner = ChildProcessSpawner.of({
        ...observed.spawner,
        spawn: Effect.fnUntraced(function* (command) {
          const child = yield* observed.spawner.spawn(command);
          return {
            ...child,
            stdin: child.stdin.pipe(
              Sink.mapInputEffect((bytes) =>
                Effect.sync(() => {
                  if (bytes.byteLength > maximumWrite) maximumWrite = bytes.byteLength;
                  return bytes;
                })
              )
            ),
            stdout: child.stdout.pipe(
              Stream.tap((bytes) =>
                Effect.sync(() => {
                  if (bytes.byteLength > maximumRead) maximumRead = bytes.byteLength;
                })
              )
            ),
          };
        }),
      });
      const source = "Alpha Corporation v. Beta Industries, 123 U.S. 100, 120 (2000)";
      const normal = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, spawner)
      );
      yield* normal.recognize(source);
      const ceiling = maximumWrite + 8;
      expect(maximumRead).toBeGreaterThan(ceiling);
      maximumRead = 0;
      const bounded = yield* makeCitationRecognizerWorker({ ...limits, processMessageBytes: ceiling }, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, spawner)
      );
      const failure = yield* bounded.recognize(source).pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognizerFailure", reason: "worker-diagnostic" });
      expect(maximumRead).toBe(0);
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 2, confirmed: 2 });
    })
  );
  it.effect("rejects diagnostics after real recognition without exposing their source text", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-recognizer-warning-" });
      const runtime = yield* makeCitationBundledTestRuntime(
        "bun",
        NodeURL.fileURLToPath(new URL("./CitationRecognizerWarning.entry.ts", import.meta.url)),
        cwd
      );
      const { limits } = yield* defaultCitationEnginePolicy;
      const observed = yield* makeCitationObservedSpawner();
      const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
        Effect.provideService(ChildProcessSpawner, observed.spawner)
      );
      const failure = yield* worker.recognize("35 U.S.C. 101").pipe(Effect.flip);
      expect(failure).toMatchObject({ _tag: "CitationRecognizerFailure", reason: "worker-diagnostic" });
      if (!S.is(CitationRecognizerFailure)(failure)) return yield* Effect.die("Expected diagnostic refusal");
      const json = yield* S.encodeEffect(S.fromJsonString(CitationRecognizerFailure))(failure);
      expect(json).not.toContain("PRIVATE-WORKER-SOURCE-SENTINEL");
      expect(json).not.toContain(cwd);
      const physical = yield* observed.snapshot;
      expect(physical).toEqual({ spawned: 1, confirmed: 1 });
    })
  );
  it.layer(TestClock.layer())("captured parser deadline", (it) => {
    it.effect("keeps supervision responsive and physically retires non-cooperative work", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-recognizer-blocked-" });
        const runtime = yield* makeCitationBundledTestRuntime(
          "bun",
          NodeURL.fileURLToPath(new URL("./CitationRecognizerBlocked.entry.ts", import.meta.url)),
          cwd
        );
        const { limits } = yield* defaultCitationEnginePolicy;
        const observed = yield* makeCitationObservedSpawner();
        const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
          Effect.provideService(ChildProcessSpawner, observed.spawner)
        );
        const pending = yield* worker.recognize("35 U.S.C. 101").pipe(Effect.forkChild);
        yield* Effect.repeat(fs.exists(path.join(cwd, "started")), { until: (ready) => ready });
        yield* TestClock.adjust(limits.extractDeadline);
        const failure = yield* Fiber.join(pending).pipe(Effect.flip);
        expect(failure).toMatchObject({
          _tag: "CitationSafetyLimitExceeded",
          operation: "extract",
          limit: "extractDeadline",
        });
        const physical = yield* observed.snapshot;
        expect(physical).toEqual({ spawned: 1, confirmed: 1 });
        const state = yield* worker.snapshot;
        expect(state).toMatchObject({ processes: 0, quarantined: 0 });
      })
    );
  });
  for (const [entry, reason] of [
    Tuple.make(new URL("./CitationRecognizerAbnormal.entry.ts", import.meta.url), "channel-failed"),
    Tuple.make(new URL("./CitationRecognizerLateWarning.entry.ts", import.meta.url), "worker-diagnostic"),
  ]) {
    it.effect(`${entry} refuses a delivered result until terminal checks pass`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-recognizer-terminal-" });
        const runtime = yield* makeCitationBundledTestRuntime("bun", NodeURL.fileURLToPath(entry), cwd);
        const { limits } = yield* defaultCitationEnginePolicy;
        const observed = yield* makeCitationObservedSpawner();
        let lastExit = O.none<number>();
        let responseBytes = 0;
        const spawner = ChildProcessSpawner.of({
          ...observed.spawner,
          spawn: Effect.fnUntraced(function* (command) {
            const child = yield* observed.spawner.spawn(command);
            return {
              ...child,
              stdout: child.stdout.pipe(
                Stream.tap((bytes) =>
                  Effect.sync(() => {
                    responseBytes += bytes.byteLength;
                  })
                )
              ),
              exitCode: child.exitCode.pipe(
                Effect.tap((code) =>
                  Effect.sync(() => {
                    lastExit = O.some(code);
                  })
                )
              ),
            };
          }),
        });
        const worker = yield* makeCitationRecognizerWorker(limits, runtime).pipe(
          Effect.provideService(ChildProcessSpawner, spawner)
        );
        const failure = yield* worker.recognize("35 U.S.C. 101").pipe(Effect.flip);
        expect(failure).toMatchObject({ _tag: "CitationRecognizerFailure", reason });
        expect(responseBytes).toBeGreaterThan(0);
        if (reason === "channel-failed") expect(O.getOrThrow(lastExit)).toBe(7);
        if (!S.is(CitationRecognizerFailure)(failure)) return yield* Effect.die("Expected terminal refusal");
        const json = yield* S.encodeEffect(S.fromJsonString(CitationRecognizerFailure))(failure);
        expect(json).not.toContain("PRIVATE-LATE-WORKER-SENTINEL");
        expect(json).not.toContain(cwd);
        const physical = yield* observed.snapshot;
        expect(physical).toEqual({ spawned: 1, confirmed: 1 });
      })
    );
  }
});
