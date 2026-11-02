import {
  ancestryChainOf,
  ancestryPidsOf,
  inotifyWatchTarget,
  invokerAncestryPids,
  ProcessAttachmentKind,
  ProcessHandleKind,
  ProcessInotifyWatch,
  ProcessTable,
  ProcessTableEntry,
  processEnvironmentValue,
  processName,
  processTableFromEntries,
  procProcessTable,
  scanProcessAttachments,
  sessionRootOf,
  superblockDeviceOf,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { A, O, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Schedule from "effect/Schedule";
import { spawnInotifyWatcher } from "./support/InotifyWatcher.ts";
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

  it.effect("finds an inotify watcher through its watch and never as a handle", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-watch-" });
      const watched = path.join(root, "watched");
      yield* fs.makeDirectory(watched);
      const resolved = yield* fs.realPath(watched);
      // The watcher stands outside the tree, so its watch is its only hold on it.
      const watcher = yield* spawnInotifyWatcher(watched, root);
      const ofWatcher = (scan: O.Option<ReadonlyArray<ProcessAttachment>>) =>
        A.filter(O.getOrThrow(scan), (attachment) => attachment.pid === watcher.pid);

      const watches = ofWatcher(yield* scanProcessAttachments({ directory: watched, kinds: ["watch"] }));
      expect(A.map(watches, (attachment) => [attachment.kind, attachment.target])).toEqual([["watch", resolved]]);

      const handles = yield* scanProcessAttachments({ directory: watched, kinds: ProcessHandleKind.literals });
      expect(ofWatcher(handles)).toEqual([]);

      // The table finds the same identity in the watcher's fdinfo, and only that one.
      const target = O.getOrThrow(yield* inotifyWatchTarget(watched));
      expect(yield* procProcessTable.watching(watcher.pid, target)).toBe(true);
      const sibling = O.getOrThrow(yield* inotifyWatchTarget(root));
      expect(yield* procProcessTable.watching(watcher.pid, sibling)).toBe(false);
      yield* Effect.ignore(watcher.kill());
    })
  );

  it.effect("names watchers only while the directory's inotify identity can be read", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "process-attachment-identity-" });
      const missing = path.join(root, "missing");
      const watched = O.getOrThrow(yield* inotifyWatchTarget(root));
      const table = processTableFromEntries({
        self: 100,
        entries: [
          ProcessTableEntry.make({ pid: 200, parent: 1, command: "fsnotifier", watches: [watched] }),
          ProcessTableEntry.make({
            pid: 300,
            parent: 1,
            command: "bun",
            watches: [ProcessInotifyWatch.make({ device: watched.device, inode: watched.inode + BigInt(1) })],
          }),
        ],
      });
      const scan = scanProcessAttachments({ directory: root, kinds: ["watch"] }).pipe(
        Effect.provideService(ProcessTable, table)
      );
      expect(A.map(O.getOrThrow(yield* scan), (attachment) => [attachment.pid, attachment.kind])).toEqual([
        [200, "watch"],
      ]);

      // Without mountinfo the directory has no inotify identity: watchers go
      // unnamed, and the scan still completes rather than withholding its result.
      const blind = FileSystem.makeNoop({
        ...fs,
        readFileString: (target, encoding) =>
          fs.readFileString(target === "/proc/self/mountinfo" ? missing : target, encoding),
      });
      expect(yield* scan.pipe(Effect.provideService(FileSystem.FileSystem, blind))).toEqual(O.some([]));
      expect(O.isNone(yield* inotifyWatchTarget(missing))).toBe(true);
    })
  );
});

describe("superblockDeviceOf", () => {
  const mountinfo = A.join(
    [
      "23 1 0:36 /@ / rw,relatime shared:1 - btrfs /dev/nvme0n1p2 rw",
      "58 23 0:33 /@home /home rw,relatime shared:28 - btrfs /dev/nvme0n1p2 rw",
      "60 58 252:1 / /home/me/data rw,relatime shared:30 - ext4 /dev/mapper/data rw",
      "61 58 0:55 / /home/me/my\\040files rw shared:31 - tmpfs tmpfs rw",
      "62 58 0:56 / /home/me/data rw shared:32 - tmpfs tmpfs rw",
      "not a mountinfo row",
    ],
    "\n"
  );

  it("takes the longest mount point covering the path, the later row winning a tie", () => {
    expect(superblockDeviceOf(mountinfo, "/home/me/repo")).toEqual(O.some(33n));
    expect(superblockDeviceOf(mountinfo, "/home")).toEqual(O.some(33n));
    expect(superblockDeviceOf(mountinfo, "/var/lib")).toEqual(O.some(36n));
    expect(superblockDeviceOf(mountinfo, "/home/me/database")).toEqual(O.some(33n));
    expect(superblockDeviceOf(mountinfo, "/home/me/data/set")).toEqual(O.some(56n));
    // A deeper mount listed before a shallower one still wins.
    const deeperFirst =
      "60 58 252:1 / /home/me/data rw - ext4 /dev/mapper/data rw\n58 23 0:33 /@home /home rw - btrfs x rw\n";
    expect(superblockDeviceOf("/home/me/data/set")(deeperFirst)).toEqual(O.some(0xfc00001n));
  });

  it("encodes the device as the kernel dev_t an fdinfo line prints and unescapes mount points", () => {
    // 252:1 is 0xfc00001: the major sits above the 20 minor bits.
    expect(superblockDeviceOf(A.join(A.take(Str.split(mountinfo, "\n"), 3), "\n"), "/home/me/data")).toEqual(
      O.some(0xfc00001n)
    );
    expect(superblockDeviceOf(mountinfo, "/home/me/my files/x")).toEqual(O.some(55n));
    expect(superblockDeviceOf("not a mountinfo row\n", "/home")).toEqual(O.none());
  });
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
// `ChildProcess.make` returns once the child is forked. Until it execs `sleep`,
// `/proc/<pid>/environ` still shows this process's environment, so a loaded
// host can read the marker before it exists. Wait for the exec (bounded at
// five seconds) before the test reads what the child was started with.
const spawnSleeperWith = Effect.fnUntraced(function* (env: Record<string, string>) {
  const fs = yield* FileSystem.FileSystem;
  const child = yield* ChildProcess.make("sleep", ["60"], {
    env,
    extendEnv: true,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  yield* fs.readFileString(`/proc/${child.pid}/comm`).pipe(
    Effect.orElseSucceed(() => ""),
    Effect.repeat({ until: (comm) => Str.trim(comm) === "sleep", schedule: Schedule.spaced("10 millis"), times: 500 })
  );
  return child;
});

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })(
  "ancestryChainOf and processEnvironmentValue",
  (it) => {
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
  }
);

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })("sessionRootOf", (it) => {
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
