import * as NodeURL from "node:url";
import { DeliveryEventState } from "@beep/repo-ai-metrics/delivery-ledger";
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

const fixture = NodeURL.fileURLToPath(new URL("./fixtures/payload-reclamation-process.ts", import.meta.url));
const cwd = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Inspection = S.Struct({
  state: S.NullOr(DeliveryEventState),
  replayAccepted: S.Boolean,
  replayRefusal: S.NullOr(S.Literal("expired")),
  pages: S.Tuple([S.Struct({ n: S.Natural })]),
  dispositions: S.Tuple([S.Struct({ n: S.Natural })]),
  integrity: S.Tuple([S.Struct({ integrity_check: S.Literal("ok") })]),
});
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
        expect(yield* child.isRunning).toBe(true);
        yield* Effect.sleep("10 millis");
      }
      const observed = yield* fs
        .readFileString(marker)
        .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Unknown))));
      expect(observed).toEqual({
        boundary: mode,
        pages: [{ n: 0 }],
        dispositions: [{ n: mode === "before-disposition" || mode === "before-expiry" ? 0 : 1 }],
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
it.live("restores deleted payload when killed before the disposition transaction commits", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("before-disposition");
    expect(yield* run("inspect")).toMatchObject({
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
    expect(yield* run("accept")).toEqual(reclaimed);
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
it.live("preserves committed reclamation and original replay receipt after process death", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("after-disposition");
    expect(yield* run("inspect")).toMatchObject({
      state: { state: "visible", attempts: 1 },
      pages: [{ n: 0 }],
      dispositions: [{ n: 1 }],
    });
    expect(yield* run("accept")).toMatchObject({
      state: { state: "visible", attempts: 1 },
      pages: [{ n: 0 }],
      dispositions: [{ n: 1 }],
      replayAccepted: true,
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);

it.live("rolls back uncertain expiry when killed after payload deletion before commit", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("before-expiry");
    expect(yield* run("inspect")).toMatchObject({
      state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
      pages: [{ n: 1 }],
      dispositions: [{ n: 0 }],
    });
    yield* run("after-expiry");
    expect(yield* run("retry-expiry")).toMatchObject({
      state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
      pages: [{ n: 0 }],
      dispositions: [{ n: 1 }],
      replayRefusal: "expired",
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
it.live("preserves uncertainty and permanent replay refusal after committed expiry and process death", () =>
  Effect.gen(function* () {
    const { run } = yield* scenario();
    yield* run("after-expiry");
    expect(yield* run("inspect")).toMatchObject({
      state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
      pages: [{ n: 0 }],
      dispositions: [{ n: 1 }],
    });
    expect(yield* run("retry-expiry")).toMatchObject({
      state: { state: "unresolved", attempts: 1, ambiguousAttempts: 1 },
      pages: [{ n: 0 }],
      dispositions: [{ n: 1 }],
      replayRefusal: "expired",
    });
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
