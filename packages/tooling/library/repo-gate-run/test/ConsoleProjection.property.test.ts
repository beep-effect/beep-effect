import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { ConsoleBudget } from "@beep/gate-report/ConsoleDocument";
import {
  agentBudget,
  ConsoleRequest,
  ConsoleSettings,
  makeGateConsole,
  ProgressSnapshot,
} from "@beep/repo-gate-run/GateConsole";
import { omissionLines } from "@beep/repo-gate-run/Omission";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { agentConsole, linesOf, stripTerminal, terminalConsole } from "./support/fixtures.ts";

const runs = { arbitrary: fcRuns(100) };

const requests = Arbitrary.schema(ConsoleRequest);
const snapshots = Arbitrary.schema(ProgressSnapshot);

describe("console projections", () => {
  it.effect.prop(
    "the terminal projection without escapes and progress line equals the agent projection",
    [requests, snapshots],
    ([request, snapshot]) =>
      Effect.sync(() => {
        const progress = O.getOrElse(terminalConsole.progress(snapshot), () => "");
        const terminal = `${progress}${terminalConsole.render(request).text}`;
        assert.strictEqual(stripTerminal(terminal), agentConsole.render(request).text);
      }),
    runs
  );

  it.effect.prop(
    "the whole console, omission lines included, stays within any budget, the minimum included",
    [requests, Arbitrary.schema(ConsoleBudget)],
    ([request, budget]) =>
      Effect.sync(() => {
        const tight = makeGateConsole(ConsoleSettings.make({ audience: "agent", budget }));
        const lines = linesOf(tight.render(request).text);
        assert.isAtMost(
          A.reduce(lines, 0, (total, line) => total + line.length + 1),
          budget.maxChars
        );
        assert.strictEqual(A.headNonEmpty(lines), A.lastNonEmpty(lines));
        const heads = A.map(omissionLines(request.omissions), (line) => A.headNonEmpty(Str.split(line, ":")));
        assert.isTrue(
          A.every(heads, (head) => A.some(lines, Str.startsWith(head))),
          "a notice is never dropped to fit the budget"
        );
      }),
    runs
  );

  it.effect.prop(
    "the agent projection opens and closes on the verdict line and fits the agent budget",
    [requests],
    ([request]) =>
      Effect.sync(() => {
        const text = agentConsole.render(request).text;
        const lines = linesOf(text);
        assert.strictEqual(A.headNonEmpty(lines), A.lastNonEmpty(lines));
        assert.isAtMost(text.length, agentBudget.maxChars);
        assert.isTrue(A.every(lines, (line) => line.length <= agentBudget.maxLineChars));
      }),
    runs
  );
});
