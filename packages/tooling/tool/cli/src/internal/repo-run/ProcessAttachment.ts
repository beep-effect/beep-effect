/**
 * Same-uid `/proc` attachment scan shared by directory-retirement fences.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Effect, FileSystem, Match } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ProcessPid, ProcessTable } from "./ProcessTable.ts";
import type { ProcessTableShape } from "./ProcessTable.ts";

const $I = $RepoCliId.create("internal/repo-run/ProcessAttachment");

const PID_SCAN_CONCURRENCY = 8;

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

const attachmentWithin =
  (pid: number, kind: ProcessAttachmentKind, within: (candidate: string) => boolean) =>
  (target: string): O.Option<ProcessAttachment> =>
    O.map(O.liftPredicate(target, within), (held) => ProcessAttachment.make({ pid, kind, target: held }));

const cwdAttachments = Effect.fnUntraced(function* (
  table: ProcessTableShape,
  pid: number,
  within: (candidate: string) => boolean
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  const cwd = yield* table.cwd(pid);
  return A.fromOption(O.flatMap(cwd, attachmentWithin(pid, "cwd", within)));
});

const descriptorAttachments = Effect.fnUntraced(function* (
  table: ProcessTableShape,
  pid: number,
  within: (candidate: string) => boolean
): Effect.fn.Return<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> {
  const targets = yield* table.descriptors(pid);
  return A.getSomes(A.map(targets, attachmentWithin(pid, "descriptor", within)));
});

const pidAttachments = (
  table: ProcessTableShape,
  pid: number,
  within: (candidate: string) => boolean,
  kinds: ReadonlyArray<ProcessAttachmentKind>
): Effect.Effect<ReadonlyArray<ProcessAttachment>, never, FileSystem.FileSystem> =>
  Effect.forEach(kinds, (kind) =>
    Match.value(kind).pipe(
      Match.when("cwd", () => cwdAttachments(table, pid, within)),
      Match.when("descriptor", () => descriptorAttachments(table, pid, within)),
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
  const within = isPathWithin(resolved.value);
  const attachments = yield* Effect.forEach(pids.value, (pid) => pidAttachments(table, pid, within, request.kinds), {
    concurrency: PID_SCAN_CONCURRENCY,
  });
  return O.some(A.flatten(attachments));
});
