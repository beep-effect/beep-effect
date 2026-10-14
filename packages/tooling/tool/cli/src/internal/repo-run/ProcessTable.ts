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
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/repo-run/ProcessTable");

const PID_DIRECTORY_NAME = /^[0-9]+$/u;
const LINK_SCAN_CONCURRENCY = 16;
const STATUS_NAME_LINE = /^Name:\s*(.*?)\s*$/mu;
const STATUS_PARENT_LINE = /^PPid:\s*(\d+)\s*$/mu;
const STATUS_VOLUNTARY_SWITCHES_LINE = /^voluntary_ctxt_switches:\s*(\d+)\s*$/mu;
const STATUS_INVOLUNTARY_SWITCHES_LINE = /^nonvoluntary_ctxt_switches:\s*(\d+)\s*$/mu;
const INIT_PID = 1;
// Zero-based positions in the space-separated tail of `/proc/<pid>/stat` that
// follows the parenthesized command name: state, ppid, pgrp, session, tty_nr, tpgid.
const STAT_PROCESS_GROUP_FIELD = 2;
const STAT_TERMINAL_FIELD = 4;
const STAT_FOREGROUND_GROUP_FIELD = 5;
const NO_TERMINAL = 0;
const NO_FOREGROUND_GROUP = -1;
const GROUP_SCAN_CONCURRENCY = 16;

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

const ProcessContextSwitches = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ProcessContextSwitches", {
    description: "Voluntary plus involuntary context switches a process has made since it started.",
  })
);

/**
 * What `/proc/<pid>/status` says about one process: its parent, command name, and context switches.
 *
 * **Details**
 *
 * `contextSwitches` is the sum of the voluntary and involuntary switch counts.
 * A process blocked in a read makes none until something wakes it, so two
 * equal samples prove it did nothing in between. It is `None` when the
 * status document does not carry the counts.
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
    contextSwitches: ProcessContextSwitches.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("ProcessStatus", {
    description:
      "A process id with the parent pid, command name, and context-switch count its /proc status file reports.",
  })
) {}

const statusCount = (pattern: RegExp, text: string): O.Option<number> =>
  O.flatMap(O.fromNullishOr(pattern.exec(text)), (match) => O.flatMap(O.fromNullishOr(match[1]), N.parse));

/**
 * Parse the parent pid and command name out of a `/proc/<pid>/status` document.
 *
 * **Details**
 *
 * The `Name:` line carries the kernel's `comm` value (the executable name,
 * truncated to fifteen characters) and the `PPid:` line the parent pid. A
 * document missing either line yields `None`. The `voluntary_ctxt_switches:`
 * and `nonvoluntary_ctxt_switches:` lines, when both are present, add up to
 * `contextSwitches`.
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
      parent: statusCount(STATUS_PARENT_LINE, text),
    }).pipe(
      O.map(({ command, parent }) =>
        ProcessStatus.make({
          pid,
          parent,
          command,
          contextSwitches: O.map(
            O.all([
              statusCount(STATUS_VOLUNTARY_SWITCHES_LINE, text),
              statusCount(STATUS_INVOLUNTARY_SWITCHES_LINE, text),
            ]),
            ([voluntary, involuntary]) => voluntary + involuntary
          ),
        })
      )
    )
);

const ProcessGroupId = S.Int.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("ProcessGroupId", {
    description: "Process group id as /proc reports it; kernel threads report 0.",
  })
);

/**
 * What `/proc/<pid>/stat` says about a process's place in terminal job control.
 *
 * **Details**
 *
 * `processGroup` is the group the process belongs to. `terminal` is the
 * controlling terminal's device number, `0` when there is none, and
 * `foregroundGroup` is the process group that terminal currently runs in the
 * foreground, `-1` when there is no controlling terminal. An interactive
 * shell with job control puts each foreground job in a group of its own, so
 * a shell sitting at its prompt is the one whose terminal's foreground group
 * is the shell's own pid.
 *
 * **Example** (Construct an idle shell's job control)
 *
 * ```ts
 * import { ProcessJobControl } from "@beep/repo-cli/test/RepoRun"
 *
 * const idle = ProcessJobControl.make({ pid: 70, processGroup: 70, terminal: 34823, foregroundGroup: 70 })
 * console.log(idle.foregroundGroup === idle.pid) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProcessJobControl extends S.Class<ProcessJobControl>($I`ProcessJobControl`)(
  {
    pid: ProcessPid,
    processGroup: ProcessGroupId,
    terminal: S.Int,
    foregroundGroup: S.Int,
  },
  $I.annote("ProcessJobControl", {
    description:
      "A process id with its process group, controlling terminal device (0 for none), and that terminal's foreground group (-1 for none).",
  })
) {}

const decodeProcessJobControl = S.decodeUnknownOption(ProcessJobControl);

/**
 * Parse the job-control fields out of a `/proc/<pid>/stat` document.
 *
 * **Details**
 *
 * The command name sits in parentheses and may itself contain spaces or
 * parentheses, so the fields are read from the text after the last `)`:
 * the process group, controlling terminal, and terminal foreground group are
 * the third, fifth, and sixth of them. A document cut short, or with a field
 * that is not an integer, yields `None`.
 *
 * **Example** (Parse a stat document)
 *
 * ```ts
 * import { parseProcessJobControl } from "@beep/repo-cli/test/RepoRun"
 * import * as O from "effect/Option"
 *
 * const stat = "70 (zsh) S 60 70 70 34823 70 4194304 13355"
 * console.log(O.map(parseProcessJobControl(stat, 70), (job) => job.foregroundGroup)) // { _id: 'Option', _tag: 'Some', value: 70 }
 * console.log(O.isNone(parseProcessJobControl(70)("70 (zsh) S 60"))) // true
 * ```
 *
 * @param text - The stat document content; the data-last form takes it alone.
 * @param pid - The process the document describes.
 * @returns The parsed job control, or `None` when a field is absent or malformed.
 * @category utilities
 * @since 0.0.0
 */
export const parseProcessJobControl: {
  (text: string, pid: number): O.Option<ProcessJobControl>;
  (pid: number): (text: string) => O.Option<ProcessJobControl>;
} = dual(2, (text: string, pid: number): O.Option<ProcessJobControl> => {
  const fields = O.map(Str.lastIndexOf(")")(text), (at) => pipe(text, Str.slice(at + 1), Str.trim, Str.split(" ")));
  const field = (index: number): O.Option<number> => O.flatMap(fields, (all) => O.flatMap(A.get(all, index), N.parse));
  return O.all({
    processGroup: field(STAT_PROCESS_GROUP_FIELD),
    terminal: field(STAT_TERMINAL_FIELD),
    foregroundGroup: field(STAT_FOREGROUND_GROUP_FIELD),
  }).pipe(O.flatMap((parsed) => decodeProcessJobControl({ pid, ...parsed })));
});

/**
 * How a process table answers the questions a retirement fence asks of `/proc`.
 *
 * **Details**
 *
 * `pids` lists every process the table knows, or `None` when the table could
 * not be listed at all. `cwd` and `descriptors` return the fully resolved
 * paths a process holds through those link families; an unreadable process
 * answers empty, never as attached. `status` reads a process's parent and
 * command name, and `jobControl` its process group and terminal, each `None`
 * when the process cannot be read. `self` is the pid of the process asking.
 *
 * @category models
 * @since 0.0.0
 */
export interface ProcessTableShape {
  /** The resolved working directory of a process, when readable. */
  readonly cwd: (pid: number) => Effect.Effect<O.Option<string>, never, FileSystem.FileSystem>;
  /** The resolved targets of a process's open descriptors, empty when unreadable. */
  readonly descriptors: (pid: number) => Effect.Effect<ReadonlyArray<string>, never, FileSystem.FileSystem>;
  /** The process group and controlling terminal of a process, when readable. */
  readonly jobControl: (pid: number) => Effect.Effect<O.Option<ProcessJobControl>, never, FileSystem.FileSystem>;
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

const readProcJobControl = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<ProcessJobControl>, never, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const text = yield* fs.readFileString(`/proc/${pid}/stat`).pipe(Effect.option);
  return O.flatMap(text, parseProcessJobControl(pid));
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
  jobControl: readProcJobControl,
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
 * **Details**
 *
 * The job-control fields are optional: a row without them is its own process
 * group with no controlling terminal, which is what an agent's tool shell or
 * an MCP server looks like. A terminal shell names its `terminal` device and
 * the `foregroundGroup` that terminal runs. `contextSwitches` is optional too;
 * a row without it reports no count.
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
    processGroup: S.optionalKey(ProcessGroupId),
    terminal: S.optionalKey(S.Int),
    foregroundGroup: S.optionalKey(S.Int),
    contextSwitches: S.optionalKey(ProcessContextSwitches),
  },
  $I.annote("ProcessTableEntry", {
    description:
      "A fake process-table row: pid, parent, command name, the resolved paths it holds, and optional job control.",
  })
) {}

const entryIndex = (entries: ReadonlyArray<ProcessTableEntry>): HashMap.HashMap<number, ProcessTableEntry> =>
  HashMap.fromIterable(A.map(entries, (entry) => [entry.pid, entry] as const));

const entryStatus = (entry: ProcessTableEntry): ProcessStatus =>
  ProcessStatus.make({
    pid: entry.pid,
    parent: entry.parent,
    command: entry.command,
    contextSwitches: O.fromUndefinedOr(entry.contextSwitches),
  });

const entryJobControl = (entry: ProcessTableEntry): ProcessJobControl =>
  ProcessJobControl.make({
    pid: entry.pid,
    processGroup: O.getOrElse(O.fromUndefinedOr(entry.processGroup), () => entry.pid),
    terminal: O.getOrElse(O.fromUndefinedOr(entry.terminal), () => NO_TERMINAL),
    foregroundGroup: O.getOrElse(O.fromUndefinedOr(entry.foregroundGroup), () => NO_FOREGROUND_GROUP),
  });

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
    jobControl: (pid) => Effect.succeed(O.map(lookup(pid), entryJobControl)),
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
    jobControl: (pid) => Effect.succeed(O.map(HashMap.get(index, pid), entryJobControl)),
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
 * console.log(ProcessSessionRootRule.literals) // [ 'session-command', 'chain-top' ]
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
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
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
 * @param readStatus - Optional status reader; otherwise uses the injected process table.
 * @returns The statuses from the process up through its readable ancestors.
 * @category utilities
 * @since 0.0.0
 */
export const processLineage = Effect.fnUntraced(function* (
  pid: number,
  readStatus?: ProcessTableShape["status"]
): Effect.fn.Return<ReadonlyArray<ProcessStatus>, never, FileSystem.FileSystem> {
  const read = readStatus ?? (yield* ProcessTable).status;
  const seen = MutableHashSet.empty<number>();
  let chain: ReadonlyArray<ProcessStatus> = A.empty();
  let current = pid;
  while (current > 0 && !MutableHashSet.has(seen, current)) {
    MutableHashSet.add(seen, current);
    const status = yield* read(current);
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
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
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
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
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

/**
 * The command names of the desktop app that hosts agent sessions and their Terminal panels.
 *
 * **Example** (Recognize the Claude Desktop app)
 *
 * ```ts
 * import { ProcessDesktopHostCommand } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProcessDesktopHostCommand)("claude-desktop")) // true
 * console.log(S.is(ProcessDesktopHostCommand)("claude")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessDesktopHostCommand = LiteralKit(["claude-desktop"]).pipe(
  $I.annoteSchema("ProcessDesktopHostCommand", {
    description: "Command names (kernel comm values) of the desktop app whose Terminal panel starts a login shell.",
  })
);

/**
 * The command names of the interactive shells a Terminal panel may start.
 *
 * **Example** (Recognize zsh)
 *
 * ```ts
 * import { ProcessShellCommand } from "@beep/repo-cli/test/RepoRun"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ProcessShellCommand)("zsh")) // true
 * console.log(S.is(ProcessShellCommand)("nvim")) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProcessShellCommand = LiteralKit(["bash", "dash", "fish", "ksh", "sh", "tcsh", "zsh"]).pipe(
  $I.annoteSchema("ProcessShellCommand", {
    description: "Command names (kernel comm values) of interactive shells.",
  })
);

/**
 * Whether a desktop Terminal panel shell sits at its prompt or is running a command.
 *
 * **Example** (Read the state literals)
 *
 * ```ts
 * import { DesktopTerminalShellState } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(DesktopTerminalShellState.literals) // [ 'idle', 'busy' ]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DesktopTerminalShellState = LiteralKit(["idle", "busy"]).pipe(
  $I.annoteSchema("DesktopTerminalShellState", {
    description:
      "A desktop Terminal panel shell at its prompt (idle) or with a command in its terminal's foreground (busy).",
  })
);

/**
 * Desktop Terminal panel shell state type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DesktopTerminalShellState = typeof DesktopTerminalShellState.Type;

const isDesktopHostCommand = S.is(ProcessDesktopHostCommand);
const isShellCommand = S.is(ProcessShellCommand);

// Nothing but the shell itself may belong to its group: a shell without job
// control runs its foreground commands in its own group, so the foreground
// group alone would read such a shell as idle mid-command. A table that cannot
// be listed proves nothing, so the shell counts as busy. A listed pid whose
// stat cannot be read is skipped: `/proc/<pid>/stat` is world-readable, so an
// unreadable one has exited between the listing and the read and belongs to no
// group. Counting it as a member would read every shell as busy whenever any
// process on the machine exits mid-scan. A foreground job under job control is
// caught by the foreground-group check, which does not depend on this scan.
const groupHasOtherMembers = Effect.fnUntraced(function* (
  table: ProcessTableShape,
  shell: number
): Effect.fn.Return<boolean, never, FileSystem.FileSystem> {
  const pids = yield* table.pids;
  if (O.isNone(pids)) {
    return true;
  }
  const others = A.filter(pids.value, (pid) => pid !== shell);
  const controls = yield* Effect.forEach(others, table.jobControl, { concurrency: GROUP_SCAN_CONCURRENCY });
  return A.some(A.getSomes(controls), (control) => control.processGroup === shell);
});

/**
 * Whether a process is a Claude Desktop Terminal panel shell, and if so whether it is idle.
 *
 * **Details**
 *
 * The desktop app starts a login shell on a pseudo-terminal for each Code
 * session's Terminal panel, in the session's folder, whether or not the panel
 * was ever opened, and starts a new one there when it exits. Such a shell is
 * recognized narrowly: its command is a shell, its direct parent is the
 * desktop app (an agent session's tool shells sit under the `claude` process
 * instead, and have no terminal), and it has a controlling terminal. It is
 * `idle` when that terminal's foreground group is the shell's own group and
 * no other process belongs to that group, which is a shell sitting at its
 * prompt; anything else, including a table that cannot be listed, is `busy`.
 * `None` for every other process.
 *
 * **Example** (Classify a panel shell at its prompt)
 *
 * ```ts
 * import { desktopTerminalShellState, ProcessTable, processTableFromEntries, ProcessTableEntry } from "@beep/repo-cli/test/RepoRun"
 * import * as Effect from "effect/Effect";
 * import * as FileSystem from "effect/FileSystem";
 * const table = processTableFromEntries({
 *   self: 100,
 *   entries: [
 *     ProcessTableEntry.make({ pid: 55, parent: 50, command: "claude-desktop" }),
 *     ProcessTableEntry.make({ pid: 70, parent: 55, command: "zsh", terminal: 34823, foregroundGroup: 70 }),
 *   ],
 * })
 * const state = desktopTerminalShellState(70).pipe(
 *   Effect.provideService(ProcessTable, table),
 *   Effect.provide(FileSystem.layerNoop({}))
 * )
 * console.log(Effect.runSync(state)) // { _id: 'Option', _tag: 'Some', value: 'idle' }
 * ```
 *
 * @param pid - The process to classify.
 * @returns The panel shell's state, or `None` when the process is not one.
 * @category utilities
 * @since 0.0.0
 */
export const desktopTerminalShellState = Effect.fnUntraced(function* (
  pid: number
): Effect.fn.Return<O.Option<DesktopTerminalShellState>, never, FileSystem.FileSystem> {
  const table = yield* ProcessTable;
  const status = yield* table.status(pid);
  if (O.isNone(status) || !isShellCommand(status.value.command)) {
    return O.none();
  }
  const parent = yield* table.status(status.value.parent);
  const control = yield* table.jobControl(pid);
  if (
    !O.exists(parent, (host) => isDesktopHostCommand(host.command)) ||
    !O.exists(control, (job) => job.terminal !== NO_TERMINAL)
  ) {
    return O.none();
  }
  const atPrompt = O.exists(control, (job) => job.processGroup === pid && job.foregroundGroup === pid);
  if (!atPrompt) {
    return O.some("busy");
  }
  return O.some((yield* groupHasOtherMembers(table, pid)) ? "busy" : "idle");
});
