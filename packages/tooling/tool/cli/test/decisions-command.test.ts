import { decisionsCommand } from "@beep/repo-cli/commands/Decisions";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  gitFixture,
  NodeCommandTestLayer,
  temporaryWorkingDirectory,
  writeProjectFile,
} from "./support/CommandTest.ts";

const TestLayer = Layer.mergeAll(NodeCommandTestLayer, TestConsole.layer);

const runDecisions = Command.runWith(decisionsCommand, { version: "0.0.0" });

const DECISION = A.join(
  [
    "---",
    "title: Raw DDL",
    "date: 2026-11-21",
    "reversal: Generate the DDL.",
    "governs: [src/a.ts#shown]",
    "enforcedBy: []",
    "---",
    "",
    "Raw DDL stays.",
    "",
  ],
  "\n"
);

const checkout = Effect.fn("DecisionsCommandTest.checkout")(function* (pointer: string) {
  const root = yield* temporaryWorkingDirectory;
  yield* writeProjectFile("bun.lock", "");
  yield* writeProjectFile("packages/demo/package.json", '{ "name": "@beep/demo" }\n');
  yield* writeProjectFile("packages/demo/src/a.ts", `// decision: ${pointer}\nexport const shown = 1;\n`);
  yield* writeProjectFile("packages/demo/decisions/2026-11-21-raw-ddl.md", DECISION);
  yield* gitFixture(root);
});

const loggedSince = (mark: number) => Effect.map(TestConsole.logLines, (lines) => A.map(A.drop(lines, mark), String));

const logMark = Effect.map(TestConsole.logLines, A.length);

it.layer(TestLayer, { timeout: "60 seconds" })((it) => {
  describe("beep decisions command", () => {
    it.effect(
      "prints the group help, a passing check and the decisions governing a path",
      Effect.fnUntraced(function* () {
        yield* checkout("raw-ddl");
        const mark = yield* logMark;
        yield* runDecisions([]);
        yield* runDecisions(["check"]);
        yield* runDecisions(["for", "packages/demo/src/a.ts#shown"]);
        yield* runDecisions(["for", "packages/demo/src/other.ts"]);
        const logged = yield* loggedSince(mark);
        expect(logged).toEqual([
          "Package code-decision commands:",
          "- bun run beep decisions check",
          "- bun run beep decisions for <path>[#declaration]...",
          "decisions: 1",
          "decisions with empty enforcedBy: 1",
          "decision pointers: 1",
          "problems: 0",
          "Raw DDL  packages/demo/decisions/2026-11-21-raw-ddl.md",
          "No package decision governs these paths.",
        ]);
      })
    );

    it.effect(
      "fails the check with a reported exit when a pointer names no decision",
      Effect.fnUntraced(function* () {
        yield* checkout("no-such-decision");
        const mark = yield* logMark;
        const exit = yield* Effect.exit(runDecisions(["check"]));
        expectReportedExit(exit);
        const logged = yield* loggedSince(mark);
        expect(logged).toContain(
          "packages/demo/src/a.ts:1  unresolved-pointer: decision: no-such-decision names no tracked packages/demo/decisions/<YYYY-MM-DD>-no-such-decision.md."
        );
      })
    );
  });
});
