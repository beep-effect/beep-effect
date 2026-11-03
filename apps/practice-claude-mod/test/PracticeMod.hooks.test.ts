import { VerdictRow } from "@beep/law-practice-domain/values";
import { it } from "@beep/test-runner";
import { beforeEach, describe, expect, vi } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeModHost } from "@/PracticeMod.host";
import type { Engine } from "claude-code";

const VerdictRows = S.Array(VerdictRow);
const decodeUnknownVerdictRowArray = S.decodeUnknownEffect(VerdictRows);
const decodeUnknownVerdictRowArrayOption = S.decodeUnknownOption(VerdictRows);

const fixture = () => {
  const store = MutableHashMap.empty<string, unknown>();
  const engine = {
    plugin: { name: "oip-practice", root: "/plugin" },
    ui: {
      resolve: vi.fn<Engine["ui"]["resolve"]>(() => elements),
      invalidate: vi.fn<Engine["ui"]["invalidate"]>(),
      toast: vi.fn<Engine["ui"]["toast"]>(),
      status: vi.fn<Engine["ui"]["status"]>(),
    },
    command: { register: vi.fn<Engine["command"]["register"]>().mockResolvedValue(undefined) },
    store: {
      get: vi.fn<Engine["store"]["get"]>((key) => Promise.resolve(O.getOrUndefined(MutableHashMap.get(store, key)))),
      set: vi.fn<Engine["store"]["set"]>((key, value) => {
        MutableHashMap.set(store, key, value);
        return Promise.resolve();
      }),
    },
    fs: { write: vi.fn<Engine["fs"]["write"]>().mockResolvedValue(undefined) },
    mcp: { call: vi.fn<Engine["mcp"]["call"]>().mockResolvedValue({ content: [], isError: false }) },
    session: {
      id: vi.fn<Engine["session"]["id"]>().mockResolvedValue("s-1"),
      messages: vi.fn<Engine["session"]["messages"]>().mockResolvedValue([
        { role: "user", text: "Which matter is 10008US01?" },
        { role: "assistant", text: "An earlier answer." },
      ]),
    },
    clock: {
      now: vi.fn<Engine["clock"]["now"]>().mockResolvedValue(1000),
      every: vi.fn<Engine["clock"]["every"]>(() => ({ cancel: () => undefined })),
    },
  } satisfies Engine;
  // The engine owns opaque render elements; these spies inspect its requested props.
  const elements = {
    Box: vi.fn<ReturnType<Engine["ui"]["resolve"]>["Box"]>(),
    Text: vi.fn<ReturnType<Engine["ui"]["resolve"]>["Text"]>(),
    Button: vi.fn<ReturnType<Engine["ui"]["resolve"]>["Button"]>(),
  };
  return { engine, store, elements };
};

const abovePrompt = {
  surface: "terminal" as const,
  component: "AbovePrompt" as const,
  requestId: "request-1",
  props: { isWorking: false, maxRows: 3, bodyColumns: 100 },
};

beforeEach(() => vi.resetModules());

describe("practice hook host boundaries", { concurrent: false }, () => {
  it.effect(
    "registers the public commands and refuses a verdict before an answer",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine } = fixture();
      yield* Effect.promise(hooks.registerCommands(engine));
      expect(A.map(engine.command.register.mock.calls, ([command]) => command.name)).toEqual([
        "matter",
        "time",
        "right",
        "wrong",
        "partly",
        "practice",
      ]);
      const promise1 = yield* Effect.promise(() => hooks.verdictCommand(engine)("wrong", ""));
      expect(promise1).toEqual({
        text: "There is no answer to mark yet.",
      });
      expect(hooks.verdictBand(engine)(abovePrompt)).toBeUndefined();
      expect(engine.store.set).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "ignores aborted and child turns, then records and undoes the main answer",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine, store, elements } = fixture();
      const answer = { answer: "12345.10008US01", turnId: "t-1", isAborted: false };
      yield* Effect.promise(() => hooks.rememberAnswer(engine)({ ...answer, isAborted: true }));
      yield* Effect.promise(() => hooks.rememberAnswer(engine)({ ...answer, agentId: "child" }));
      expect(engine.session.messages).not.toHaveBeenCalled();
      yield* Effect.promise(() => hooks.rememberAnswer(engine)(answer));
      const promise2 = yield* Effect.promise(() =>
        hooks.verdictCommand(engine)("wrong", "  missed the continuation  ")
      );
      expect(promise2).toEqual({
        text: "Saved: Wrong",
      });
      hooks.verdictBand(engine)(abovePrompt);
      expect(A.map(elements.Button.mock.calls, ([props]) => props.label)).toEqual(["Right", "Wrong", "Partly", "Undo"]);
      expect(elements.Text).toHaveBeenCalledWith({ dimColor: true, children: "Saved: Wrong" });
      const promise3 = yield* Effect.promise(() => hooks.practiceCommand(engine)("undo"));
      expect(promise3).toEqual({ text: "Undone" });
      const rows = yield* store.pipe(
        MutableHashMap.get("verdict-rows/v2"),
        O.getOrUndefined,
        decodeUnknownVerdictRowArray
      );
      expect(A.map(rows, (row) => row.revision)).toEqual([1, 2]);
      expect(A.map(rows, (row) => row.verdict)).toEqual(["wrong", "withdrawn"]);
      assertSome(A.getUnsafe(rows, 0).note, "missed the continuation");
      const exported = yield* Effect.promise(() => hooks.practiceCommand(engine)("export"));
      expect(exported.text).toMatch(/^Copy these JSONL rows into files you choose\./);
      expect(exported.text).toContain('"revision":1');
      expect(exported.text).toContain('"batchId":"session:s-1"');
      expect(exported.text).toContain('"recordedAt":1000');
      yield* Effect.promise(() => hooks.verdictCommand(engine)("right", ""));
      const undo = A.findFirst(elements.Button.mock.calls, ([props]) => props.label === "Undo");
      assertSome(
        O.map(undo, ([props]) => props.label),
        "Undo"
      );
      O.map(undo, ([props]) =>
        props.onPress({ plugin: "oip-practice", element: "verdict-undo", requestId: "request-1", surface: "terminal" })
      );
      yield* Effect.promise(() =>
        vi.waitFor(() => {
          const savedRows = store.pipe(
            MutableHashMap.get("verdict-rows/v2"),
            O.getOrUndefined,
            decodeUnknownVerdictRowArrayOption
          );
          assertSome(
            O.map(savedRows, (values) => A.map(values, (row) => row.verdict)),
            ["wrong", "withdrawn", "right", "withdrawn"]
          );
        })
      );

      expect(engine.fs.write).not.toHaveBeenCalled();
      const promise4 = yield* Effect.promise(() => hooks.practiceCommand(engine)("unknown"));
      expect(promise4).toEqual({
        text: "Use /practice export, /practice undo, or /practice raw.",
      });
    })
  );

  it.effect(
    "serializes first-read migration during overlapping export and record dispatches",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine, store } = fixture();
      const legacy = [
        {
          schemaVersion: "practice-verdict/v1",
          itemId: "kg-answer:s-1:t-1",
          verdict: "wrong",
          note: null,
          revision: 0,
          recordedAt: "1970-01-01T00:00:00.000Z",
          lockedAt: null,
        },
      ];
      MutableHashMap.set(store, "verdict-rows", legacy);
      yield* Effect.promise(() => hooks.rememberAnswer(engine)({ answer: "Answer", turnId: "t-1", isAborted: false }));
      yield* Effect.promise(() =>
        Promise.all([hooks.practiceCommand(engine)("export"), hooks.verdictCommand(engine)("right", "")])
      );
      const rows = yield* store.pipe(
        MutableHashMap.get("verdict-rows/v2"),
        O.getOrUndefined,
        decodeUnknownVerdictRowArray
      );
      expect(A.map(rows, (row) => row.verdict)).toEqual(["wrong", "right"]);
      expect(A.map(rows, (row) => row.revision)).toEqual([1, 2]);
      assertSome(MutableHashMap.get(store, "verdict-rows"), legacy);
    })
  );

  it.effect(
    "reports save and export failures through their user-visible boundaries",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine } = fixture();
      yield* Effect.promise(() => hooks.rememberAnswer(engine)({ answer: "answer", turnId: "t-1", isAborted: false }));
      engine.store.set.mockRejectedValue("disk full");
      const promise5 = yield* Effect.promise(() => hooks.verdictCommand(engine)("right", ""));
      expect(promise5).toEqual({
        text: "The verdict could not be saved. Try again.",
      });
      expect(engine.ui.toast).toHaveBeenCalledWith("The verdict could not be saved. Try again.");
      engine.store.get.mockRejectedValue("read denied");
      const promise6 = yield* Effect.promise(() => hooks.practiceCommand(engine)("export"));
      expect(promise6).toEqual({
        text: "The practice logs could not be exported. Try again.",
      });
      expect(engine.fs.write).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "preserves engine rows for other servers and supports raw, running, and failed rows",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine, elements } = fixture();
      const row = {
        surface: "terminal" as const,
        component: "ToolUse" as const,
        requestId: "request-1",
        props: {
          tool_use_id: "tu-1",
          tool: "mcp__practice-kg__kg_matter_lookup",
          input: { reference: "12345.10008US01" },
          isRunning: false,
          isErrored: false,
          isInterrupted: false,
        },
      };
      hooks.configure({ servers: [] });
      hooks.toolRow(engine)(row);
      expect(elements.Text).toHaveBeenLastCalledWith({ children: "Looking up matter 12345.10008US01" });
      hooks.toolRow(engine)({ ...row, props: { ...row.props, isRunning: true } });
      expect(elements.Text).toHaveBeenLastCalledWith({
        dimColor: true,
        children: "Looking up matter 12345.10008US01...",
      });
      hooks.toolRow(engine)({ ...row, props: { ...row.props, isErrored: true } });
      expect(elements.Text).toHaveBeenLastCalledWith({
        color: "red",
        children: "Looking up matter 12345.10008US01 (failed)",
      });
      elements.Text.mockClear();
      hooks.toolRow(engine)({ ...row, props: { ...row.props, tool: "mcp__other__kg_find" } });
      expect(elements.Text).not.toHaveBeenCalled();
      const promise7 = yield* Effect.promise(() => hooks.practiceCommand(engine)("raw"));
      expect(promise7).toEqual({
        text: "Showing the raw tool calls.",
      });
      hooks.toolRow(engine)(row);
      expect(elements.Text).not.toHaveBeenCalled();
      const promise8 = yield* Effect.promise(() => hooks.practiceCommand(engine)("raw"));
      expect(promise8).toEqual({
        text: "Showing tool calls in plain language.",
      });
      hooks.configure({ servers: ["other"] });
      hooks.toolRow(engine)(row);
      expect(elements.Text).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "maps rejected engine operations to their typed operation identity",
    Effect.fnUntraced(function* () {
      const { engine } = fixture();
      const host = makeModHost(engine);
      const cases = [
        { operation: "store-get", program: host.storeGet("key"), mock: engine.store.get },
        { operation: "store-set", program: host.storeSet("key", "value"), mock: engine.store.set },
        { operation: "session-id", program: host.sessionId, mock: engine.session.id },
        { operation: "clock", program: host.now, mock: engine.clock.now },
      ];
      for (const row of cases) {
        row.mock.mockRejectedValue("denied");
        const result = yield* row.program.pipe(Effect.result);
        expect(result).toMatchObject({
          _tag: "Failure",
          failure: { _tag: "ModHostError", operation: row.operation, message: "denied" },
        });
      }
    })
  );

  it.effect(
    "shows, looks up, and clears the selected matter with a visible lookup failure",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine } = fixture();
      const promise9 = yield* Effect.promise(() => hooks.matterCommand(engine)(""));
      expect(promise9).toEqual({
        text: "No matter is selected.",
      });
      engine.mcp.call.mockResolvedValue({
        content: [],
        isError: false,
        structuredContent: { data: { columns: ["familyKey", "docketKey", "resolution", "client"], rows: [] } },
      });
      const promise10 = yield* Effect.promise(() => hooks.matterCommand(engine)("10008US01"));
      expect(promise10).toEqual({
        text: "No matter matches 10008US01.",
      });
      expect(engine.mcp.call).toHaveBeenCalledWith("practice-kg", "kg_matter_lookup", {
        reference: "10008US01",
      });
      engine.mcp.call.mockResolvedValueOnce({
        content: [],
        isError: false,
        structuredContent: {
          data: {
            columns: ["familyKey", "docketKey", "resolution", "client"],
            rows: [["12345.10008", "12345.10008US01", "unique", "12345"]],
          },
        },
      });
      const promise11 = yield* Effect.promise(() => hooks.matterCommand(engine)("10008US01"));
      expect(promise11).toEqual({
        text: "Matter: 12345.10008US01",
      });
      const promise12 = yield* Effect.promise(() => hooks.matterCommand(engine)(""));
      expect(promise12).toEqual({
        text: "Matter: 12345.10008US01",
      });
      engine.mcp.call.mockRejectedValueOnce("unavailable");
      const promise13 = yield* Effect.promise(() => hooks.matterCommand(engine)("10008US01"));
      expect(promise13).toEqual({
        text: "The matter could not be looked up. Try again.",
      });
      expect(engine.ui.toast).toHaveBeenCalledWith("The matter could not be looked up. Try again.");
      const promise14 = yield* Effect.promise(() => hooks.matterCommand(engine)("clear"));
      expect(promise14).toEqual({ text: "Matter cleared." });
    })
  );

  it.effect(
    "starts, reports, and stops a timer while preserving a failed stop for retry",
    Effect.fnUntraced(function* () {
      const hooks = yield* Effect.promise(() => import("@/PracticeMod.hooks"));
      const { engine } = fixture();
      const promise15 = yield* Effect.promise(() => hooks.timeCommand(engine)("stop"));
      expect(promise15).toEqual({ text: "Timer is stopped." });
      const promise16 = yield* Effect.promise(() => hooks.timeCommand(engine)("start"));
      expect(promise16).toEqual({ text: "Timer started." });
      const promise17 = yield* Effect.promise(() => hooks.timeCommand(engine)("start"));
      expect(promise17).toEqual({
        text: "Timer is already running.",
      });
      const promise18 = yield* Effect.promise(() => hooks.timeCommand(engine)(""));
      expect(promise18).toEqual({ text: "Timer running: 0 minutes." });
      engine.store.set.mockRejectedValueOnce("disk full");
      const promise19 = yield* Effect.promise(() => hooks.timeCommand(engine)("stop"));
      expect(promise19).toEqual({
        text: "The timer could not be saved or updated. Try again.",
      });
      const promise20 = yield* Effect.promise(() => hooks.timeCommand(engine)(""));
      expect(promise20).toEqual({ text: "Timer running: 0 minutes." });
      const promise21 = yield* Effect.promise(() => hooks.timeCommand(engine)("stop"));
      expect(promise21).toEqual({
        text: "Timer stopped. Interval saved.",
      });
      const promise22 = yield* Effect.promise(() => hooks.timeCommand(engine)(""));
      expect(promise22).toEqual({ text: "Timer is stopped." });
      const promise23 = yield* Effect.promise(() => hooks.timeCommand(engine)("unknown"));
      expect(promise23).toEqual({
        text: "Use /time, /time start, or /time stop.",
      });
    })
  );
});
