/**
 * Same-uid `/proc` attachment scan shared by directory-retirement fences.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Match, pipe } from "effect";
import * as A from "effect/Array";
import { constant } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as MutableHashSet from "effect/MutableHashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/repo-run/ProcessAttachment");

const PID_DIRECTORY_NAME = /^[0-9]+$/u;
const PID_SCAN_CONCURRENCY = 8;
const LINK_SCAN_CONCURRENCY = 16;

/**
 * How a process holds a path inside a scanned directory.
 *
 * **Example** (Recognize a descriptor attachment)
 *
 * ```ts
 * import { ProcessAttachmentKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProcessAttachmentKind.is.descriptor("descriptor")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessAttachmentKind = LiteralKit(["cwd", "descriptor"]).pipe(
  $I.annoteSchema("ProcessAttachmentKind", {
    description: "Link family under /proc/<pid> through which a process holds a path: its cwd or an open descriptor.",
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
 * Numeric `/proc` entry name of a running process.
 *
 * **Example** (Recognize a pid)
 *
 * ```ts
 * import { ProcessPid } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProcessPid)(4242)) // true
 * console.log(S.is(ProcessPid)(0)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessPid = S.Int.check(S.isGreaterThan(0)).pipe(
  $I.annoteSchema("ProcessPid", {
    description: "Numeric /proc entry name of a running process.",
  })
);

/**
 * Pid accepted by the `/proc` scans.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProcessPid = typeof ProcessPid.Type;

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
export class ProcessAttachment extends S.Class<ProcessAttachment>($I`ProcessAttachment`)(
  {
    pid: ProcessPid,
    kind: ProcessAttachmentKind,
    target: S.String,
  },
  $I.annote("ProcessAttachment", {
    description: "A process id, the /proc link family it was found through, and the resolved path it holds.",
  })
) {}

// Internal call-argument shape (never decoded or serialized), so it stays a private
// type alias like the other repo-run request shapes rather than an exported schema.
type ProcessAttachmentScan = {
  readonly directory: string;
  readonly kinds: ReadonlyArray<ProcessAttachmentKind>;
};

const isPathWithin =
  (root: string) =>
  (candidate: string): boolean =>
    Str.Equivalence(candidate, root) || Str.startsWith(`${root}/`)(candidate);

const readLinkTarget = Effect.fnUntraced(function* (
  link: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readLink(link).pipe(Effect.option);
});

const attachmentWithin =
  (pid: number, kind: ProcessAttachmentKind, within: (candidate: string) => boolean) =>
  (target: O.Option<string>): O.Option<ProcessAttachment> =>
    pipe(
      target,
      O.filter(within),
      O.map((held) => ProcessAttachment.make({ pid, kind, target: held }))
    );

const cwdAttachments = Effect.fnUntraced(function* (
  pid: number,
  within: (candidate: string) => boolean
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  const cwd = yield* readLinkTarget(`/proc/${pid}/cwd`);
  return cwd.pipe(attachmentWithin(pid, "cwd", within), A.fromOption);
});

const descriptorAttachments = Effect.fnUntraced(function* (
  pid: number,
  within: (candidate: string) => boolean
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs.readDirectory(`/proc/${pid}/fd`).pipe(Effect.option);
  if (O.isNone(names)) {
    return A.empty();
  }
  const targets = yield* Effect.forEach(names.value, (name) => readLinkTarget(`/proc/${pid}/fd/${name}`), {
    concurrency: LINK_SCAN_CONCURRENCY,
  });
  return A.getSomes(A.map(targets, attachmentWithin(pid, "descriptor", within)));
});

const pidAttachments = (
  pid: number,
  within: (candidate: string) => boolean,
  kinds: ReadonlyArray<ProcessAttachmentKind>
): Effect.Effect<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> =>
  Effect.forEach(kinds, (kind) =>
    Match.value(kind).pipe(
      Match.when("cwd", () => cwdAttachments(pid, within)),
      Match.when("descriptor", () => descriptorAttachments(pid, within)),
      Match.exhaustive
    )
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
  const names = yield* fs.readDirectory("/proc").pipe(Effect.option);
  const resolved = yield* fs.realPath(request.directory).pipe(Effect.option);
  if (O.isNone(names) || O.isNone(resolved)) {
    return O.none();
  }
  const within = isPathWithin(resolved.value);
  const pids = pipe(
    names.value,
    A.filter((name) => PID_DIRECTORY_NAME.test(name)),
    A.map(N.parse),
    A.getSomes
  );
  const attachments = yield* Effect.forEach(pids, (pid) => pidAttachments(pid, within, request.kinds), {
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
 * import { Effect } from "effect"
 *
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
  const seen = MutableHashSet.empty<number>();
  let chain: ReadonlyArray<number> = A.empty();
  let current = pid;
  while (current > 0 && !MutableHashSet.has(seen, current)) {
    MutableHashSet.add(seen, current);
    chain = A.append(chain, current);
    const status = yield* fs.readFileString(`/proc/${current}/status`).pipe(Effect.option);
    current = O.getOrElse(O.flatMap(status, parentPidOf), noParent);
  }
  return chain;
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
 * import { Effect } from "effect"
 *
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
 * `sessionRootOf` accepts the named pid only when the ancestor directly below
 * it on this chain was started carrying the harness marker, so membership in
 * this set alone (init is always a member) never names a session.
 *
 * **Example** (Build the ancestry effect)
 *
 * ```ts
 * import { invokerAncestryPids } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
 * import { Effect } from "effect"
 *
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
  // The process one step below the session on the invoker's path is the one
  // the session started; only its environment can prove the claim.
  const child = O.flatMap(index, (at) => A.get(chain, at - 1));
  if (O.isNone(child)) {
    return O.none();
  }
  const exported = yield* processEnvironmentValue(child.value, marker.name);
  return O.exists(exported, (value) => value === String(marker.pid)) ? O.some(marker.pid) : O.none();
});
