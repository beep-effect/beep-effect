import {
  ancestryPidsOf,
  invokerAncestryPids,
  ProcessAttachmentKind,
  processName,
  scanProcessAttachments,
} from "@beep/repo-cli/test/RepoRun";
import { provideScopedLayer } from "@beep/test-utils";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as HashSet from "effect/HashSet";
import { ChildProcess } from "effect/unstable/process";
import type { ProcessAttachment } from "@beep/repo-cli/test/RepoRun";

const ownAttachments = (scan: O.Option<ReadonlyArray<ProcessAttachment>>): ReadonlyArray<ProcessAttachment> =>
  A.filter(O.getOrThrow(scan), (attachment) => attachment.pid === process.pid);

describe("scanProcessAttachments", () => {
  it.effect("finds the invoking process through its cwd and reports an idle directory empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const idle = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-idle-" });

      const own = ownAttachments(yield* scanProcessAttachments({ directory: process.cwd(), kinds: ["cwd"] }));
      expect(A.map(own, (attachment) => attachment.kind)).toEqual(["cwd"]);

      const idleScan = yield* scanProcessAttachments({ directory: idle, kinds: ProcessAttachmentKind.Options });
      expect(O.getOrThrow(idleScan)).toEqual([]);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
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
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );

  it.effect("withholds the result when the directory cannot be resolved", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-missing-" });
      const scan = yield* scanProcessAttachments({ directory: path.join(root, "missing"), kinds: ["cwd"] });
      expect(O.isNone(scan)).toBe(true);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer))
  );
});

const spawnSleeper = ChildProcess.make("sleep", ["60"], { stdin: "ignore", stdout: "ignore", stderr: "ignore" });

describe("ancestryPidsOf", () => {
  it.effect("walks from a child through this process, and the invoker chain excludes the child", () =>
    Effect.scoped(
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
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("names only the pid it started from when that process is gone", () =>
    Effect.gen(function* () {
      // Pids are bounded by pid_max, so this one cannot be running.
      const ancestry = yield* ancestryPidsOf(2 ** 31);
      expect(HashSet.size(ancestry)).toBe(1);
      expect(HashSet.has(ancestry, 2 ** 31)).toBe(true);
    }).pipe(provideScopedLayer(NodeServices.layer))
  );
});

describe("processName", () => {
  it.effect("reads a running process's command name and forgets one that is gone", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const child = yield* spawnSleeper;
        const named = yield* processName(child.pid).pipe(Effect.ensuring(Effect.ignore(child.kill())));
        expect(named).toEqual(O.some("sleep"));
        expect(yield* processName(2 ** 31)).toEqual(O.none());
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
