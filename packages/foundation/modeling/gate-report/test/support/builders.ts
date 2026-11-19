// Builders shared by the gate report tests: items, reports, events, the agent
// budget, a pointer table and a one-call projection.

import { ConsoleBudget, GatePointers, RecordPaths } from "@beep/gate-report/ConsoleDocument";
import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateReport, Totals } from "@beep/gate-report/GateReport";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { projectLines } from "@beep/gate-report/PlainText";
import { reduceEvents } from "@beep/gate-report/Reducer";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import type { RunDelta } from "@beep/gate-report/ConsoleDocument";

export const epoch = DateTime.makeUnsafe(0);

export const FILE = "src/math.test.ts";

type ItemInput = Parameters<typeof Item.make>[0];

type TestItemInput = Partial<ItemInput> & { readonly name: string; readonly outcome: Item["outcome"] };

export const testItem = (input: TestItemInput): Item =>
  Item.make({
    key: ItemKey.cases.TestKey.make({ file: FILE, fullName: `math > ${input.name}` }),
    unit: FILE,
    path: ["math"],
    ...input,
  });

export const failedTest = (input: Partial<ItemInput> & { readonly name: string; readonly message: string }): Item => {
  const { message, ...rest } = input;
  return testItem({
    outcome: "failed",
    location: Location.makeOption({ file: FILE, line: 12, column: 5 }),
    detail: ItemDetail.makeOption({ message, diff: O.some("- expected\n+ received") }),
    ...rest,
  });
};

type ReportInput = Parameters<typeof GateReport.make>[0];

export const makeReport = (overrides: Partial<ReportInput> = {}): GateReport =>
  GateReport.make({
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    runId: "20261119T100000Z-1",
    startedAt: epoch,
    durationMs: 1200,
    inputFingerprint: "fingerprint",
    reason: "passed",
    outcome: "all-pass",
    units: [],
    items: [],
    totals: Totals.make({ collected: 3, passed: 3 }),
    ...overrides,
  });

export const E = GateEvent.cases;

export const runStarted = (overrides: Partial<Parameters<typeof E.RunStarted.make>[0]> = {}): GateEvent =>
  E.RunStarted.make({
    runId: "r1",
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    startedAt: epoch,
    inputFingerprint: "fingerprint",
    ...overrides,
  });

export const runFinished = (overrides: Partial<Parameters<typeof E.RunFinished.make>[0]> = {}): GateEvent =>
  E.RunFinished.make({ durationMs: 100, reason: "passed", exitCode: O.some(0), ...overrides });

export const finished = (item: Item): GateEvent => E.ItemFinished.make({ item });

/** Reduce events that describe a whole run, failing the test otherwise. */
export const reduce = (events: ReadonlyArray<GateEvent>): GateReport =>
  Result.getOrThrowWith(reduceEvents(events), (error) => error);

export const agentBudget = ConsoleBudget.make({ maxChars: 8000, maxLineChars: 240, maxDiffLines: 12 });

export const pointerTable = {
  test: GatePointers.make({
    failure: "beep gate show test",
    flaky: O.some("beep gate show test --flaky"),
    policy: O.some("beep gate show test --policy"),
    warnings: O.some("beep gate show test --warnings"),
    interrupted: O.some("beep gate show test --log"),
  }),
  check: GatePointers.make({ failure: "beep gate show check" }),
};

export const recordPaths = RecordPaths.make({
  record: "packages/glob/.beep/gates/test/report.json",
  log: "packages/glob/.beep/gates/test/report.log",
  logBytes: 13450,
});

export const projectWith = (input: {
  readonly report: GateReport;
  readonly delta?: RunDelta;
  readonly fixes?: Record<string, string>;
}): ReadonlyArray<string> =>
  projectLines({
    document: dispatch(
      ConsoleInput.make({
        report: input.report,
        pointers: pointerTable,
        paths: O.some(recordPaths),
        delta: O.fromUndefinedOr(input.delta),
        fixes: input.fixes ?? {},
      })
    ),
    budget: agentBudget,
  });

export const project = (report: GateReport): ReadonlyArray<string> => projectWith({ report });

/** Decode unknown input against a schema, as an `Option`. */
export const decodes =
  <T, E>(schema: S.Codec<T, E>) =>
  (input: unknown): O.Option<T> =>
    S.decodeUnknownOption(schema)(input);
