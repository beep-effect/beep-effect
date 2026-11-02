import * as NodeURL from "node:url";
import { TranscriptAcceptance, TranscriptIntakeStats } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";

const fixturePath = NodeURL.fileURLToPath(new URL("./fixtures/transcript-intake-process.ts", import.meta.url));
const packageRoot = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Result = S.Struct({
  stats: TranscriptIntakeStats,
  hasCursor: S.Boolean,
  receipts: S.Array(TranscriptAcceptance),
  integrity: S.Tuple([S.Struct({ integrity_check: S.tag("ok") })]),
  selected: S.Array(Sha256Hex),
});
const line = '{"type":"response_item","payload":{"type":"message","content":"private-synthetic-crash-prompt"}}\n';
const decodeJsonValue = S.decodeEffect(S.fromJsonString(S.Unknown));
const decodeResultJson = S.decodeEffect(S.fromJsonString(Result));

const scenario = Effect.fn("TranscriptIntakeCrashTest.scenario")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const executablePath = yield* Config.String("PATH");
  const dir = yield* fs.makeTempDirectoryScoped();
  const source = `${dir}/source.jsonl`;
  yield* fs.writeFileString(source, line);
  const marker = `${dir}/boundary.json`;
  const output = `${dir}/result.json`;
  const run = Effect.fn("TranscriptIntakeCrashTest.run")(function* (
    mode: "inspect" | "accept" | "reserve" | "before-commit" | "after-commit"
  ) {
    yield* fs.remove(output, { force: true });
    yield* fs.remove(marker, { force: true });
    const child = yield* ChildProcess.make(
      "bun",
      ["--no-env-file", fixturePath, mode, `${dir}/intake.sqlite`, source, output, marker],
      {
        cwd: packageRoot,
        env: { PATH: executablePath },
        extendEnv: false,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
      }
    );
    if (mode === "before-commit" || mode === "after-commit") {
      // A bounded live-clock wait proves the child reached the intended boundary.
      while (!(yield* fs.exists(marker))) {
        expect(yield* child.isRunning).toBe(true);
        yield* Effect.sleep("10 millis");
      }
      const evidence = yield* fs.readFileString(marker).pipe(Effect.flatMap(decodeJsonValue));
      expect(evidence).toEqual(
        mode === "before-commit"
          ? { boundary: mode, pages: [{ count: 1 }], cursors: [{ count: 0 }] }
          : { boundary: mode, stats: { pages: 1, frames: 1, payloadBytes: expect.any(Number) } }
      );
      expect(yield* fs.exists(output)).toBe(false);
      yield* child.kill({ killSignal: "SIGKILL" });
      expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
      expect(yield* child.isRunning).toBe(false);
      expect(yield* fs.exists(output)).toBe(false);
      return;
    }
    expect(yield* child.exitCode).toBe(0);
    return yield* fs.readFileString(output).pipe(Effect.flatMap(decodeResultJson));
  });
  return { run };
});

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("recovers an uncommitted page/cursor transaction after its writer is killed", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("before-commit");
      expect(yield* run("inspect")).toMatchObject({
        stats: { pages: 0, payloadBytes: 0, frames: 0 },
        hasCursor: false,
        receipts: [],
      });
      const accepted = yield* run("accept");
      expect(accepted).toMatchObject({ stats: { pages: 1, frames: 1 }, hasCursor: true, receipts: [{ sequence: 1 }] });
      expect(yield* run("accept")).toEqual(accepted);
    }).pipe(Effect.timeout("20 seconds"))
  )
);

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("recovers a committed page without an acknowledgment and returns its original receipt on replay", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      yield* run("after-commit");
      const recovered = yield* run("inspect");
      expect(recovered).toMatchObject({ stats: { pages: 1, frames: 1 }, hasCursor: true, receipts: [{ sequence: 1 }] });
      expect(yield* run("accept")).toEqual(recovered);
      expect(yield* run("inspect")).toEqual(recovered);
    }).pipe(Effect.timeout("20 seconds"))
  )
);

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("persists fair reservations across independent processes without advancing source acceptance", () =>
    Effect.gen(function* () {
      const { run } = yield* scenario();
      const results = yield* Effect.forEach(A.range(1, 4), () => run("reserve"));
      const selected = A.map(results, (result) => result?.selected[0]);
      expect(A.dedupe(selected).length).toBe(3);
      expect(selected[3]).toBe(selected[0]);
      for (const result of results) expect(result).toMatchObject({ stats: { pages: 0, frames: 0 }, hasCursor: false });
    }).pipe(Effect.timeout("20 seconds"))
  )
);
