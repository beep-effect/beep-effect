import {
  currentRegisterRows,
  decodeRegister,
  layerOrchestratorRegisterMemory,
  OrchestratorRegister,
  PrRepository,
  RegisterRow,
  RegisterRowJson,
  registerRowsWaiting,
  renderRegisterMarkdown,
  renderSessionOrchestrator,
  SessionLedgerRow,
  SessionLedgerRowJson,
  sessionOrchestrator,
} from "@beep/repo-cli/test/Session";
import { describe, expect, it } from "@effect/vitest";
import { DateTime, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Str from "effect/String";

const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });

const ledgerRow = (
  overrides: Partial<{
    checkout: string;
    state: "open" | "blocked" | "done";
    role: O.Option<"orchestrator" | "member">;
    recordedAt: number;
    sessionId: O.Option<string>;
  }> = {}
) =>
  SessionLedgerRow.make({
    schemaVersion: "session-ledger/v1",
    repository,
    clone: "/work/beep-effect",
    checkout: overrides.checkout ?? "/work/beep-effect-worktrees/lane",
    lane: "lane",
    branch: "feat/lane",
    state: overrides.state ?? "open",
    next: "resume",
    summary: O.none(),
    pr: O.none(),
    harness: "claude-code",
    sessionId: overrides.sessionId ?? O.none(),
    recordedAt: DateTime.makeUnsafe(overrides.recordedAt ?? 0),
    role: overrides.role ?? O.none(),
  });

describe("session ledger role", () => {
  it("decodes rows written before the role existed as role none", () => {
    const legacy = JSON.stringify({
      schemaVersion: "session-ledger/v1",
      repository,
      clone: "/work/beep-effect",
      checkout: "/work/beep-effect-worktrees/lane",
      lane: "lane",
      branch: "feat/lane",
      state: "open",
      next: "resume",
      summary: null,
      pr: null,
      harness: "claude-code",
      sessionId: null,
      recordedAt: "2026-10-06T00:00:00.000Z",
    });
    const decoded = SessionLedgerRowJson.decodeOption(legacy);
    expect(O.isSome(decoded)).toBe(true);
    if (O.isSome(decoded)) expect(decoded.value.role).toEqual(O.none());
  });

  it.effect("round-trips the role through JSON Lines", () =>
    Effect.gen(function* () {
      const encoded = yield* SessionLedgerRowJson.encode(ledgerRow({ role: O.some("orchestrator") }));
      expect(encoded).toContain('"role":"orchestrator"');
      const decoded = SessionLedgerRowJson.decodeOption(encoded);
      expect(O.map(decoded, (row) => row.role)).toEqual(O.some(O.some("orchestrator")));
    })
  );

  it("names the newest open orchestrator row and ignores done or member rows", () => {
    expect(sessionOrchestrator([])).toEqual(O.none());
    const rows = [
      ledgerRow({ checkout: "/a", role: O.some("orchestrator"), recordedAt: 10, sessionId: O.some("old") }),
      ledgerRow({ checkout: "/a", role: O.some("member"), recordedAt: 20, sessionId: O.some("old") }),
      ledgerRow({ checkout: "/b", role: O.some("orchestrator"), recordedAt: 15, sessionId: O.some("new") }),
      ledgerRow({ checkout: "/c", role: O.some("orchestrator"), recordedAt: 30, state: "done" }),
    ];
    expect(O.flatMap(sessionOrchestrator(rows), (row) => row.sessionId)).toEqual(O.some("new"));
    expect(renderSessionOrchestrator(sessionOrchestrator(rows))).toContain("session new since ");
    const anonymous = ledgerRow({ checkout: "/x", role: O.some("orchestrator"), recordedAt: 40 });
    expect(renderSessionOrchestrator(O.some(anonymous))).toContain("session unknown since ");
  });
});

const registerRow = (
  overrides: Partial<{
    kind: RegisterRow["kind"];
    address: string;
    state: RegisterRow["state"];
    waiting: O.Option<string>;
    recordedAt: number;
    orphanPlan: string;
  }> = {}
) =>
  RegisterRow.make({
    schemaVersion: "orchestrator-register/v1",
    repository,
    kind: overrides.kind ?? "desktop-session",
    address: overrides.address ?? "local_0001",
    name: O.some("B email tagging"),
    owns: ["PR #1464", "lane practice-mail-tagging"],
    state: overrides.state ?? "active",
    waitingOnOrchestrator: overrides.waiting ?? O.none(),
    lastContact: O.some(DateTime.makeUnsafe(overrides.recordedAt ?? 0)),
    orphanPlan: overrides.orphanPlan ?? "SendMessage once; after 1h silence take #1464 over in its lane",
    note: O.none(),
    recordedBy: O.some("orch-1"),
    recordedAt: DateTime.makeUnsafe(overrides.recordedAt ?? 0),
  });

describe("orchestrator register", () => {
  it("keeps the newest row per kind+address and drops retired units", () => {
    const rows = [
      registerRow({ address: "local_0001", recordedAt: 1, state: "active" }),
      registerRow({ address: "local_0001", recordedAt: 2, state: "blocked", waiting: O.some("merge #1464") }),
      registerRow({ address: "PR #1468", kind: "codex-lane", recordedAt: 3 }),
      registerRow({ address: "PR #1468", kind: "codex-lane", recordedAt: 4, state: "retired" }),
      registerRow({ address: "local_0001", kind: "in-process-agent", recordedAt: 5 }),
    ];
    const current = currentRegisterRows(rows);
    expect(A.map(current, (row) => `${row.kind} ${row.address} ${row.state}`)).toEqual([
      "in-process-agent local_0001 active",
      "desktop-session local_0001 blocked",
    ]);
    expect(A.map(registerRowsWaiting(rows), (row) => row.address)).toEqual(["local_0001"]);
  });

  it("renders the Markdown table HANDOFF.md embeds, escaping pipes and newlines", () => {
    const table = renderRegisterMarkdown([
      registerRow({
        address: "PR #1443",
        kind: "codex-lane",
        orphanPlan: "post 'orchestrator: ...' | wait 2h\nthen take over",
      }),
    ]);
    const lines = Str.split(table, "\n");
    expect(lines[0]).toBe(
      "| kind | address | name | owns | state | waiting on orchestrator | last contact | orphan plan |"
    );
    expect(lines[2]).toContain(
      "| codex-lane | PR #1443 | B email tagging | PR #1464, lane practice-mail-tagging | active |  | 1970-01-01T00:00:00.000Z |"
    );
    expect(lines[2]).toContain("post 'orchestrator: ...' \\| wait 2h then take over |");
    expect(lines).toHaveLength(3);
  });

  it.effect("round-trips a row and tolerates a corrupt line", () =>
    Effect.gen(function* () {
      const encoded = yield* RegisterRowJson.encode(registerRow({ waiting: O.some("final sha") }));
      const decoded = decodeRegister(`${encoded}\n{not json}\n\n${encoded}\n`);
      expect(decoded.rows).toHaveLength(2);
      expect(decoded.corruptLineCount).toBe(1);
      expect(decoded.rows[0]?.waitingOnOrchestrator).toEqual(O.some("final sha"));
    })
  );
});

it.layer(Layer.fresh(layerOrchestratorRegisterMemory))("orchestrator register memory layer", (it) => {
  it.effect("appends and lists per repository", () =>
    Effect.gen(function* () {
      const register = yield* OrchestratorRegister;
      yield* register.append(registerRow({ address: "a" }));
      yield* register.append(
        RegisterRow.make({
          ...registerRow({ address: "b" }),
          repository: PrRepository.make({ host: "github.com", owner: "other", name: "repo" }),
        })
      );
      const rows = yield* register.list(repository);
      expect(A.map(rows, (row) => row.address)).toEqual(["a"]);
    })
  );
});
