import {
  ancestryChainOf,
  ancestryPidsOf,
  invokerAncestryPids,
  ProcessAttachmentKind,
  processEnvironmentValue,
  processName,
  scanProcessAttachments,
  sessionRootOf,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as HashSet from "effect/HashSet";
import { ChildProcess } from "effect/process";
import type { ProcessAttachment } from "@beep/repo-cli/test/RepoRun";

const ownAttachments = (scan: O.Option<ReadonlyArray<ProcessAttachment>>): ReadonlyArray<ProcessAttachment> =>
  A.filter(O.getOrThrow(scan), (attachment) => attachment.pid === process.pid);

it.layer(NodeServices.layer, { timeout: "30 seconds" })("scanProcessAttachments", (it) => {
  it.effect("finds the invoking process through its cwd and reports an idle directory empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const idle = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-idle-" });

      const own = ownAttachments(yield* scanProcessAttachments({ directory: process.cwd(), kinds: ["cwd"] }));
      expect(A.map(own, (attachment) => attachment.kind)).toEqual(["cwd"]);

      const idleScan = yield* scanProcessAttachments({ directory: idle, kinds: ProcessAttachmentKind.literals });
      expect(O.getOrThrow(idleScan)).toEqual([]);
    })
  );

  it.effect("finds an open descriptor through a symlinked directory and forgets it once closed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-fd-" });
      const real = path.join(root, "real");
      const link = path.join(root, "link");
      yield* fs.makeDirectory(real);
      yield* fs.symlink(real, link);
      yield* fs.writeFileString(path.join(real, "held.log"), "");

      // The kernel resolves /proc link targets fully, so scanning through the symlink
      // must still see a descriptor opened under the real directory.
      const whileOpen = yield* Effect.scoped(
        Effect.gen(function* () {
          yield* fs.open(path.join(real, "held.log"), { flag: "r" });
          return yield* scanProcessAttachments({ directory: link, kinds: ["descriptor"] });
        })
      );
      const held = ownAttachments(whileOpen);
      expect(A.map(held, (attachment) => attachment.kind)).toEqual(["descriptor"]);
      expect(A.every(held, (attachment) => Str.endsWith("/real/held.log")(attachment.target))).toBe(true);

      const afterClose = yield* scanProcessAttachments({ directory: link, kinds: ["descriptor"] });
      expect(ownAttachments(afterClose)).toEqual([]);
    })
  );

  it.effect("withholds the result when the directory cannot be resolved", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-missing-" });
      const scan = yield* scanProcessAttachments({ directory: path.join(root, "missing"), kinds: ["cwd"] });
      expect(O.isNone(scan)).toBe(true);
    })
  );
});

const spawnSleeper = ChildProcess.make("sleep", ["60"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });

it.layer(NodeServices.layer, { timeout: "30 seconds" })("ancestryPidsOf", (it) => {
  it.effect("walks from a child through this process, and the invoker chain excludes the child", () =>
    Effect.gen(function* () {
      const child = yield* spawnSleeper;
      const ancestry = yield* ancestryPidsOf(child.pid).pipe(Effect.ensuring(Effect.ignore(child.kill())));
      expect(HashSet.has(ancestry, child.pid)).toBe(true);
      expect(HashSet.has(ancestry, process.pid)).toBe(true);
      expect(HashSet.has(ancestry, process.ppid)).toBe(true);

      const invoker = yield* invokerAncestryPids();
      expect(HashSet.has(invoker, process.pid)).toBe(true);
      expect(HashSet.has(invoker, process.ppid)).toBe(true);
      expect(HashSet.has(invoker, child.pid)).toBe(false);
    })
  );

  it.effect("names only the pid it started from when that process is gone", () =>
    Effect.gen(function* () {
      // Pids are bounded by pid_max, so this one cannot be running.
      const ancestry = yield* ancestryPidsOf(2 ** 31);
      expect(HashSet.size(ancestry)).toBe(1);
      expect(HashSet.has(ancestry, 2 ** 31)).toBe(true);
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("processName", (it) => {
  it.effect("reads a running process's command name and forgets one that is gone", () =>
    Effect.gen(function* () {
      const child = yield* spawnSleeper;
      const named = yield* processName(child.pid).pipe(Effect.ensuring(Effect.ignore(child.kill())));
      expect(named).toEqual(O.some("sleep"));
      expect(yield* processName(2 ** 31)).toEqual(O.none());
    })
  );
});

// A child started with extra exported variables, the way a harness starts its
// tool shells; the parent's own environment is kept so `sleep` still resolves.
const spawnSleeperWith = (env: Record<string, string>) =>
  ChildProcess.make("sleep", ["60"], { env, extendEnv: true, stdin: "ignore", stdout: "ignore", stderr: "ignore" });

it.layer(NodeServices.layer, { timeout: "30 seconds" })("ancestryChainOf and processEnvironmentValue", (it) => {
  it.effect("orders the chain nearest first and reads what a child was started with", () =>
    Effect.gen(function* () {
      const child = yield* spawnSleeperWith({ BEEP_TEST_MARKER: "present" });
      const chain = yield* ancestryChainOf(child.pid);
      expect(A.take(chain, 2)).toEqual([child.pid, process.pid]);
      expect(yield* processEnvironmentValue(child.pid, "BEEP_TEST_MARKER")).toEqual(O.some("present"));
      expect(yield* processEnvironmentValue(child.pid, "BEEP_TEST_ABSENT")).toEqual(O.none());
      expect(yield* processEnvironmentValue(2 ** 31, "HOME")).toEqual(O.none());
      yield* Effect.ignore(child.kill());
    })
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("sessionRootOf", (it) => {
  it.effect("proves the session from the marker its child carries and refuses every other claim", () =>
    Effect.gen(function* () {
      const marker = "CLAUDE_PID";
      // This process plays the harness: it exported its own pid to the child.
      const marked = yield* spawnSleeperWith({ [marker]: String(process.pid) });
      expect(yield* sessionRootOf(marked.pid, { name: marker, pid: process.pid })).toEqual(O.some(process.pid));
      // init is on every chain, but nothing on this path was started by it
      // with CLAUDE_PID=1; a universal ancestor must never become the session.
      expect(yield* sessionRootOf(marked.pid, { name: marker, pid: 1 })).toEqual(O.none());
      // An ancestor that never exported the marker: this process's parent.
      expect(yield* sessionRootOf(marked.pid, { name: marker, pid: process.ppid })).toEqual(O.none());
      // The invoker itself has no child on the path to vouch for it.
      expect(yield* sessionRootOf(marked.pid, { name: marker, pid: marked.pid })).toEqual(O.none());
      // A pid that is not on the chain at all.
      expect(yield* sessionRootOf(marked.pid, { name: marker, pid: 2 ** 31 })).toEqual(O.none());
      yield* Effect.ignore(marked.kill());

      // A child started with a forged value proves neither init nor this process.
      const forged = yield* spawnSleeperWith({ [marker]: "1" });
      expect(yield* sessionRootOf(forged.pid, { name: marker, pid: 1 })).toEqual(O.none());
      expect(yield* sessionRootOf(forged.pid, { name: marker, pid: process.pid })).toEqual(O.none());
      yield* Effect.ignore(forged.kill());
    })
  );
});
