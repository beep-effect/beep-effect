import {
  convertRegisterRow,
  currentRulings,
  HandoffRenderInput,
  handoffBackupName,
  lastJournalLine,
  PrRepository,
  parseHandoffDocument,
  RegisterConvertInput,
  RegisterRow,
  RulingDate,
  RulingId,
  RulingRow,
  renderHandoff,
  renderRulingsMarkdown,
  rulingsFileName,
  rulingsInForce,
} from "@beep/repo-cli/test/Session";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });

const ruling = (overrides: Partial<Parameters<typeof RulingRow.make>[0]> = {}) =>
  RulingRow.make({
    schemaVersion: "orchestrator-ruling/v1",
    repository,
    id: "only-money-escalates",
    date: "2026-10-06",
    verbatim: "only money escalates",
    source: "AGENTS.md Autonomy",
    state: "in-force",
    supersededBy: O.none(),
    note: O.none(),
    recordedBy: O.none(),
    recordedAt: DateTime.makeUnsafe(0),
    ...overrides,
  });

const unit = (overrides: Partial<Parameters<typeof RegisterRow.make>[0]> = {}) =>
  RegisterRow.make({
    schemaVersion: "orchestrator-register/v1",
    repository,
    kind: "in-process-agent",
    address: "agent-1",
    name: O.some("fixer"),
    owns: ["PR #7"],
    state: "active",
    waitingOnOrchestrator: O.some("final sha"),
    lastContact: O.some(DateTime.makeUnsafe(1)),
    orphanPlan: "relaunch from brief",
    note: O.none(),
    recordedBy: O.none(),
    recordedAt: DateTime.makeUnsafe(2),
    ...overrides,
  });

const input = (overrides: Partial<Parameters<typeof HandoffRenderInput.make>[0]> = {}) =>
  HandoffRenderInput.make({
    repository,
    writtenAt: DateTime.makeUnsafe("2026-11-06T19:00:00Z"),
    holder: O.none(),
    rulings: [],
    register: [],
    gateSnapshot: O.none(),
    journalLine: O.none(),
    existing: O.none(),
    ...overrides,
  });

const headings = (text: string) => A.filter(Str.split(text, "\n"), Str.startsWith("## "));

describe("HANDOFF.md parsing", () => {
  it("splits at level-two headings outside fences and keeps the preamble", () => {
    const doc = parseHandoffDocument(
      "# Title\n\nHolder: x\n\n## Recipes\n\n```bash\n## not a heading\n```\n\n## Broadcast\n\n> hi\n"
    );
    expect(doc.preamble).toStrictEqual(["# Title", "", "Holder: x", ""]);
    expect(A.map(doc.sections, (section) => section.title)).toStrictEqual(["Recipes", "Broadcast"]);
    expect(doc.sections[0]?.body).toBe("```bash\n## not a heading\n```");
  });
});

describe("HANDOFF.md rendering", () => {
  it("writes every template section in order, with placeholders, on a first render", () => {
    const text = renderHandoff(input());
    expect(Str.split(text, "\n")[0]).toBe(
      "# Orchestrator hand-off — beep-effect/beep-effect — written 2026-11-06T19:00:00.000Z"
    );
    expect(text).toContain("Holder: none recorded in the session ledger.");
    expect(text).toContain("Holder thread: unrecorded.");
    expect(text).toContain("carried over unchanged from the file written never (first render).");
    expect(text).toContain("Rule: this file is rewritten at every stopping point");
    expect(headings(text)).toStrictEqual([
      "## Rulings in force",
      "## Gate snapshot",
      '## Outstanding "final" promises',
      "## Pending operator decisions",
      "## Operator-hands items",
      "## Next actions (ordered)",
      "## Recipes",
      "## Register",
      "## Communication routes",
      "## Broadcast",
      "## Journal pointer",
    ]);
    expect(text).toContain("`STATE.md` last line at write time: none read.");
    expect(Str.endsWith("\n")(text)).toBe(true);
  });

  it("keeps an existing rulings section while the store has no ruling in force", () => {
    const existing = "# old\n\n## Rulings in force (dated)\n\n| Date | Ruling |\n| 2026-10-06 | hand-typed |\n";
    const kept = renderHandoff(input({ existing: O.some(existing), rulings: [ruling({ state: "superseded" })] }));
    expect(kept).toContain("## Rulings in force (dated)\n\n| Date | Ruling |\n| 2026-10-06 | hand-typed |");
    const generated = renderHandoff(input({ existing: O.some(existing), rulings: [ruling()] }));
    expect(generated).toContain("Rendered from `session ruling list`");
    expect(generated).toContain('| 2026-10-06 | "only money escalates" | AGENTS.md Autonomy |');
  });

  it("puts sections the template does not know after the broadcast and before the journal", () => {
    const text = renderHandoff(
      input({ existing: O.some("# old\n\n## Scratch\n\nnotes\n"), journalLine: O.some("- last line") })
    );
    const order = headings(text);
    expect(A.takeRight(order, 3)).toStrictEqual(["## Broadcast", "## Scratch", "## Journal pointer"]);
    expect(text).toContain("> - last line");
  });

  it("renders the register from rows, dropping retired units", () => {
    const text = renderHandoff(
      input({ register: [unit(), unit({ address: "agent-2", state: "retired", recordedAt: DateTime.makeUnsafe(3) })] })
    );
    expect(text).toContain("| in-process-agent | agent-1 | fixer | PR #7 | active | final sha |");
    expect(text).not.toContain("agent-2");
  });
});

describe("HANDOFF.md carry-over", () => {
  const handWritten =
    "# Orchestrator hand-off — beep-effect — written 2026-11-03T07:38Z, taken over\n\nHolder: T3 session x\nHolder thread: t3://thread/x\n\n## Register\n\n| kind | address |\n| claude-session | local_1 |\n";

  it("keeps hand-written register rows under a carried-over heading, once, across renders", () => {
    const first = renderHandoff(input({ existing: O.some(handWritten), register: [unit()] }));
    expect(first).toContain("| in-process-agent | agent-1 |");
    expect(first).toContain("**Carried over** from the hand-written section");
    expect(first).toContain("| claude-session | local_1 |");
    const second = renderHandoff(input({ existing: O.some(first), register: [unit()] }));
    expect(Str.split(second, "**Carried over**").length).toBe(2);
    expect(second).toContain("| claude-session | local_1 |");
    // Once the holder deletes the carried block, a re-render carries nothing.
    const cleaned = Str.replace(/\*\*Carried over\*\*[\s\S]*?(?=\n## )/u, "")(second);
    expect(renderHandoff(input({ existing: O.some(cleaned), register: [unit()] }))).not.toContain("**Carried over**");
  });

  it("keeps hand-typed rulings when the store starts recording them", () => {
    const existing = "# old\n\n## Rulings in force\n\n| 2026-10-24 | hand-typed root-cause ruling |\n";
    const text = renderHandoff(input({ existing: O.some(existing), rulings: [ruling()] }));
    expect(text).toContain('| 2026-10-06 | "only money escalates" | AGENTS.md Autonomy |');
    expect(text).toContain("| 2026-10-24 | hand-typed root-cause ruling |");
  });

  it("keeps the holder thread line, replaces the rendered line, and names the prior write", () => {
    const first = renderHandoff(input({ existing: O.some(handWritten) }));
    expect(first).toContain("Holder thread: t3://thread/x");
    expect(first).not.toContain("Holder thread: unrecorded");
    expect(first).toContain("carried over unchanged from the file written 2026-11-03T07:38Z.");
    const second = renderHandoff(
      input({ existing: O.some(first), writtenAt: DateTime.makeUnsafe("2026-11-07T00:00:00Z") })
    );
    expect(Str.split(second, "Rendered by `session handoff`").length).toBe(2);
    expect(second).toContain("carried over unchanged from the file written 2026-11-06T19:00:00.000Z.");
  });
});

describe("HANDOFF.md file helpers", () => {
  it("names the backup by the write instant to the second", () => {
    expect(handoffBackupName(DateTime.makeUnsafe("2026-11-06T09:05:07.123Z"))).toBe("HANDOFF.20261106T090507Z.bak.md");
  });

  it("reads the journal's last non-blank line", () => {
    expect(O.getOrNull(lastJournalLine("- a\n- b  \n\n"))).toBe("- b");
    expect(O.isNone(lastJournalLine("\n\n"))).toBe(true);
  });
});

describe("orchestrator rulings", () => {
  it("keeps the newest row per ruling, newest date first, and drops superseded ones in force", () => {
    const rows = [
      ruling({ id: "a", date: "2026-10-06", recordedAt: DateTime.makeUnsafe(1) }),
      ruling({ id: "b", date: "2026-10-24", recordedAt: DateTime.makeUnsafe(2) }),
      ruling({
        id: "a",
        date: "2026-10-06",
        state: "superseded",
        supersededBy: O.some("b"),
        recordedAt: DateTime.makeUnsafe(3),
      }),
    ];
    expect(A.map(currentRulings(rows), (row) => [row.id, row.state])).toStrictEqual([
      ["b", "in-force"],
      ["a", "superseded"],
    ]);
    expect(A.map(rulingsInForce(rows), (row) => row.id)).toStrictEqual(["b"]);
  });

  it("escapes pipes and newlines in the rendered table", () => {
    const table = renderRulingsMarkdown([ruling({ verbatim: "a | b\nc", note: O.some("scope") })]);
    expect(table).toContain('| 2026-10-06 | "a \\| b c" (scope) | AGENTS.md Autonomy |');
  });

  it("validates ruling ids and dates and names the rulings file", () => {
    expect(S.is(RulingId)("fix-at-root")).toBe(true);
    expect(S.is(RulingId)("fix--root")).toBe(false);
    expect(S.is(RulingDate)("2026-1-1")).toBe(false);
    expect(rulingsFileName(repository)).toBe("github.com__beep-effect__beep-effect.rulings.jsonl");
  });
});

describe("register conversion", () => {
  const convert = (overrides: Partial<Parameters<typeof RegisterConvertInput.make>[0]> = {}) =>
    convertRegisterRow(
      RegisterConvertInput.make({
        source: O.some(unit()),
        target: O.none(),
        toKind: "desktop-session",
        toAddress: "t3://thread/abc",
        brief: O.none(),
        now: DateTime.makeUnsafe(10),
        ...overrides,
      })
    );

  it("retires the source and carries its owns, ask and orphan plan to the target", () => {
    const result = convert();
    expect(Result.isSuccess(result)).toBe(true);
    if (Result.isFailure(result)) return;
    const { retire, successor } = result.success;
    expect([retire.kind, retire.address, retire.state]).toStrictEqual(["in-process-agent", "agent-1", "retired"]);
    expect(O.getOrNull(retire.note)).toBe("converted to desktop-session t3://thread/abc");
    expect([successor.kind, successor.address, successor.state]).toStrictEqual([
      "desktop-session",
      "t3://thread/abc",
      "active",
    ]);
    expect(successor.owns).toStrictEqual(["PR #7"]);
    expect(O.getOrNull(successor.waitingOnOrchestrator)).toBe("final sha");
    expect(successor.orphanPlan).toBe("relaunch from brief");
    expect(O.map(successor.lastContact, DateTime.toEpochMillis)).toStrictEqual(O.some(10));
    expect(O.getOrNull(successor.note)).toBe("converted from in-process-agent agent-1");
  });

  it("a retired target row does not block the conversion", () => {
    expect(
      Result.isSuccess(
        convert({ target: O.some(unit({ kind: "desktop-session", address: "t3://thread/abc", state: "retired" })) })
      )
    ).toBe(true);
  });

  it("refuses each conversion it cannot make", () => {
    const refusal = (overrides: Partial<Parameters<typeof RegisterConvertInput.make>[0]>) =>
      Result.match(convert(overrides), { onFailure: (failure) => failure, onSuccess: () => "converted" });
    expect(refusal({ source: O.none() })).toBe("not-registered");
    expect(refusal({ source: O.some(unit({ state: "retired" })) })).toBe("already-retired");
    expect(refusal({ toKind: "in-process-agent", toAddress: "agent-9" })).toBe("target-in-process");
    expect(
      refusal({ toKind: "background-job", toAddress: "agent-1", source: O.some(unit({ kind: "background-job" })) })
    ).toBe("same-unit");
    expect(refusal({ target: O.some(unit({ kind: "desktop-session", address: "t3://thread/abc" })) })).toBe(
      "target-registered"
    );
  });
});
