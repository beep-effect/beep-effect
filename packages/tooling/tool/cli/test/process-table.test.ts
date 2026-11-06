import {
  descendsFromProcess,
  desktopTerminalShellState,
  fdinfoWatches,
  invokerSessionRoot,
  ProcessInotifyWatch,
  ProcessTable,
  ProcessTableEntry,
  parseProcessJobControl,
  parseProcessStatus,
  processLineage,
  processTableFromEntries,
  processTableWithLineage,
  procProcessTable,
  scanProcessAttachments,
} from "@beep/repo-cli/test/RepoRun";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import type { ProcessTableShape } from "@beep/repo-cli/test/RepoRun";

// The tree a fence sees on a Claude desktop workstation: the user manager (50)
// runs the desktop app (55), which runs two sessions (60 and 65). Session 60
// owns the tool shell (70) running the CLI (100) and an MCP server (80) with
// its worker (81); session 65 owns its own shell (90); a stray editor (200)
// hangs straight off the user manager.
const workstation: ReadonlyArray<ProcessTableEntry> = [
  ProcessTableEntry.make({ pid: 1, parent: 0, command: "systemd" }),
  ProcessTableEntry.make({ pid: 50, parent: 1, command: "systemd" }),
  ProcessTableEntry.make({ pid: 55, parent: 50, command: "claude-desktop" }),
  ProcessTableEntry.make({ pid: 60, parent: 55, command: "claude" }),
  ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh" }),
  ProcessTableEntry.make({ pid: 100, parent: 70, command: "bun" }),
  ProcessTableEntry.make({ pid: 80, parent: 60, command: "bunx" }),
  ProcessTableEntry.make({ pid: 81, parent: 80, command: "node" }),
  ProcessTableEntry.make({ pid: 65, parent: 55, command: "claude" }),
  ProcessTableEntry.make({ pid: 90, parent: 65, command: "zsh" }),
  ProcessTableEntry.make({ pid: 200, parent: 50, command: "nvim" }),
];

// A plain terminal with no agent session anywhere above the CLI.
const terminal: ReadonlyArray<ProcessTableEntry> = [
  ProcessTableEntry.make({ pid: 1, parent: 0, command: "systemd" }),
  ProcessTableEntry.make({ pid: 50, parent: 1, command: "systemd" }),
  ProcessTableEntry.make({ pid: 500, parent: 50, command: "ghostty" }),
  ProcessTableEntry.make({ pid: 510, parent: 500, command: "zsh" }),
  ProcessTableEntry.make({ pid: 520, parent: 510, command: "bun" }),
];

const withTable =
  (table: ProcessTableShape) =>
  <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem>): Effect.Effect<A, E> =>
    effect.pipe(
      Effect.provideService(ProcessTable, table),
      Effect.provideService(FileSystem.FileSystem, FileSystem.makeNoop({}))
    );

const pidsOf = (statuses: ReadonlyArray<{ readonly pid: number }>): ReadonlyArray<number> =>
  A.map(statuses, (status) => status.pid);

describe("parseProcessStatus", () => {
  it("reads the command name and parent pid in either argument order", () => {
    const document = "Name:\tzsh\nUmask:\t0022\nState:\tS (sleeping)\nPid:\t70\nPPid:\t60\n";
    const status = O.getOrThrow(parseProcessStatus(document, 70));
    expect([status.pid, status.parent, status.command]).toEqual([70, 60, "zsh"]);
    expect(O.getOrThrow(parseProcessStatus(70)(document)).command).toBe("zsh");
    assertNone(parseProcessStatus("State:\tS (sleeping)\nPPid:\t60\n", 70));
    assertNone(parseProcessStatus("Name:\tzsh\n", 70));
    assertNone(status.contextSwitches);
  });

  it("adds the voluntary and involuntary context switches when both are present", () => {
    const document = "Name:\tzsh\nPPid:\t60\nvoluntary_ctxt_switches:\t40\nnonvoluntary_ctxt_switches:\t2\n";
    assertSome(O.getOrThrow(parseProcessStatus(document, 70)).contextSwitches, 42);
    assertNone(
      O.getOrThrow(parseProcessStatus("Name:\tzsh\nPPid:\t60\nvoluntary_ctxt_switches:\t40\n", 70)).contextSwitches
    );
  });
});

describe("parseProcessJobControl", () => {
  it("reads the group, terminal, and foreground group after the last parenthesis", () => {
    const shell = O.getOrThrow(parseProcessJobControl("70 (zsh) S 60 70 70 34823 70 4194304 13355 95982", 70));
    expect([shell.processGroup, shell.terminal, shell.foregroundGroup]).toEqual([70, 34823, 70]);
    // A command name may itself hold spaces and parentheses; only the last `)` ends it.
    const odd = O.getOrThrow(parseProcessJobControl(80)("80 (tmux: (server) x) S 1 80 80 0 -1 4194560"));
    expect([odd.processGroup, odd.terminal, odd.foregroundGroup]).toEqual([80, 0, -1]);
    assertNone(parseProcessJobControl("70 (zsh) S 60 70", 70));
    assertNone(parseProcessJobControl("70 zsh S 60 70 70 34823 70", 70));
    assertNone(parseProcessJobControl("70 (zsh) S 60 x 70 34823 70", 70));
  });
});

describe("fdinfoWatches", () => {
  // fdinfo of WebStorm's fsnotifier after it walked a two-directory tree.
  const fdinfo = A.join(
    [
      "pos:\t0",
      "flags:\t00",
      "mnt_id:\t16",
      "ino:\t1057",
      "inotify wd:25d3 ino:3039d7c0 sdev:21 mask:fc6 ignored_mask:0 fhandle-bytes:14 fhandle-type:4d f_handle:c0d7393000000000",
      "inotify wd:1 ino:2 sdev:fc00001 mask:fff ignored_mask:0 fhandle-bytes:8 fhandle-type:1 f_handle:0200000000000000",
      "",
    ],
    "\n"
  );

  it("finds a watch only by its exact inode and superblock device", () => {
    assertTrue(fdinfoWatches(fdinfo, ProcessInotifyWatch.make({ device: 0x21n, inode: 0x3039d7c0n })));
    assertTrue(fdinfoWatches(ProcessInotifyWatch.make({ device: 0xfc00001n, inode: 2n }))(fdinfo));
    // Same inode on another device, a prefix of a watched inode, a prefix of a device.
    assertFalse(fdinfoWatches(fdinfo, ProcessInotifyWatch.make({ device: 0x22n, inode: 0x3039d7c0n })));
    assertFalse(fdinfoWatches(fdinfo, ProcessInotifyWatch.make({ device: 0x21n, inode: 0x3039d7cn })));
    assertFalse(fdinfoWatches(fdinfo, ProcessInotifyWatch.make({ device: 0xfc0000n, inode: 2n })));
    // The descriptor's own inode line is not a watch.
    assertFalse(fdinfoWatches(fdinfo, ProcessInotifyWatch.make({ device: 0x21n, inode: 0x1057n })));
  });

  it.effect("answers watching from fake rows, false for a row without watches", () => {
    const watch = ProcessInotifyWatch.make({ device: 33n, inode: 809092275n });
    const table = processTableFromEntries({
      self: 100,
      entries: [
        ProcessTableEntry.make({ pid: 100, parent: 1, command: "bun" }),
        ProcessTableEntry.make({ pid: 200, parent: 1, command: "fsnotifier", watches: [watch] }),
      ],
    });
    return Effect.gen(function* () {
      const watching1 = yield* table.watching(200, ProcessInotifyWatch.make({ device: 33n, inode: 809092275n }));
      assertTrue(watching1);
      const watching2 = yield* table.watching(200, ProcessInotifyWatch.make({ device: 33n, inode: 2n }));
      assertFalse(watching2);
      const watching3 = yield* table.watching(100, watch);
      assertFalse(watching3);
      const watching4 = yield* table.watching(300, watch);
      assertFalse(watching4);
    }).pipe(withTable(table));
  });
});

// The Claude Desktop app (55) runs a Code session (60) whose tool shell (70)
// has no terminal, and starts a Terminal-panel login shell (300) on a pty in
// the session folder. Rows below add one panel-like process at a time.
const desktop: ReadonlyArray<ProcessTableEntry> = [
  ProcessTableEntry.make({ pid: 1, parent: 0, command: "systemd" }),
  ProcessTableEntry.make({ pid: 50, parent: 1, command: "systemd" }),
  ProcessTableEntry.make({ pid: 55, parent: 50, command: "claude-desktop" }),
  ProcessTableEntry.make({ pid: 60, parent: 55, command: "claude" }),
  ProcessTableEntry.make({ pid: 70, parent: 60, command: "zsh" }),
  ProcessTableEntry.make({ pid: 500, parent: 50, command: "ghostty" }),
];

const panelShell = (overrides: Partial<{ readonly command: string; readonly foregroundGroup: number }> = {}) =>
  ProcessTableEntry.make({
    pid: 300,
    parent: 55,
    command: "zsh",
    terminal: 34823,
    foregroundGroup: 300,
    ...overrides,
  });

const terminalStateIn = (entries: ReadonlyArray<ProcessTableEntry>, pid: number) =>
  desktopTerminalShellState(pid).pipe(withTable(processTableFromEntries({ self: 100, entries })));

describe("desktopTerminalShellState", () => {
  it.effect("reads a panel shell at its prompt as idle", () =>
    Effect.gen(function* () {
      const terminalStateIn5 = yield* terminalStateIn(A.append(desktop, panelShell()), 300);
      assertSome(terminalStateIn5, "idle");
    })
  );

  it.effect("reads a panel shell whose terminal runs another group in the foreground as busy", () =>
    Effect.gen(function* () {
      const job = ProcessTableEntry.make({ pid: 310, parent: 300, command: "make", terminal: 34823 });
      const entries = A.appendAll(desktop, [panelShell({ foregroundGroup: 310 }), job]);
      const terminalStateIn6 = yield* terminalStateIn(entries, 300);
      assertSome(terminalStateIn6, "busy");
    })
  );

  it.effect("reads a shell without job control running a command in its own group as busy", () =>
    Effect.gen(function* () {
      // The terminal's foreground group is still the shell's, but a child shares it.
      const child = ProcessTableEntry.make({ pid: 311, parent: 300, command: "sleep", processGroup: 300 });
      const terminalStateIn7 = yield* terminalStateIn(A.appendAll(desktop, [panelShell(), child]), 300);
      assertSome(terminalStateIn7, "busy");
    })
  );

  it.effect("reads a panel shell as busy when the table cannot be listed", () =>
    Effect.gen(function* () {
      const table = processTableFromEntries({ self: 100, entries: A.append(desktop, panelShell()) });
      const state = yield* desktopTerminalShellState(300).pipe(withTable({ ...table, pids: Effect.succeedNone }));
      assertSome(state, "busy");
    })
  );

  it.effect("recognizes no other process as a panel shell", () =>
    Effect.gen(function* () {
      const entries = A.appendAll(desktop, [
        // An editor the desktop app started on a pty is not a shell.
        ProcessTableEntry.make({ pid: 320, parent: 55, command: "nvim", terminal: 34824, foregroundGroup: 320 }),
        // A shell the desktop app started without a terminal.
        ProcessTableEntry.make({ pid: 330, parent: 55, command: "zsh" }),
        // A terminal emulator's shell, not the desktop app's.
        ProcessTableEntry.make({ pid: 510, parent: 500, command: "zsh", terminal: 34825, foregroundGroup: 510 }),
        // A shell on a pty below the agent session rather than the app itself.
        ProcessTableEntry.make({ pid: 340, parent: 60, command: "zsh", terminal: 34826, foregroundGroup: 340 }),
      ]);
      const states = yield* Effect.forEach([55, 60, 70, 320, 330, 340, 510, 999], (pid) =>
        terminalStateIn(entries, pid)
      );
      assertTrue(A.every(states, O.isNone));
    })
  );
});

describe("processLineage", () => {
  it.effect("walks from a process up through its readable ancestors", () =>
    Effect.gen(function* () {
      const processLineage8 = yield* processLineage(100);
      expect(pidsOf(processLineage8)).toEqual([100, 70, 60, 55, 50, 1]);
      const processLineage9 = yield* processLineage(81);
      expect(pidsOf(processLineage9)).toEqual([81, 80, 60, 55, 50, 1]);
    }).pipe(withTable(processTableFromEntries({ self: 100, entries: workstation })))
  );

  it.effect("stops at an unreadable parent and at a repeated pid", () =>
    Effect.gen(function* () {
      const processLineage10 = yield* processLineage(300);
      expect(pidsOf(processLineage10)).toEqual([300]);
      const processLineage11 = yield* processLineage(400);
      expect(pidsOf(processLineage11)).toEqual([400, 401]);
      const processLineage12 = yield* processLineage(999);
      expect(pidsOf(processLineage12)).toEqual([]);
    }).pipe(
      withTable(
        processTableFromEntries({
          self: 300,
          entries: [
            ProcessTableEntry.make({ pid: 300, parent: 998, command: "orphan" }),
            ProcessTableEntry.make({ pid: 400, parent: 401, command: "loop-a" }),
            ProcessTableEntry.make({ pid: 401, parent: 400, command: "loop-b" }),
          ],
        })
      )
    )
  );
});

describe("invokerSessionRoot", () => {
  it.effect("picks the nearest claude ancestor of the invoking process", () =>
    Effect.gen(function* () {
      const root = yield* invokerSessionRoot();
      expect([root.pid, root.rule]).toEqual([60, "session-command"]);
    }).pipe(withTable(processTableFromEntries({ self: 100, entries: workstation })))
  );

  it.effect("picks the invoking process's own session, not a sibling session", () =>
    Effect.gen(function* () {
      const root = yield* invokerSessionRoot();
      expect([root.pid, root.rule]).toEqual([65, "session-command"]);
    }).pipe(withTable(processTableFromEntries({ self: 90, entries: workstation })))
  );

  it.effect("falls back to the top of the chain below the service manager", () =>
    Effect.gen(function* () {
      const root = yield* invokerSessionRoot();
      expect([root.pid, root.rule]).toEqual([500, "chain-top"]);
    }).pipe(withTable(processTableFromEntries({ self: 520, entries: terminal })))
  );

  it.effect("stops below pid 1 when no per-user manager sits between", () =>
    Effect.gen(function* () {
      const root = yield* invokerSessionRoot();
      expect([root.pid, root.rule]).toEqual([10, "chain-top"]);
    }).pipe(
      withTable(
        processTableFromEntries({
          self: 30,
          entries: [
            ProcessTableEntry.make({ pid: 1, parent: 0, command: "init" }),
            ProcessTableEntry.make({ pid: 10, parent: 1, command: "Runner.Worker" }),
            ProcessTableEntry.make({ pid: 20, parent: 10, command: "bash" }),
            ProcessTableEntry.make({ pid: 30, parent: 20, command: "bun" }),
          ],
        })
      )
    )
  );

  it.effect("names the invoking process itself when its status cannot be read", () =>
    Effect.gen(function* () {
      const root = yield* invokerSessionRoot();
      expect([root.pid, root.rule]).toEqual([999, "chain-top"]);
    }).pipe(withTable(processTableFromEntries({ self: 999, entries: workstation })))
  );
});

describe("descendsFromProcess", () => {
  it.effect("admits the root and everything under it, refuses the rest", () =>
    Effect.gen(function* () {
      const descendsFromProcess13 = yield* descendsFromProcess(81, 60);
      assertTrue(descendsFromProcess13);
      const descendsFromProcess14 = yield* descendsFromProcess(100, 60);
      assertTrue(descendsFromProcess14);
      const descendsFromProcess15 = yield* descendsFromProcess(60, 60);
      assertTrue(descendsFromProcess15);
      const descendsFromProcess16 = yield* descendsFromProcess(90, 60);
      assertFalse(descendsFromProcess16);
      const descendsFromProcess17 = yield* descendsFromProcess(200, 60);
      assertFalse(descendsFromProcess17);
      const descendsFromProcess18 = yield* descendsFromProcess(999, 60);
      assertFalse(descendsFromProcess18);
      const value = yield* descendsFromProcess(60)(81);
      assertTrue(value);
    }).pipe(withTable(processTableFromEntries({ self: 100, entries: workstation })))
  );
});

it.layer(NodeServices.layer, { timeout: "30 seconds" })("process table over a file system", (it) => {
  it.effect("keeps attachments from the base while lineage comes only from the rows", () =>
    Effect.gen(function* () {
      const base = processTableFromEntries({
        self: 100,
        entries: [
          ProcessTableEntry.make({ pid: 100, parent: 70, command: "bun", cwd: "/lane" }),
          ProcessTableEntry.make({ pid: 80, parent: 60, command: "bunx", descriptors: ["/lane/held.log"] }),
        ],
      });
      const table = processTableWithLineage({
        base,
        self: 7,
        entries: [ProcessTableEntry.make({ pid: 7, parent: 1, command: "scripted" })],
      });
      expect(table.self).toBe(7);
      const pids19 = yield* table.pids;
      expect(O.getOrThrow(pids19)).toEqual([100, 80]);
      const cwd20 = yield* table.cwd(100);
      expect(O.getOrThrow(cwd20)).toBe("/lane");
      const descriptors21 = yield* table.descriptors(80);
      expect(descriptors21).toEqual(["/lane/held.log"]);
      const status22 = yield* table.status(7);
      expect(O.getOrThrow(status22).command).toBe("scripted");
      const status23 = yield* table.status(100);
      assertNone(status23);
      // Job control is lineage too: a row without it is its own group with no terminal.
      const jobControl24 = yield* table.jobControl(7);
      expect(O.getOrThrow(jobControl24)).toMatchObject({
        processGroup: 7,
        terminal: 0,
        foregroundGroup: -1,
      });
      const jobControl25 = yield* table.jobControl(100);
      assertNone(jobControl25);
    })
  );

  it.effect("scans attachments through a scripted table", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const madeTempDirectoryScoped = yield* fs.makeTempDirectoryScoped({ prefix: "process-table-scan-" });
      const root = yield* fs.realPath(madeTempDirectoryScoped);
      const table = processTableFromEntries({
        self: 100,
        entries: [
          ProcessTableEntry.make({ pid: 100, parent: 70, command: "bun", cwd: root }),
          ProcessTableEntry.make({ pid: 80, parent: 60, command: "bunx", descriptors: [path.join(root, "held.log")] }),
          ProcessTableEntry.make({ pid: 90, parent: 50, command: "zsh", cwd: path.dirname(root) }),
        ],
      });
      const scan = yield* scanProcessAttachments({ directory: root, kinds: ["cwd", "descriptor"] }).pipe(
        Effect.provideService(ProcessTable, table)
      );
      expect(A.map(O.getOrThrow(scan), (attachment) => [attachment.pid, attachment.kind])).toEqual([
        [100, "cwd"],
        [80, "descriptor"],
      ]);
      const unlisted = yield* scanProcessAttachments({ directory: root, kinds: ["cwd"] }).pipe(
        Effect.provideService(ProcessTable, { ...table, pids: Effect.succeedNone })
      );
      assertNone(unlisted);
    })
  );

  it.effect("reads the live table for the invoking process", () =>
    Effect.gen(function* () {
      const status26 = yield* procProcessTable.status(process.pid);
      const own = O.getOrThrow(status26);
      expect(own.parent).toBe(process.ppid);
      expect(own.command.length).toBeGreaterThan(0);
      const jobControl27 = yield* procProcessTable.jobControl(process.pid);
      const job = O.getOrThrow(jobControl27);
      expect(job.pid).toBe(process.pid);
      expect(job.processGroup).toBeGreaterThan(0);
      const lineage = yield* processLineage(process.pid);
      expect(pidsOf(lineage)).toContain(process.ppid);
      const root = yield* invokerSessionRoot();
      expect(pidsOf(lineage)).toContain(root.pid);
      const descendsFromProcess28 = yield* descendsFromProcess(process.pid, root.pid);
      assertTrue(descendsFromProcess28);
    })
  );
});
