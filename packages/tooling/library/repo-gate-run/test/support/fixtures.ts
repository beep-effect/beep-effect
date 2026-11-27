import { GateEvent } from "@beep/gate-report/GateEvent";
import { Item, ItemDetail, Location } from "@beep/gate-report/Item";
import { ItemKey } from "@beep/gate-report/ItemKey";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { CLEAR_LINE, ConsoleSettings, makeGateConsole } from "@beep/repo-gate-run/GateConsole";
import { RunSource } from "@beep/repo-gate-run/GateRecorder";
import { CheckRun, CompilerRun, compilerEvents } from "@beep/repo-gate-run/TypeCheckAdapter";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as Str from "effect/String";

export const epoch = DateTime.makeUnsafe(0);

const E = GateEvent.cases;

export const failedTest = (name: string): Item =>
  Item.make({
    key: ItemKey.cases.TestKey.make({ file: "src/math.test.ts", fullName: `math > ${name}` }),
    unit: "src/math.test.ts",
    path: ["math"],
    name,
    outcome: "failed",
    location: Location.makeOption({ file: "src/math.test.ts", line: 12, column: 5 }),
    detail: ItemDetail.makeOption({ message: `expected ${name} to hold`, diff: O.some("- expected\n+ received") }),
  });

const passedTest = (name: string): Item =>
  Item.make({
    key: ItemKey.cases.TestKey.make({ file: "src/math.test.ts", fullName: `math > ${name}` }),
    unit: "src/math.test.ts",
    path: ["math"],
    name,
    outcome: "passed",
  });

/** A test-gate run: three tests, the given ones failing. */
export const testRunEvents = (failing: ReadonlyArray<string>): ReadonlyArray<GateEvent> => [
  E.RunStarted.make({
    runId: "20261119T100000000Z-0001",
    gate: "test",
    subject: "@beep/glob",
    itemKind: "test",
    startedAt: epoch,
    inputFingerprint: "fingerprint",
  }),
  E.UnitCollected.make({ unit: "src/math.test.ts", items: 3 }),
  ...A.map(["adds", "subtracts", "divides"], (name) =>
    E.ItemFinished.make({ item: A.contains(failing, name) ? failedTest(name) : passedTest(name) })
  ),
  E.RunFinished.make({
    durationMs: 1200,
    reason: A.isReadonlyArrayEmpty(failing) ? "passed" : "failed",
    exitCode: O.some(A.isReadonlyArrayEmpty(failing) ? 0 : 1),
  }),
];

export const checkRun = CheckRun.make({
  runId: "20261119T100000000Z-0002",
  subject: "@beep/glob",
  startedAt: epoch,
  durationMs: 900,
  inputFingerprint: "fingerprint",
});

/** A check-gate run with two diagnostics, as the compiler prints them without a terminal. */
export const checkRunEvents = compilerEvents(
  CompilerRun.make({
    run: checkRun,
    exitCode: 2,
    output: A.join(
      [
        "src/a.ts(3,7): error TS2322: Type 'string' is not assignable to type 'number'.",
        "src/b.ts(9,1): error TS2304: Cannot find name 'missing'.",
        "",
      ],
      "\n"
    ),
  })
);

export const eventsSource = (events: ReadonlyArray<GateEvent>) => RunSource.cases.RunEvents.make({ events });

export const packageTarget = (gate: string) =>
  RecordTarget.cases.PackageTarget.make({ packageDir: "packages/foundation/primitive/glob", gate });

export const agentConsole = makeGateConsole(ConsoleSettings.make({ audience: "agent" }));
export const terminalConsole = makeGateConsole(ConsoleSettings.make({ audience: "human", color: "truecolor" }));

const sgrAndOscHyperlinkPattern = /\u001b\[[0-9;]*m|\u001b\]8;[^\u0007\u001b]*(?:\u0007|\u001b\\)/gu;

/** A terminal console with its progress line and every escape removed. */
export const stripTerminal = (text: string): string =>
  Str.replace(sgrAndOscHyperlinkPattern, "")(A.lastNonEmpty(Str.split(text, CLEAR_LINE)));

export const linesOf = (text: string): A.NonEmptyReadonlyArray<string> => Str.split(text, "\n");
