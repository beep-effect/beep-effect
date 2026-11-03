import * as NodeURL from "node:url";
import { DeliveryEventState } from "@beep/repo-ai-metrics/delivery-ledger";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";

const fixture = NodeURL.fileURLToPath(new URL("./fixtures/payload-reclamation-process.ts", import.meta.url));
const cwd = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Inspection = S.Struct({
  state: S.NullOr(DeliveryEventState),
  replayAccepted: S.Boolean,
  replayRefusal: S.NullOr(S.Literal("expired")),
  pages: S.Tuple([S.Struct({ n: S.Natural })]),
  dispositions: S.Tuple([S.Struct({ n: S.Natural })]),
  integrity: S.Tuple([S.Struct({ integrity_check: S.tag("ok") })]),
});
const decodeJsonValue = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeInspectionJson = S.decodeEffect(S.fromJsonString(Inspection));

const scenario = Effect.fn("ReclamationCrashTest.scenario")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const executablePath = yield* Config.String("PATH");
  const dir = yield* fs.makeTempDirectoryScoped();
  const output = `${dir}/result.json`;
  const marker = `${dir}/boundary.json`;
  const run = Effect.fn("ReclamationCrashTest.run")(function* (
    mode:
      | "inspect"
      | "accept"
      | "before-disposition"
      | "after-disposition"
      | "before-expiry"
      | "after-expiry"
      | "retry-expiry"
  ) {
    yield* fs.remove(output, { force: true });
    yield* fs.remove(marker, { force: true });
    const child = yield* ChildProcess.make(
      "bun",
      ["--no-env-file", fixture, mode, `${dir}/journal.sqlite`, output, marker],
      {
        cwd,
        env: { PATH: executablePath },
        extendEnv: false,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
        killSignal: "SIGKILL",
      }
    );
    if (
      mode === "before-disposition" ||
      mode === "after-disposition" ||
      mode === "before-expiry" ||
      mode === "after-expiry"
    ) {
      while (!(yield* fs.exists(marker))) {
        const isRunning1 = yield* child.isRunning;
        expect(isRunning1).toBe(true);
        yield* Effect.sleep("10 millis");
      }
      const observed = yield* fs.readFileString(marker).pipe(Effect.flatMap(decodeJsonValue));
      expect(observed).toEqual({
        boundary: mode,
        pages: [{ n: 0 }],
        dispositions: [{ n: mode === "before-disposition" || mode === "before-expiry" ? 0 : 1 }],
      });
      const exists2 = yield* fs.exists(output);
      expect(exists2).toBe(false);
      yield* child.kill({ killSignal: "SIGKILL" });
      const exit3 = yield* Effect.exit(child.exitCode);
      expect(Exit.isFailure(exit3)).toBe(true);
      const isRunning4 = yield* child.isRunning;
      expect(isRunning4).toBe(false);
      return;
    }
    const exitCode5 = yield* child.exitCode;
    expect(exitCode5).toBe(0);
    return yield* fs.readFileString(output).pipe(Effect.flatMap(decodeInspectionJson));
  });
  return { run };
});
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("restores deleted payload when killed before the disposition transaction commits", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("before-disposition");
      const result6 = yield* run("inspect");
      expect(result6).toMatchObject({
        state: { state: "visible", attempts: 1 },
        pages: [{ n: 1 }],
        dispositions: [{ n: 0 }],
      });
      const reclaimed = yield* run("accept");
      expect(reclaimed).toMatchObject({
        state: { state: "visible", attempts: 1 },
        pages: [{ n: 0 }],
        dispositions: [{ n: 1 }],
        replayAccepted: true,
      });
      const result7 = yield* run("accept");
      expect(result7).toEqual(reclaimed);
    }).pipe(Effect.timeout("20 seconds"))
  )
);
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("preserves committed reclamation and original replay receipt after process death", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("after-disposition");
      const result8 = yield* run("inspect");
      expect(result8).toMatchObject({
        state: { state: "visible", attempts: 1 },
        pages: [{ n: 0 }],
        dispositions: [{ n: 1 }],
      });
      const result9 = yield* run("accept");
      expect(result9).toMatchObject({
        state: { state: "visible", attempts: 1 },
        pages: [{ n: 0 }],
        dispositions: [{ n: 1 }],
        replayAccepted: true,
      });
    }).pipe(Effect.timeout("20 seconds"))
  )
);

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("rolls back uncertain expiry when killed after payload deletion before commit", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("before-expiry");
      const result10 = yield* run("inspect");
      expect(result10).toMatchObject({
        state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
        pages: [{ n: 1 }],
        dispositions: [{ n: 0 }],
      });
      yield* run("after-expiry");
      const result11 = yield* run("retry-expiry");
      expect(result11).toMatchObject({
        state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
        pages: [{ n: 0 }],
        dispositions: [{ n: 1 }],
        replayRefusal: "expired",
      });
    }).pipe(Effect.timeout("20 seconds"))
  )
);
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("preserves uncertainty and permanent replay refusal after committed expiry and process death", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("after-expiry");
      const result12 = yield* run("inspect");
      expect(result12).toMatchObject({
        state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
        pages: [{ n: 0 }],
        dispositions: [{ n: 1 }],
      });
      const result13 = yield* run("retry-expiry");
      expect(result13).toMatchObject({
        state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
        pages: [{ n: 0 }],
        dispositions: [{ n: 1 }],
        replayRefusal: "expired",
      });
    }).pipe(Effect.timeout("20 seconds"))
  )
);
