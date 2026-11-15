/**
 * Same-uid `/proc` attachment scan shared by directory-retirement fences.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as BI from "effect/BigInt";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProcessInotifyWatch, ProcessPid, ProcessStatus, ProcessTable, processLineage } from "./ProcessTable.ts";
import type { ProcessTableShape } from "./ProcessTable.ts";

const $I = $RepoCliId.create("internal/repo-run/ProcessAttachment");

const PID_SCAN_CONCURRENCY = 8;

/**
 * The attachment kinds that give a process a handle it could write through.
 *
 * **Details**
 *
 * A working directory resolves relative paths into the tree and an open
 * descriptor reaches it directly (a directory descriptor through `openat`),
 * so either one lets a process write there. A scan that must prove nothing
 * can still write into a tree reads exactly these kinds.
 *
 * **Example** (List the handle kinds)
 *
 * ```ts
 * import { ProcessHandleKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProcessHandleKind.literals) // [ 'cwd', 'descriptor' ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessHandleKind = LiteralKit(["cwd", "descriptor"]).pipe(
  $I.annoteSchema("ProcessHandleKind", {
    description:
      "Link family under /proc/<pid> that hands a process a writable way into a path: its cwd or an open descriptor.",
  })
);

/**
 * Handle attachment kind type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProcessHandleKind = typeof ProcessHandleKind.Type;

/**
 * How a process holds a path inside a scanned directory.
 *
 * **Details**
 *
 * `cwd` and `descriptor` are handles ({@link ProcessHandleKind}). `watch` is
 * an inotify watch on the scanned directory itself, read from the fdinfo of
 * the process's inotify descriptors: a subscription to events that nothing
 * can be written through.
 *
 * **Example** (Recognize a descriptor attachment)
 *
 * ```ts
 * import { ProcessAttachmentKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProcessAttachmentKind.is.descriptor("descriptor")) // true
 * console.log(ProcessAttachmentKind.is.watch("watch")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessAttachmentKind = LiteralKit([...ProcessHandleKind.literals, "watch"]).pipe(
  $I.annoteSchema("ProcessAttachmentKind", {
    description:
      "Link family under /proc/<pid> through which a process holds a path: its cwd, an open descriptor, or an inotify watch.",
  })
);

/**
 * Attachment kind recognized by the `/proc` scan.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProcessAttachmentKind = typeof ProcessAttachmentKind.Type;

/**
 * One same-uid process holding a path inside a scanned directory.
 *
 * **Example** (Construct an attachment)
 *
 * ```ts
 * import { ProcessAttachment } from "@beep/repo-cli/test/RepoRun"
 *
 * const attachment = ProcessAttachment.make({ pid: 4242, kind: "cwd", target: "/work/checkout" })
 * console.log(attachment.kind) // "cwd"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessAttachment extends S.Opaque<ProcessAttachment, { readonly brand: unique symbol }>()(
  S.Struct({
    pid: ProcessPid,
    kind: ProcessAttachmentKind,
    target: S.String,
  }).pipe(
    $I.annoteSchema("ProcessAttachment", {
      description: "A process id, the /proc link family it was found through, and the resolved path it holds.",
    })
  )
) {}

// Internal call-argument shape (never decoded or serialized), so it stays a private
// type alias like the other repo-run request shapes rather than an exported schema.
type ProcessAttachmentScan = {
  readonly directory: string;
  readonly kinds: ReadonlyArray<ProcessAttachmentKind>;
};

// What one scan compares every process against: the resolved directory, a
// path test for the handle kinds, and the inotify identity of the directory
// itself for `watch` (`None` when it could not be read).
type ProcessAttachmentProbe = {
  readonly root: string;
  readonly within: (candidate: string) => boolean;
  readonly watched: O.Option<ProcessInotifyWatch>;
};

const isPathWithin =
  (root: string) =>
  (candidate: string): boolean =>
    Str.Equivalence(candidate, root) || Str.startsWith(`${root}/`)(candidate);

// A mount point covers itself and everything below it; `/` covers every path.
const isMountedUnder =
  (path: string) =>
  (mountPoint: string): boolean =>
    mountPoint === "/" || isPathWithin(mountPoint)(path);

// `/proc/self/mountinfo` fields: mount id, parent id, `major:minor` of the
// superblock, root within it, and the mount point, which escapes space, tab,
// newline, and backslash as three-digit octal (the backslash goes last, so an
// escaped backslash never starts another escape).
const MOUNTINFO_LINE = /^\d+ \d+ (\d+):(\d+) \S+ (\S+)/u;
const KERNEL_MINOR_BITS = BigInt(20);

const unescapeMountPoint = flow(
  Str.replaceAll("\\040", " "),
  Str.replaceAll("\\011", "\t"),
  Str.replaceAll("\\012", "\n"),
  Str.replaceAll("\\134", "\\")
);

type MountRow = { readonly mountPoint: string; readonly device: bigint };

const parseMountRow = (line: string): O.Option<MountRow> =>
  O.flatMap(O.fromNullishOr(MOUNTINFO_LINE.exec(line)), (match) =>
    O.map(
      O.all({
        major: O.flatMap(O.fromNullishOr(match[1]), BI.fromString),
        minor: O.flatMap(O.fromNullishOr(match[2]), BI.fromString),
        mountPoint: O.map(O.fromNullishOr(match[3]), unescapeMountPoint),
      }),
      ({ major, minor, mountPoint }) => ({ mountPoint, device: (major << KERNEL_MINOR_BITS) | minor })
    )
  );

/**
 * The superblock device a path lives on, read from a `/proc/self/mountinfo` document.
 *
 * **Details**
 *
 * The path is matched to the mount with the longest mount point covering it,
 * the later row winning a tie because a later mount over the same point
 * shadows the earlier one. The device is returned as the kernel `dev_t`
 * (`major << 20 | minor`), the encoding an inotify fdinfo line prints as
 * `sdev:`. `stat`'s `st_dev` would not do: a btrfs subvolume reports its own
 * anonymous device there, while the watch carries the filesystem's. `None`
 * when no row covers the path.
 *
 * **Example** (Find the device under a home directory)
 *
 * ```ts
 * import { superblockDeviceOf } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * const mountinfo = "23 1 0:36 /@ / rw - btrfs /dev/nvme0n1p2 rw\n58 23 0:33 /@home /home rw - btrfs /dev/nvme0n1p2 rw\n"
 * console.log(O.getOrUndefined(superblockDeviceOf(mountinfo, "/home/me/repo"))) // 33n
 * console.log(O.getOrUndefined(superblockDeviceOf("/var/lib")(mountinfo))) // 36n
 * ```
 *
 * @param mountinfo - The mountinfo document content; the data-last form takes it alone.
 * @param path - An absolute, fully resolved path.
 * @returns The kernel device of the covering mount, or `None`.
 * @category utilities
 * @since 0.0.0
 */
export const superblockDeviceOf: {
  (mountinfo: string, path: string): O.Option<bigint>;
  (path: string): (mountinfo: string) => O.Option<bigint>;
} = dual(
  2,
  (mountinfo: string, path: string): O.Option<bigint> =>
    pipe(
      A.getSomes(A.map(Str.split(mountinfo, "\n"), parseMountRow)),
      A.filter((row) => isMountedUnder(path)(row.mountPoint)),
      A.reduce(O.none<MountRow>(), (best, row) =>
        O.exists(best, (current) => Str.length(current.mountPoint) > Str.length(row.mountPoint)) ? best : O.some(row)
      ),
      O.map((row) => row.device)
    )
);

/**
 * The inotify identity of a directory: the watch an fdinfo line would print for it.
 *
 * **Details**
 *
 * The inode comes from `stat` of the resolved directory and the device from
 * {@link superblockDeviceOf} over `/proc/self/mountinfo`. `None` when either
 * cannot be read.
 *
 * **Example** (Build the identity effect)
 *
 * ```ts
 * import { inotifyWatchTarget } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(inotifyWatchTarget(process.cwd()))) // true
 * ```
 *
 * @param directory - The directory to identify.
 * @returns The device and inode a watch on it carries, or `None`.
 * @category utilities
 * @since 0.0.0
 */
export const inotifyWatchTarget = Effect.fnUntraced(function* (
  directory: string
): Effect.fn.Return<O.Option<ProcessInotifyWatch>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const resolved = yield* fs.realPath(directory).pipe(Effect.option);
  if (O.isNone(resolved)) {
    return O.none();
  }
  const info = yield* fs.stat(resolved.value).pipe(Effect.option);
  const mountinfo = yield* fs.readFileString("/proc/self/mountinfo").pipe(Effect.option);
  return O.map(
    O.all({
      inode: O.flatMap(info, (stat) => stat.ino),
      device: O.flatMap(mountinfo, superblockDeviceOf(resolved.value)),
    }),
    ProcessInotifyWatch.make
  );
});

const attachmentWithin =
  (pid: number, kind: ProcessAttachmentKind, within: (candidate: string) => boolean) =>
  (target: string): O.Option<ProcessAttachment> =>
    O.map(O.liftPredicate(target, within), (held) => ProcessAttachment.make({ pid, kind, target: held }));

const cwdAttachments = Effect.fnUntraced(function* (
  table: ProcessTableShape,
  pid: number,
  probe: ProcessAttachmentProbe
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  const cwd = yield* table.cwd(pid);
  return A.fromOption(O.flatMap(cwd, attachmentWithin(pid, "cwd", probe.within)));
});

const descriptorAttachments = Effect.fnUntraced(function* (
  table: ProcessTableShape,
  pid: number,
  probe: ProcessAttachmentProbe
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  const targets = yield* table.descriptors(pid);
  return A.getSomes(A.map(targets, attachmentWithin(pid, "descriptor", probe.within)));
});

const watchAttachments = Effect.fnUntraced(function* (
  table: ProcessTableShape,
  pid: number,
  probe: ProcessAttachmentProbe
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  if (O.isNone(probe.watched)) {
    return A.empty();
  }
  return (yield* table.watching(pid, probe.watched.value))
    ? A.of(ProcessAttachment.make({ pid, kind: "watch", target: probe.root }))
    : A.empty();
});

const pidAttachments = (
  table: ProcessTableShape,
  pid: number,
  probe: ProcessAttachmentProbe,
  kinds: ReadonlyArray<ProcessAttachmentKind>
): Effect.Effect<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> =>
  Effect.forEach(
    kinds,
    (kind) =>
      Match.value(kind).pipe(
        Match.when("cwd", () => cwdAttachments(table, pid, probe)),
        Match.when("descriptor", () => descriptorAttachments(table, pid, probe)),
        Match.when("watch", () => watchAttachments(table, pid, probe)),
        Match.exhaustive
      ),
    { concurrency: 1 }
  ).pipe(Effect.map(A.flatten));

/**
 * Enumerate the same-uid processes attached to a directory tree through `/proc`.
 *
 * **Details**
 *
 * The directory is resolved through realPath before comparison because the
 * kernel fully resolves `/proc` link targets, so a symlinked ancestor would
 * otherwise hide every attachment. Unreadable pids are dropped, never treated
 * as attached: every host permanently carries pids whose links are unreadable
 * by construction — foreign uids and this user's own ptrace-protected
 * processes (systemd --user, sd-pam, the compositor, gpg-agent, every
 * 1Password op) — so a fail-closed rule for them would wedge every scan and
 * make retirement unreachable. The guarded population (this user's agent
 * processes) is dumpable and observable, and the one protected kind that
 * plausibly occupies a checkout, an op-run wrapper, spawns dumpable children
 * that expose the same cwd. Only a failure to list `/proc` or to resolve the
 * directory withholds the result. Reading descriptors visits every
 * `/proc/<pid>/fd` link, which is the thorough form a destructive step wants;
 * a cwd-only scan is the cheap form a liveness probe repeats per candidate.
 * A `watch` scan reports a process whose inotify watches include the
 * directory itself (matched by {@link inotifyWatchTarget}; a watch on a
 * subdirectory alone is not reported). It names watchers rather than
 * proving anything, so a directory whose inotify identity cannot be read
 * yields no watch attachments instead of withholding the result.
 * The table is read through the `ProcessTable` reference, so a test can
 * substitute a scripted one.
 *
 * **Example** (Find the invoking process through its cwd)
 *
 * ```ts
 * import { scanProcessAttachments } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect"
 *
 * const scan = scanProcessAttachments({ directory: process.cwd(), kinds: ["cwd"] })
 * console.log(Effect.isEffect(scan)) // true
 * ```
 *
 * @param request - Directory tree to inspect and the `/proc` link families to read.
 * @returns Every attachment found, or `None` when the scan could not be completed.
 * @category utilities
 * @since 0.0.0
 */
export const scanProcessAttachments = Effect.fnUntraced(function* (
  request: ProcessAttachmentScan
): Effect.fn.Return<O.Option<ReadonlyArray<ProcessAttachment>>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const table = yield* ProcessTable;
  const pids = yield* table.pids;
  const resolved = yield* fs.realPath(request.directory).pipe(Effect.option);
  if (O.isNone(pids) || O.isNone(resolved)) {
    return O.none();
  }
  const watched = A.contains(request.kinds, "watch")
    ? yield* inotifyWatchTarget(resolved.value)
    : O.none<ProcessInotifyWatch>();
  const probe: ProcessAttachmentProbe = { root: resolved.value, within: isPathWithin(resolved.value), watched };
  const attachments = yield* Effect.forEach(pids.value, (pid) => pidAttachments(table, pid, probe, request.kinds), {
    concurrency: PID_SCAN_CONCURRENCY,
  });
  return O.some(A.flatten(attachments));
});

const PARENT_PID_LINE = /^PPid:\s*(\d+)\s*$/mu;

// The walk ends at init, whose parent is 0; a shared thunk, not a lambda per call.
const noParent = constant(0);

const parentPidOf = (status: string): O.Option<number> =>
  O.flatMap(O.fromNullishOr(PARENT_PID_LINE.exec(status)), (match) => O.flatMap(O.fromNullishOr(match[1]), N.parse));

/**
 * One process and every ancestor up to init, nearest first, read from `/proc`.
 *
 * **Details**
 *
 * The walk reads `PPid:` from each `/proc/<pid>/status` in turn and always
 * starts with the pid it was given. A status file that cannot be read ends
 * it early, so the chain names fewer processes, never more.
 *
 * **Example** (Build the chain effect for a pid)
 *
 * ```ts
 * import { ancestryChainOf } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(ancestryChainOf(process.pid))) // true
 * ```
 *
 * @param pid - The process whose ancestry is walked.
 * @returns That process followed by its ancestors, parent before grandparent.
 * @category utilities
 * @since 0.0.0
 */
export const ancestryChainOf = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<ReadonlyArray<number>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  // Read the real kernel ancestry for marker proofs even when attachment scans
  // use a scripted table. An unreadable status retains the current pid and stops.
  const chain = yield* processLineage(pid, (current) =>
    fs.readFileString(`/proc/${current}/status`).pipe(
      Effect.option,
      Effect.map((status) =>
        O.some(
          ProcessStatus.make({
            pid: current,
            parent: O.getOrElse(O.flatMap(status, parentPidOf), noParent),
            command: "",
          })
        )
      )
    )
  );
  return A.map(chain, (status) => status.pid);
});

/**
 * The pids of one process and every ancestor up to init, read from `/proc`.
 *
 * **Details**
 *
 * The unordered form of `ancestryChainOf`, for membership questions: the
 * retirement fence asks which processes form the invoker's own chain
 * (`invokerAncestryPids`) and whether a holder descends from the session
 * process a request proved.
 *
 * **Example** (Build the ancestry effect for a pid)
 *
 * ```ts
 * import { ancestryPidsOf } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(ancestryPidsOf(process.pid))) // true
 * ```
 *
 * @param pid - The process whose ancestry is walked.
 * @returns The pid set of that process and its ancestors.
 * @category utilities
 * @since 0.0.0
 */
export const ancestryPidsOf = (pid: number): Effect.Effect<HashSet.HashSet<number>, never, FileSystem.FileSystem> =>
  Effect.map(ancestryChainOf(pid), HashSet.fromIterable);

/**
 * The pids of this process and every ancestor up to init, read from `/proc`.
 *
 * **Details**
 *
 * A retirement started from inside a lane has the invoking CLI, its shell,
 * and the agent session above them all holding that lane as their cwd. They
 * are the party asking for the removal, not writers whose later output the
 * archive could lose, so the quiescence fence exempts this chain outright.
 * Widening it to a session's whole subtree is a separate, proven step:
 * `sessionRootOf` accepts the named pid only when the entry immediately before
 * it in this nearest-first chain (toward index 0 and the invoker) was started
 * carrying the harness marker, so membership in
 * this set alone (init is always a member) never names a session.
 *
 * **Example** (Build the ancestry effect)
 *
 * ```ts
 * import { invokerAncestryPids } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(invokerAncestryPids())) // true
 * ```
 *
 * @returns The pid set of the current process and its ancestors.
 * @category utilities
 * @since 0.0.0
 */
export const invokerAncestryPids = Effect.fnUntraced(function* (): Effect.fn.Return<
  HashSet.HashSet<number>,
  never,
  FileSystem.FileSystem
> {
  return yield* ancestryPidsOf(process.pid);
});

/**
 * The command name a running process reports through `/proc/<pid>/comm`.
 *
 * **Details**
 *
 * The kernel keeps at most 15 bytes of it, so it names the executable family
 * (`zsh`, `bunx`, `node`), which is enough to tell an operator which holder
 * of a lane to close or move. `None` when the entry cannot be read: the
 * process exited, or it belongs to a uid the caller may not inspect.
 *
 * **Example** (Read this process's own name)
 *
 * ```ts
 * import { processName } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(processName(process.pid))) // true
 * ```
 *
 * @param pid - The process to name.
 * @returns The trimmed command name, or `None` when it cannot be read.
 * @category utilities
 * @since 0.0.0
 */
export const processName = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const comm = yield* fs.readFileString(`/proc/${pid}/comm`).pipe(Effect.option);
  return O.filter(O.map(comm, Str.trim), Str.isNonEmpty);
});

/**
 * One variable from a running process's initial environment, read from `/proc/<pid>/environ`.
 *
 * **Details**
 *
 * The kernel keeps the environment a process was started with, NUL-separated,
 * so this reads what its parent exported to it, not what the process later
 * changed. `None` when the entry cannot be read (the process exited, or it
 * belongs to a uid the caller may not inspect) or the variable is absent.
 *
 * **Example** (Read this process's own HOME)
 *
 * ```ts
 * import { processEnvironmentValue } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(processEnvironmentValue(process.pid, "HOME"))) // true
 * ```
 *
 * @param pid - The process whose initial environment is read.
 * @param name - The variable to look up.
 * @returns The variable's value, or `None`.
 * @category utilities
 * @since 0.0.0
 */
export const processEnvironmentValue = Effect.fnUntraced(function* (
  pid: number,
  name: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const environ = yield* fs.readFileString(`/proc/${pid}/environ`).pipe(Effect.option);
  const prefix = `${name}=`;
  return O.flatMap(environ, (text) =>
    O.map(A.findFirst(Str.split(text, "\0"), Str.startsWith(prefix)), (entry) => Str.slice(prefix.length)(entry))
  );
});

/**
 * The session process an invoker runs under, proven by the marker that session exported.
 *
 * **Details**
 *
 * An agent harness that spawns tool shells exports its own pid to them under
 * a fixed variable (Claude Code: `CLAUDE_PID`). The genuine session is
 * therefore the parent of the invoker ancestor that still carries
 * `<name>=<pid>` in its initial environment. That rules out every other pid
 * the variable could name: init and the desktop host are ancestors too, but
 * no process on the invoker's path was started by them with that marker, and
 * a pid copied from another shell is not on the path at all. `None` in each
 * of those cases, and when the marker names the invoker itself.
 *
 * **Example** (Build the proof effect)
 *
 * ```ts
 * import { sessionRootOf } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * console.log(Effect.isEffect(sessionRootOf(process.pid, { name: "CLAUDE_PID", pid: 1 }))) // true
 * ```
 *
 * @param invoker - The process asking, usually this one.
 * @param marker - The variable the harness exports and the pid it claims to name.
 * @returns The proven session pid, or `None`.
 * @category utilities
 * @since 0.0.0
 */
export const sessionRootOf = Effect.fnUntraced(function* (
  invoker: number,
  marker: { readonly name: string; readonly pid: number }
): Effect.fn.Return<O.Option<number>, never, FileSystem.FileSystem> {
  const chain = yield* ancestryChainOf(invoker);
  const index = A.findFirstIndex(chain, (pid) => pid === marker.pid);
  // The chain is nearest-first: the entry before the session, toward index 0
  // and the invoker, is its child. Only that child's environment proves the claim.
  const child = O.flatMap(index, (at) => A.get(chain, at - 1));
  if (O.isNone(child)) {
    return O.none();
  }
  const exported = yield* processEnvironmentValue(child.value, marker.name);
  return O.exists(exported, (value) => value === String(marker.pid)) ? O.some(marker.pid) : O.none();
});
