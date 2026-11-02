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

const fixture = NodeURL.fileURLToPath(new URL("./fixtures/delivery-ledger-process.ts", import.meta.url));
const cwd = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Inspection = S.Struct({
  state: S.NullOr(DeliveryEventState),
  attempts: S.Tuple([S.Struct({ n: S.Natural })]),
  results: S.Tuple([S.Struct({ n: S.Natural })]),
  integrity: S.Tuple([S.Struct({ integrity_check: S.tag("ok") })]),
});
const decodeJsonValue = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeInspectionJson = S.decodeEffect(S.fromJsonString(Inspection));

const scenario = Effect.fn("DeliveryCrashTest.scenario")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const executablePath = yield* Config.String("PATH");
  const dir = yield* fs.makeTempDirectoryScoped();
  const output = `${dir}/result.json`;
  const marker = `${dir}/boundary.json`;
  const run = Effect.fn("DeliveryCrashTest.run")(function* (
    mode: "inspect" | "accept" | "before-result" | "after-result"
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
    if (mode === "before-result" || mode === "after-result") {
      while (!(yield* fs.exists(marker))) {
        expect(yield* child.isRunning).toBe(true);
        yield* Effect.sleep("10 millis");
      }
      const observed = yield* fs.readFileString(marker).pipe(Effect.flatMap(decodeJsonValue));
      expect(observed).toEqual({
        boundary: mode,
        attempts: [{ n: 1 }],
        results: [{ n: mode === "before-result" ? 0 : 1 }],
      });
      expect(yield* fs.exists(output)).toBe(false);
      yield* child.kill({ killSignal: "SIGKILL" });
      expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
      expect(yield* child.isRunning).toBe(false);
      return;
    }
    expect(yield* child.exitCode).toBe(0);
    return yield* fs.readFileString(output).pipe(Effect.flatMap(decodeInspectionJson));
  });
  return { run };
});
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("preserves unresolved delivery when a process dies before its result fact commits", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("before-result");
      expect(yield* run("inspect")).toMatchObject({
        state: { state: "unresolved", attempts: 1 },
        results: [{ n: 0 }],
      });
      const accepted = yield* run("accept");
      expect(accepted).toMatchObject({
        state: { state: "accepted-unverified", acknowledgedAttempts: 1 },
        attempts: [{ n: 1 }],
        results: [{ n: 1 }],
      });
      expect(yield* run("accept")).toEqual(accepted);
    }).pipe(Effect.timeout("20 seconds"))
  )
);
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("retains a committed result after process death and replays its write without another fact", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("after-result");
      const accepted = yield* run("inspect");
      expect(accepted).toMatchObject({
        state: { state: "accepted-unverified", acknowledgedAttempts: 1 },
        attempts: [{ n: 1 }],
        results: [{ n: 1 }],
      });
      expect(yield* run("accept")).toEqual(accepted);
    }).pipe(Effect.timeout("20 seconds"))
  )
);
