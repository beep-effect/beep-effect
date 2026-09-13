import {
  descendsFromProcess,
  invokerSessionRoot,
  ProcessTable,
  ProcessTableEntry,
  parseProcessStatus,
  processLineage,
  processTableFromEntries,
  processTableWithLineage,
  procProcessTable,
  scanProcessAttachments,
} from "@beep/repo-cli/test/RepoRun";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertTrue } from "@effect/vitest/utils";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
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
    effect.pipe(Effect.provideService(ProcessTable, table), Effect.provide(FileSystem.layerNoop({})));

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
  });
});

describe("processLineage", () => {
  it.effect("walks from a process up through its readable ancestors", () =>
    Effect.gen(function* () {
      expect(pidsOf(yield* processLineage(100))).toEqual([100, 70, 60, 55, 50, 1]);
      expect(pidsOf(yield* processLineage(81))).toEqual([81, 80, 60, 55, 50, 1]);
    }).pipe(withTable(processTableFromEntries({ self: 100, entries: workstation })))
  );

  it.effect("stops at an unreadable parent and at a repeated pid", () =>
    Effect.gen(function* () {
      expect(pidsOf(yield* processLineage(300))).toEqual([300]);
      expect(pidsOf(yield* processLineage(400))).toEqual([400, 401]);
      expect(pidsOf(yield* processLineage(999))).toEqual([]);
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
      assertTrue(yield* descendsFromProcess(81, 60));
      assertTrue(yield* descendsFromProcess(100, 60));
      assertTrue(yield* descendsFromProcess(60, 60));
      assertFalse(yield* descendsFromProcess(90, 60));
      assertFalse(yield* descendsFromProcess(200, 60));
      assertFalse(yield* descendsFromProcess(999, 60));
      assertTrue(yield* descendsFromProcess(60)(81));
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
      expect(O.getOrThrow(yield* table.pids)).toEqual([100, 80]);
      expect(O.getOrThrow(yield* table.cwd(100))).toBe("/lane");
      expect(yield* table.descriptors(80)).toEqual(["/lane/held.log"]);
      expect(O.getOrThrow(yield* table.status(7)).command).toBe("scripted");
      assertNone(yield* table.status(100));
    })
  );

  it.effect("scans attachments through a scripted table", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.realPath(yield* fs.makeTempDirectoryScoped({ prefix: "process-table-scan-" }));
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
      const own = O.getOrThrow(yield* procProcessTable.status(process.pid));
      expect(own.parent).toBe(process.ppid);
      expect(own.command.length).toBeGreaterThan(0);
      const lineage = yield* processLineage(process.pid);
      expect(pidsOf(lineage)).toContain(process.ppid);
      const root = yield* invokerSessionRoot();
      expect(pidsOf(lineage)).toContain(root.pid);
      assertTrue(yield* descendsFromProcess(process.pid, root.pid));
    })
  );
});
