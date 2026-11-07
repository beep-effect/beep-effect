import * as NodeURL from "node:url";
import { BunServices } from "@effect/platform-bun";
import { describe, expect, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const childFile = NodeURL.fileURLToPath(new URL("./fixtures/VaultSyncCrash.child.ts", import.meta.url));
const runChild = Effect.fn("test.runCrashChild")(function* (args: ReadonlyArray<string>, kill: boolean) {
  const spawner = yield* ChildProcessSpawner;
  const handle = yield* spawner.spawn(ChildProcess.make("bun", [childFile, ...args]));
  const output = yield* Ref.make("");
  const killed = yield* Ref.make(false);
  yield* handle.all.pipe(
    Stream.decodeText(),
    Stream.runForEach(
      Effect.fnUntraced(function* (chunk) {
        yield* Ref.update(output, (text) => text + chunk);
        const text = yield* Ref.get(output);
        const already = yield* Ref.get(killed);
        if (kill && !already && Str.includes("READY-TO-KILL")(text)) {
          yield* Ref.set(killed, true);
          yield* handle.kill({ killSignal: "SIGKILL" });
        }
      })
    )
  );
  const code = yield* handle.exitCode.pipe(Effect.result);
  const text = yield* Ref.get(output);
  const didKill = yield* Ref.get(killed);
  if (kill) {
    expect(didKill, text).toBe(true);
    expect(code).toMatchObject({ _tag: "Failure" });
  } else expect(code, text).toMatchObject({ _tag: "Success", success: 0 });
  return text;
});

describe("OS process crash recovery", () => {
  layer(BunServices.layer, { timeout: "60 seconds", excludeTestServices: true })("file-backed PGlite", (it) => {
    it.effect("SIGKILLs mid-pump and resumes without repeating completed Box mutations", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const base = yield* fs.makeTempDirectoryScoped();
        const root = path.join(base, "vault");
        const ledger = path.join(base, "synthetic-remote-calls.txt");
        yield* fs.makeDirectory(root);
        yield* fs.writeFileString(path.join(root, "a.txt"), "synthetic A");
        yield* fs.writeFileString(path.join(root, "b.txt"), "synthetic B");
        yield* fs.writeFileString(ledger, "");
        const args = [path.join(base, "db"), root, ledger];
        const killed = yield* runChild([...args, "crash"], true).pipe(Effect.timeout("25 seconds"));
        expect(killed).toContain("READY-TO-KILL");
        const resumed = yield* runChild([...args, "resume"], false).pipe(Effect.timeout("25 seconds"));
        expect(resumed).toContain("COMPLETED:2");
        const calls = yield* fs.readFileString(ledger);
        expect(calls).toBe("a.txt\nb.txt\n");
      })
    );
  });
});
