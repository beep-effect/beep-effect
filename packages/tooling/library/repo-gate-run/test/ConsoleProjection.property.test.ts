// The terminal projection is the agent projection painted: with its escapes
// and its progress line removed, it equals the agent projection, for any
// request. Both stay inside the agent budget and open and close on the
// verdict line, omission lines included.
import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { agentBudget, ConsoleRequest, ProgressSnapshot } from "@beep/repo-gate-run/GateConsole";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
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
