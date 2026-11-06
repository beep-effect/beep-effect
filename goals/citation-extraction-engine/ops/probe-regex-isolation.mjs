/** Prove an owned process can be stopped during native regex backtracking. */
import { spawn } from "node:child_process";
import { cpus } from "node:os";
import { fileURLToPath } from "node:url";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as S from "effect/Schema";

const childPath = fileURLToPath(new URL("./regex-isolation-probe.child.mjs", import.meta.url));
const acquire = (executable) =>
  Effect.sync(() => {
    const child = spawn(executable, [childPath], { stdio: ["ignore", "ignore", "ignore", "ipc"], env: {} });
    let ready;
    let started;
    let result;
    let exit;
    const readyPromise = new Promise((resolve) => {
      ready = resolve;
    });
    const startedPromise = new Promise((resolve) => {
      started = resolve;
    });
    const resultPromise = new Promise((resolve) => {
      result = resolve;
    });
    const exitPromise = new Promise((resolve) => {
      exit = resolve;
    });
    child.on("message", (message) => {
      if (message.kind === "ready") ready(message);
      if (message.kind === "started") started(message);
      if (message.kind === "result") result(message);
    });
    child.on("error", () => {
      ready({ kind: "error" });
      started({ kind: "error" });
      result({ kind: "error" });
    });
    child.on("exit", (code, signal) => {
      exit({ code, signal });
      ready({ kind: "exited" });
      started({ kind: "exited" });
      result({ kind: "exited" });
    });
    return { child, readyPromise, startedPromise, resultPromise, exitPromise, exitConfirmed: false };
  });
const cleanup = (resource) =>
  Effect.gen(function* () {
    if (resource.child.exitCode === null && resource.child.signalCode === null) resource.child.kill("SIGKILL");
    resource.exit = yield* Effect.promise(() => resource.exitPromise).pipe(Effect.timeout(Duration.seconds(2)));
    resource.exitConfirmed = true;
  });
const probe = (executable, runtimeKind, catastrophic, repetition) =>
  Effect.gen(function* () {
    let resource;
    let result;
    yield* Effect.acquireUseRelease(
      acquire(executable),
      (owned) =>
        Effect.gen(function* () {
          resource = owned;
          const ready = yield* Effect.promise(() => owned.readyPromise).pipe(Effect.timeout(Duration.seconds(5)));
          if (ready.kind !== "ready") return yield* Effect.fail(new Error("probe child failed to start"));
          owned.child.send({
            kind: "match",
            pattern: catastrophic ? "^(a+)+$" : "^a+$",
            flags: "",
            text: catastrophic ? `${"a".repeat(40)}!` : "a".repeat(4096),
          });
          const started = yield* Effect.promise(() => owned.startedPromise).pipe(Effect.timeout(Duration.seconds(2)));
          if (started.kind !== "started") return yield* Effect.fail(new Error("probe did not enter regex"));
          let heartbeats = 0;
          const heartbeat = yield* Effect.sleep(Duration.millis(10)).pipe(
            Effect.tap(() =>
              Effect.sync(() => {
                heartbeats++;
              })
            ),
            Effect.forever,
            Effect.forkChild
          );
          const start = yield* Clock.currentTimeMillis;
          const outcome = yield* Effect.promise(() => owned.resultPromise).pipe(
            Effect.timeoutOrElse({
              duration: Duration.millis(100),
              orElse: () => Effect.succeed({ kind: "deadline" }),
            })
          );
          const end = yield* Clock.currentTimeMillis;
          yield* Fiber.interrupt(heartbeat);
          if (
            catastrophic ? outcome.kind !== "deadline" || heartbeats < 1 : outcome.kind !== "result" || !outcome.matched
          )
            return yield* Effect.fail(new Error("isolation control produced an unexpected result"));
          result = {
            runtimeKind,
            runtime: ready.runtime,
            bunVersion: ready.bunVersion,
            repetition,
            control: catastrophic ? "catastrophic-backtracking" : "safe-linear",
            inputUtf16: catastrophic ? 41 : 4096,
            deadlineMillis: 100,
            outcome: outcome.kind,
            matched: outcome.kind === "result" ? outcome.matched : null,
            heartbeats,
            observedWindowMillis: end - start,
          };
        }),
      cleanup
    );
    if (!resource.exitConfirmed || (catastrophic && resource.exit.signal !== "SIGKILL"))
      return yield* Effect.fail(new Error("probe child exit was not confirmed"));
    return {
      ...result,
      exitConfirmed: resource.exitConfirmed,
      exitSignal: resource.exit.signal,
      exitCode: resource.exit.code,
    };
  });
const program = Effect.gen(function* () {
  const results = [];
  for (const [kind, executable] of [
    ["node", process.argv[2]],
    ["bun", process.argv[3]],
  ]) {
    for (let repetition = 1; repetition <= 3; repetition++) {
      results.push(yield* probe(executable, kind, false, repetition));
      results.push(yield* probe(executable, kind, true, repetition));
    }
  }
  const hasher = (bytes) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  const report = {
    schemaVersion: "citation-regex-process-isolation-probe/v1",
    scope: "Kill/cleanup mechanism controls only; not pattern compatibility or geometric scaling proof.",
    parentRuntime: process.version,
    parentBunVersion: Bun.version,
    platform: process.platform,
    architecture: process.arch,
    cpuModel: cpus()[0].model,
    warmups: 0,
    repetitions: 3,
    parentSourceSha256: hasher(yield* Effect.tryPromise(() => Bun.file(import.meta.path).bytes())),
    childSourceSha256: hasher(yield* Effect.tryPromise(() => Bun.file(childPath).bytes())),
    results,
  };
  const text = yield* S.encodeUnknownEffect(S.fromJsonString(S.JsonObject))(report);
  yield* Effect.tryPromise(() => Bun.write(process.argv[4], text));
  process.stdout.write(`Isolation controls passed: ${results.length} Node/Bun runs; every child exit confirmed.\n`);
});
Effect.runPromise(program).catch(() => {
  process.stderr.write("Regex process isolation probe failed.\n");
  process.exitCode = 1;
});
