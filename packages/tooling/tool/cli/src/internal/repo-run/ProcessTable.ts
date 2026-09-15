/**
 * The same-uid `/proc` process table behind directory-retirement fences, as an
 * injectable seam: pids, the paths each holds, and each one's parent and
 * command name, so a fence can tell the invoking session's own processes from
 * an unrelated holder and a test can express both with a fake table.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Context, Effect, FileSystem, pipe } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("internal/repo-run/ProcessTable");

const PID_DIRECTORY_NAME = /^[0-9]+$/u;
const LINK_SCAN_CONCURRENCY = 16;
const STATUS_NAME_LINE = /^Name:\s*(.*?)\s*$/mu;
const STATUS_PARENT_LINE = /^PPid:\s*(\d+)\s*$/mu;
const INIT_PID = 1;

/**
 * A running process id as `/proc` names it.
 *
 * **Example** (Validate a pid)
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
 * Process id type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProcessPid = typeof ProcessPid.Type;

const ProcessParentPid = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ProcessParentPid", {
    description: "Parent pid as /proc reports it; init reports 0 because it has no parent.",
  })
);

/**
 * What `/proc/<pid>/status` says about one process: its parent and command name.
 *
 * **Example** (Construct a status row)
 *
 * ```ts
 * import { ProcessStatus } from "@beep/repo-cli/test/RepoRun"
 *
 * const status = ProcessStatus.make({ pid: 70, parent: 60, command: "zsh" })
 * console.log(status.command) // "zsh"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessStatus extends S.Class<ProcessStatus>($I`ProcessStatus`)(
  {
    pid: ProcessPid,
    parent: ProcessParentPid,
    command: S.String,
  },
  $I.annote("ProcessStatus", {
    description: "A process id with the parent pid and command name its /proc status file reports.",
  })
) {}

/**
 * Parse the parent pid and command name out of a `/proc/<pid>/status` document.
 *
 * **Details**
 *
 * The `Name:` line carries the kernel's `comm` value (the executable name,
 * truncated to fifteen characters) and the `PPid:` line the parent pid. A
 * document missing either line yields `None`.
 *
 * **Example** (Parse a status document)
 *
 * ```ts
 * import { parseProcessStatus } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * const status = parseProcessStatus("Name:\tzsh\nState:\tS (sleeping)\nPPid:\t60\n", 70)
 * console.log(O.map(status, (value) => [value.parent, value.command])) // { _id: 'Option', _tag: 'Some', value: [ 60, 'zsh' ] }
 * console.log(O.isNone(parseProcessStatus(70)("State:\tS (sleeping)\n"))) // true
 * ```
 *
 * @param text - The status document content; the data-last form takes it alone.
 * @param pid - The process the document describes.
 * @returns The parsed status, or `None` when a required line is absent.
 * @category utilities
 * @since 0.0.0
 */
export const parseProcessStatus: {
  (text: string, pid: number): O.Option<ProcessStatus>;
  (pid: number): (text: string) => O.Option<ProcessStatus>;
} = dual(
  2,
  (text: string, pid: number): O.Option<ProcessStatus> =>
    O.all({
      command: O.flatMap(O.fromNullishOr(STATUS_NAME_LINE.exec(text)), (match) => O.fromNullishOr(match[1])),
      parent: O.flatMap(O.fromNullishOr(STATUS_PARENT_LINE.exec(text)), (match) =>
        O.flatMap(O.fromNullishOr(match[1]), N.parse)
      ),
    }).pipe(O.map(({ command, parent }) => ProcessStatus.make({ pid, parent, command })))
);

/**
 * How a process table answers the questions a retirement fence asks of `/proc`.
 *
 * **Details**
 *
 * `pids` lists every process the table knows, or `None` when the table could
 * not be listed at all. `cwd` and `descriptors` return the fully resolved
 * paths a process holds through those link families; an unreadable process
 * answers empty, never as attached. `status` reads a process's parent and
 * command name, `None` when the process cannot be read. `self` is the pid of
 * the process asking.
 *
 * @category models
 * @since 0.0.0
 */
export interface ProcessTableShape {
  /** The resolved working directory of a process, when readable. */
  readonly cwd: (pid: number) => Effect.Effect<O.Option<string>, never, FileSystem.FileSystem>;
  /** The resolved targets of a process's open descriptors, empty when unreadable. */
  readonly descriptors: (pid: number) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem>;
  /** Every listed pid, or `None` when the table cannot be listed. */
  readonly pids: Effect.Effect<O.Option<ReadonlyArray<number>>, never, FileSystem.FileSystem>;
  /** The pid of the process consulting the table. */
  readonly self: number;
  /** The parent pid and command name of a process, when readable. */
  readonly status: (pid: number) => Effect.Effect<O.Option<ProcessStatus>, never, FileSystem.FileSystem>;
}

const readLinkTarget = Effect.fnUntraced(function* (
  link: string
): Effect.fn.Return<O.Option<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.readLink(link).pipe(Effect.option);
});

const listProcPids = Effect.fnUntraced(function* (): Effect.fn.Return<
  O.Option<ReadonlyArray<number>>,
  never,
  FileSystem.FileSystem
> {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs.readDirectory("/proc").pipe(Effect.option);
  return O.map(names, (listed) =>
    pipe(
      listed,
      A.filter((name) => PID_DIRECTORY_NAME.test(name)),
      A.map(N.parse),
      A.getSomes
    )
  );
});

const readProcDescriptors = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<ReadonlyArray<string>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const names = yield* fs.readDirectory(`/proc/${pid}/fd`).pipe(Effect.option);
  if (O.isNone(names)) {
    return A.empty();
  }
  const targets = yield* Effect.forEach(names.value, (name) => readLinkTarget(`/proc/${pid}/fd/${name}`), {
    concurrency: LINK_SCAN_CONCURRENCY,
  });
  return A.getSomes(targets);
});

const readProcStatus = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<ProcessStatus>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`/proc/${pid}/status`).pipe(Effect.option);
  return O.flatMap(text, parseProcessStatus(pid));
});

/**
 * The live process table, read from `/proc` through the ambient file system.
 *
 * **Example** (Read the invoking pid)
 *
 * ```ts
 * import { procProcessTable } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(procProcessTable.self === process.pid) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const procProcessTable: ProcessTableShape = {
  self: process.pid,
  pids: listProcPids(),
  cwd: (pid) => readLinkTarget(`/proc/${pid}/cwd`),
  descriptors: readProcDescriptors,
  status: readProcStatus,
};

/**
 * The process table a fence consults, injectable so tests can describe a process tree.
 *
 * **Details**
 *
 * The default is the live `/proc` table. A test provides a fake through
 * `Effect.provideService(ProcessTable, table)` to express a holder that runs
 * under the invoking session versus one that belongs to another session,
 * without spawning either.
 *
 * **Example** (Read the reference key)
 *
 * ```ts
 * import { ProcessTable } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof ProcessTable.key) // "string"
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const ProcessTable: Context.Reference<ProcessTableShape> = Context.Reference($I`ProcessTable`, {
  defaultValue: () => procProcessTable,
});

/**
 * One row of a fake process table: lineage plus the paths the process holds.
 *
 * **Example** (Describe a shell standing in a lane)
 *
 * ```ts
 * import { ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 *
 * const shell = ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh", cwd: "/repo/.claude/worktrees/lane" })
 * console.log(shell.cwd) // "/repo/.claude/worktrees/lane"
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export class ProcessTableEntry extends S.Class<ProcessTableEntry>($I`ProcessTableEntry`)(
  {
    pid: ProcessPid,
    parent: ProcessParentPid,
    command: S.String,
    cwd: S.optionalKey(S.String),
    descriptors: S.Array(S.String).pipe(S.optionalKey),
  },
  $I.annote("ProcessTableEntry", {
    description: "A fake process-table row: pid, parent, command name, and the resolved paths it holds.",
  })
) {}

const entryIndex = (entries: ReadonlyArray<ProcessTableEntry>): HashMap.HashMap<number, ProcessTableEntry> =>
  HashMap.fromIterable(A.map(entries, (entry) => [entry.pid, entry] as const));

const entryStatus = (entry: ProcessTableEntry): ProcessStatus =>
  ProcessStatus.make({ pid: entry.pid, parent: entry.parent, command: entry.command });

/**
 * A fully fake process table built from rows.
 *
 * **Details**
 *
 * Attachments and lineage both come from the rows; a pid with no row is
 * unreadable. This is the pure form for exercising the lineage rules.
 *
 * **Example** (Build a two-process table)
 *
 * ```ts
 * import { processTableFromEntries, ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 *
 * const table = processTableFromEntries({
 *   self: 70,
 *   entries: [
 *     ProcessTableEntry.make({ pid: 60, parent: 1, command: "claude" }),
 *     ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh" }),
 *   ],
 * })
 * console.log(table.self) // 70
 * ```
 *
 * @param table - The pid the table reports as the process consulting it, and its rows.
 * @returns A process table answering only from the rows.
 * @category testing
 * @since 0.0.0
 */
export const processTableFromEntries = ({
  entries,
  self,
}: {
  readonly self: number;
  readonly entries: ReadonlyArray<ProcessTableEntry>;
}): ProcessTableShape => {
  const index = entryIndex(entries);
  const lookup = (pid: number): O.Option<ProcessTableEntry> => HashMap.get(index, pid);
  return {
    self,
    pids: Effect.succeedSome(A.map(entries, (entry) => entry.pid)),
    cwd: (pid) => Effect.succeed(O.flatMap(lookup(pid), (entry) => O.fromNullishOr(entry.cwd))),
    descriptors: (pid) =>
      Effect.succeed(
        O.getOrElse(
          O.flatMap(lookup(pid), (entry) => O.fromNullishOr(entry.descriptors)),
          A.empty
        )
      ),
    status: (pid) => Effect.succeed(O.map(lookup(pid), entryStatus)),
  };
};

/**
 * A process table whose attachments come from `base` while its lineage comes only from rows.
 *
 * **Details**
 *
 * A fence test wants real holders (an open descriptor, a child standing in
 * the lane) with a scripted process tree around them: the live `/proc` scan
 * still finds the holders, while `self` and every `status` answer come from
 * the rows, so a pid without a row is unreadable rather than looked up live.
 *
 * **Example** (Script the lineage of the invoking process)
 *
 * ```ts
 * import { procProcessTable, processTableWithLineage, ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 *
 * const table = processTableWithLineage({
 *   base: procProcessTable,
 *   self: 70,
 *   entries: [
 *     ProcessTableEntry.make({ pid: 60, parent: 1, command: "claude" }),
 *     ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh" }),
 *   ],
 * })
 * console.log(table.self) // 70
 * ```
 *
 * @param table - The base table that keeps answering `pids`, `cwd`, and `descriptors`, the pid to report as `self`, and the rows that answer `status`.
 * @returns A process table with scripted lineage over live attachments.
 * @category testing
 * @since 0.0.0
 */
export const processTableWithLineage = ({
  base,
  entries,
  self,
}: {
  readonly base: ProcessTableShape;
  readonly self: number;
  readonly entries: ReadonlyArray<ProcessTableEntry>;
}): ProcessTableShape => {
  const index = entryIndex(entries);
  return {
    ...base,
    self,
    status: (pid) => Effect.succeed(O.map(HashMap.get(index, pid), entryStatus)),
  };
};

/**
 * The command names that head an agent session.
 *
 * **Details**
 *
 * The nearest ancestor with one of these names is the invoking session's
 * root: every process under it (the session's MCP servers, tool shells, and
 * the pipelines those shells run) belongs to the party asking for a
 * retirement.
 *
 * **Example** (Recognize the Claude Code session binary)
 *
 * ```ts
 * import { ProcessSessionCommand } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProcessSessionCommand)("claude")) // true
 * console.log(S.is(ProcessSessionCommand)("zsh")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessSessionCommand = LiteralKit(["claude"]).pipe(
  $I.annoteSchema("ProcessSessionCommand", {
    description: "Command names (kernel comm values) whose process heads an agent session.",
  })
);

/**
 * The command names of the service managers a session chain ends beneath.
 *
 * **Example** (Recognize the user manager)
 *
 * ```ts
 * import { ProcessManagerCommand } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProcessManagerCommand)("systemd")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessManagerCommand = LiteralKit(["systemd"]).pipe(
  $I.annoteSchema("ProcessManagerCommand", {
    description: "Command names of the service managers (pid 1 and the per-user manager) that bound a session chain.",
  })
);

/**
 * Which rule chose a session root.
 *
 * **Example** (Read the rule literals)
 *
 * ```ts
 * import { ProcessSessionRootRule } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProcessSessionRootRule.Options) // [ 'session-command', 'chain-top' ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessSessionRootRule = LiteralKit(["session-command", "chain-top"]).pipe(
  $I.annoteSchema("ProcessSessionRootRule", {
    description:
      "How the invoking session root was chosen: the nearest ancestor with a session command, or the top of the chain below the service manager.",
  })
);

/**
 * The process every member of the invoking session descends from.
 *
 * **Example** (Construct a root)
 *
 * ```ts
 * import { ProcessSessionRoot } from "@beep/repo-cli/test/RepoRun"
 *
 * const root = ProcessSessionRoot.make({ pid: 60, rule: "session-command" })
 * console.log(root.rule) // "session-command"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessSessionRoot extends S.Class<ProcessSessionRoot>($I`ProcessSessionRoot`)(
  {
    pid: ProcessPid,
    rule: ProcessSessionRootRule,
  },
  $I.annote("ProcessSessionRoot", {
    description: "The pid the invoking session's processes all descend from, and the rule that chose it.",
  })
) {}

const isSessionCommand = S.is(ProcessSessionCommand);
const isManagerCommand = S.is(ProcessManagerCommand);

// A session chain ends where the service manager begins: at init or at the
// per-user manager, whichever the walk reaches first.
const isChainBoundary = (status: ProcessStatus): boolean => status.pid === INIT_PID || isManagerCommand(status.command);

/**
 * A process's own status and each ancestor's, nearest first.
 *
 * **Details**
 *
 * The walk ends at init's parent (pid 0), at the first process whose status
 * cannot be read, or at a repeated pid. It names fewer processes in those
 * cases, never more.
 *
 * **Example** (Walk a scripted chain)
 *
 * ```ts
 * import { processLineage, ProcessTable, processTableFromEntries, ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 * import { Effect, FileSystem } from "effect"
 * import * as A from "effect/Array"
 *
 * const table = processTableFromEntries({
 *   self: 70,
 *   entries: [
 *     ProcessTableEntry.make({ pid: 1, parent: 0, command: "systemd" }),
 *     ProcessTableEntry.make({ pid: 60, parent: 1, command: "claude" }),
 *     ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh" }),
 *   ],
 * })
 * const chain = processLineage(70).pipe(
 *   Effect.provideService(ProcessTable, table),
 *   Effect.provide(FileSystem.layerNoop({}))
 * )
 * console.log(A.map(Effect.runSync(chain), (status) => status.pid)) // [ 70, 60, 1 ]
 * ```
 *
 * @param pid - The process to start from.
 * @returns The statuses from the process up through its readable ancestors.
 * @category utilities
 * @since 0.0.0
 */
export const processLineage = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<ReadonlyArray<ProcessStatus>, never, FileSystem.FileSystem> {
  const table = yield* ProcessTable;
  const seen = MutableHashSet.empty<number>();
  let chain: ReadonlyArray<ProcessStatus> = A.empty();
  let current = pid;
  while (current > 0 && !MutableHashSet.has(seen, current)) {
    MutableHashSet.add(seen, current);
    const status = yield* table.status(current);
    if (O.isNone(status)) {
      break;
    }
    chain = A.append(chain, status.value);
    current = status.value.parent;
  }
  return chain;
});

/**
 * The root of the invoking session: the process every member of the session descends from.
 *
 * **Details**
 *
 * Walking up from the invoking process and stopping below the service
 * manager (init or the per-user `systemd`), the root is the nearest ancestor
 * whose command is a session command (`claude`); when there is none, it is
 * the top of that chain, and when even the invoking process cannot be read it
 * is the invoking process itself. A retirement started from inside a lane has
 * the CLI, its shell, the agent session, and the session's other children
 * (MCP servers, the tool shell's own pipelines) all holding that lane.
 * Only a `session-command` root permits the retirement fence to exempt its
 * subtree. A `chain-top` root bounds the invoking ancestry only; sibling
 * terminal tabs and worker jobs remain foreign holders.
 * Exempt session children must finish writing before retirement: writes after
 * archive capture are not preserved merely because their process is exempt.
 *
 * **Example** (Resolve the root of a scripted session)
 *
 * ```ts
 * import { invokerSessionRoot, ProcessTable, processTableFromEntries, ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 * import { Effect, FileSystem } from "effect"
 *
 * const table = processTableFromEntries({
 *   self: 70,
 *   entries: [
 *     ProcessTableEntry.make({ pid: 1, parent: 0, command: "systemd" }),
 *     ProcessTableEntry.make({ pid: 50, parent: 1, command: "systemd" }),
 *     ProcessTableEntry.make({ pid: 55, parent: 50, command: "claude-desktop" }),
 *     ProcessTableEntry.make({ pid: 60, parent: 55, command: "claude" }),
 *     ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh" }),
 *   ],
 * })
 * const root = invokerSessionRoot().pipe(
 *   Effect.provideService(ProcessTable, table),
 *   Effect.provide(FileSystem.layerNoop({}))
 * )
 * console.log(Effect.runSync(root).pid) // 60
 * ```
 *
 * @returns The session root and the rule that chose it.
 * @category utilities
 * @since 0.0.0
 */
export const invokerSessionRoot = Effect.fnUntraced(function* (): Effect.fn.Return<
  ProcessSessionRoot,
  never,
  FileSystem.FileSystem
> {
  const table = yield* ProcessTable;
  const session = A.takeWhile(yield* processLineage(table.self), (status) => !isChainBoundary(status));
  return O.match(
    A.findFirst(session, (status) => isSessionCommand(status.command)),
    {
      onSome: (status) => ProcessSessionRoot.make({ pid: status.pid, rule: "session-command" }),
      onNone: () =>
        ProcessSessionRoot.make({
          pid: O.match(A.last(session), { onNone: () => table.self, onSome: (top) => top.pid }),
          rule: "chain-top",
        }),
    }
  );
});

/**
 * Whether a process's parent chain passes through a root, the root itself included.
 *
 * **Example** (Tell a session sibling from an unrelated holder)
 *
 * ```ts
 * import { descendsFromProcess, ProcessTable, processTableFromEntries, ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 * import { Effect, FileSystem } from "effect"
 *
 * const table = processTableFromEntries({
 *   self: 70,
 *   entries: [
 *     ProcessTableEntry.make({ pid: 50, parent: 1, command: "systemd" }),
 *     ProcessTableEntry.make({ pid: 60, parent: 50, command: "claude" }),
 *     ProcessTableEntry.make({ pid: 80, parent: 60, command: "bunx" }),
 *     ProcessTableEntry.make({ pid: 90, parent: 50, command: "zsh" }),
 *   ],
 * })
 * const run = <A>(effect: Effect.Effect<A, never, FileSystem.FileSystem>) =>
 *   Effect.runSync(effect.pipe(Effect.provideService(ProcessTable, table), Effect.provide(FileSystem.layerNoop({}))))
 * console.log([run(descendsFromProcess(80, 60)), run(descendsFromProcess(90, 60))]) // [ true, false ]
 * ```
 *
 * @param pid - The process whose ancestry is walked; the data-last form takes it alone.
 * @param root - The pid the chain must pass through.
 * @returns Whether the process is the root or one of its descendants.
 * @category utilities
 * @since 0.0.0
 */
export const descendsFromProcess: {
  (pid: number, root: number): Effect.Effect<boolean, never, FileSystem.FileSystem>;
  (root: number): (pid: number) => Effect.Effect<boolean, never, FileSystem.FileSystem>;
} = dual(
  2,
  (pid: number, root: number): Effect.Effect<boolean, never, FileSystem.FileSystem> =>
    Effect.map(
      processLineage(pid),
      A.some((status) => status.pid === root)
    )
);
