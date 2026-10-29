import * as NodeURL from "node:url";
import { DeliveryEventState } from "@beep/repo-ai-metrics/delivery-ledger";
import { EvidenceWindow } from "@beep/repo-ai-metrics/evidence-window";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";

const fixture = NodeURL.fileURLToPath(new URL("./fixtures/evidence-retention-process.ts", import.meta.url));
const cwd = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Inspection = S.Struct({
  window: EvidenceWindow,
  restored: S.NullOr(S.String),
  state: S.NullOr(DeliveryEventState),
  acceptedEpoch: S.NullOr(S.Natural),
  events: S.Tuple([S.Struct({ n: S.Natural })]),
  integrity: S.Tuple([S.Struct({ integrity_check: S.Literal("ok") })]),
});
const scenario = Effect.fn("EvidenceCrashTest.scenario")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const executablePath = yield* Config.String("PATH");
  const dir = yield* fs.makeTempDirectoryScoped();
  const output = `${dir}/result.json`;
  const marker = `${dir}/boundary.json`;
  const run = Effect.fn("EvidenceCrashTest.run")(function* (
    mode: "inspect" | "new-epoch" | "before-window" | "after-window" | "before-restore" | "after-restore" | "restore"
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
    if (mode === "before-window" || mode === "after-window" || mode === "before-restore" || mode === "after-restore") {
      while (!(yield* fs.exists(marker))) {
        expect(yield* child.isRunning).toBe(true);
        yield* Effect.sleep("10 millis");
      }
      const observed = yield* fs
        .readFileString(marker)
        .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Unknown))));
      expect(observed).toEqual({
        boundary: mode,
        events: [{ n: mode === "before-restore" || mode === "after-restore" ? 1 : 0 }],
      });
      expect(yield* fs.exists(output)).toBe(false);
      yield* child.kill({ killSignal: "SIGKILL" });
      expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
      expect(yield* child.isRunning).toBe(false);
      return;
    }
    expect(yield* child.exitCode).toBe(0);
    return yield* fs.readFileString(output).pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(Inspection))));
  });
  return { run };
});

it.live("restores detailed uncertainty after a process dies before the window checkpoint commits", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("before-window");
    expect(yield* run("inspect")).toMatchObject({
      window: { epoch: 0 },
      state: { state: "unresolved", attempts: 1 },
      events: [{ n: 1 }],
    });
    yield* run("after-window");
    expect(yield* run("inspect")).toMatchObject({
      window: { epoch: 1, totals: { unresolved: 1, eventObservations: 1 } },
      state: null,
      events: [{ n: 0 }],
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
it.live("preserves committed retirement after process death and admits an explicitly new epoch", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("after-window");
    expect(yield* run("inspect")).toMatchObject({
      window: { epoch: 1, totals: { unresolved: 1, eventObservations: 1 } },
      state: null,
      events: [{ n: 0 }],
    });
    expect(yield* run("new-epoch")).toMatchObject({
      window: { epoch: 1, totals: { unresolved: 1 } },
      acceptedEpoch: 1,
    });
    expect(yield* run("new-epoch")).toMatchObject({
      window: { epoch: 1, totals: { unresolved: 1 } },
      acceptedEpoch: 1,
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);

it.live("rolls back an interrupted restore and retries it after an independent process reopens the journal", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("after-window");
    yield* run("before-restore");
    expect(yield* run("inspect")).toMatchObject({ window: { epoch: 1 }, state: null, events: [{ n: 0 }] });
    expect(yield* run("restore")).toMatchObject({
      window: { epoch: 0 },
      restored: "restored",
      state: { state: "unresolved", attempts: 1 },
      events: [{ n: 1 }],
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
it.live("preserves a committed restore across process death and safely repeats the request", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("after-window");
    yield* run("after-restore");
    expect(yield* run("restore")).toMatchObject({
      window: { epoch: 0 },
      restored: "already-restored",
      state: { state: "unresolved", attempts: 1 },
      events: [{ n: 1 }],
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
