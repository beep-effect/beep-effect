import {
  applyAdoptionPlan,
  BootstrapInput,
  compileAdoptionPlan,
  compileMaterializationPlan,
  goalsCommand,
  PacketEventStoreLive,
  publishBootstrapPlan,
  readPacketSnapshot,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const input = BootstrapInput.make({
  slug: "fresh-goal",
  title: "Fresh Goal",
  mission: "Prove the executor.",
  today: "2026-10-13",
});

const listGoals = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return A.sort(yield* fs.readDirectory("goals"), (left: string, right: string) => (left < right ? -1 : 1));
});

const commandTestLayer = PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer));

it.layer(commandTestLayer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("goals bootstrap --write", { concurrent: false }, () => {
    it.effect("publishes exactly the plan's payloads and leaves no staging directory", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals", { recursive: true });
          const plan = yield* compileMaterializationPlan(input, []);
          const receipt = yield* publishBootstrapPlan(plan);

          const creates = A.filter(plan.entries, (entry) => entry.action === "create");
          for (const entry of creates) {
            strictEqual(yield* fs.readFileString(entry.path), entry.payload);
          }
          expect(A.map(receipt.written, (file) => file.path)).toEqual(A.map(creates, (entry) => entry.path));
          expect(receipt.validations).toEqual(["manifest-decodes", "goal-md-within-budget", "readme-lifecycle-line"]);
          expect(yield* listGoals).toEqual(["fresh-goal"]);
        })
      )
    );

    it.effect("refuses a conflicted plan and an adoption plan without writing", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals/fresh-goal", { recursive: true });
          const conflicted = yield* compileMaterializationPlan(input, ["fresh-goal"]);
          assertTrue(A.isReadonlyArrayNonEmpty(conflicted.conflicts));
          const exit = yield* Effect.exit(publishBootstrapPlan(conflicted));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("a conflicted plan never writes");
          expect(yield* fs.readDirectory("goals/fresh-goal")).toEqual([]);
          expect(yield* listGoals).toEqual(["fresh-goal"]);
        })
      )
    );

    it.effect("refuses to publish over a slug that appeared after planning and cleans up the stage", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals", { recursive: true });
          const plan = yield* compileMaterializationPlan(input, []);
          yield* writeProjectFile("goals/fresh-goal/NOTES.md", "racing creator\n");
          const exit = yield* Effect.exit(publishBootstrapPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("already exists");
          expect(yield* fs.readDirectory("goals/fresh-goal")).toEqual(["NOTES.md"]);
          expect(yield* listGoals).toEqual(["fresh-goal"]);
        })
      )
    );
  });

  describe("goals adopt --write", { concurrent: false }, () => {
    const seedHandRolled = Effect.gen(function* () {
      yield* writeProjectFile("goals/_template/README.md", "# <Goal Title>\n");
      yield* writeProjectFile("goals/_template/ops/manifest.json", "{}\n");
      yield* writeProjectFile("goals/_template/research/.gitkeep", "\n");
      yield* writeProjectFile(
        "goals/hand-rolled/README.md",
        "# Hand Rolled\n\n## Status\n\nLifecycle: `active`\n\n## Mission\n\nA hand-rolled packet.\n"
      );
    });

    it.effect("creates only the plan's generated files", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* seedHandRolled;
          const plan = yield* compileAdoptionPlan(yield* readPacketSnapshot("hand-rolled"), O.none());
          const receipt = yield* applyAdoptionPlan(plan);
          const creates = A.filter(plan.entries, (entry) => entry.action === "create");
          assertTrue(A.isReadonlyArrayNonEmpty(creates));
          expect(A.map(receipt.written, (file) => file.path)).toEqual(A.map(creates, (entry) => entry.path));
          for (const entry of creates) {
            strictEqual(yield* fs.readFileString(entry.path), entry.payload);
          }
          strictEqual(
            yield* fs.readFileString("goals/hand-rolled/README.md"),
            "# Hand Rolled\n\n## Status\n\nLifecycle: `active`\n\n## Mission\n\nA hand-rolled packet.\n"
          );
        })
      )
    );

    it.effect("refuses to clobber a file that appeared after planning", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* seedHandRolled;
          const plan = yield* compileAdoptionPlan(yield* readPacketSnapshot("hand-rolled"), O.none());
          yield* writeProjectFile("goals/hand-rolled/research/.gitkeep", "racing writer\n");
          const exit = yield* Effect.exit(applyAdoptionPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          strictEqual(yield* fs.readFileString("goals/hand-rolled/research/.gitkeep"), "racing writer\n");
        })
      )
    );

    it.effect("refuses when a preserved manifest changed since review", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          yield* seedHandRolled;
          yield* writeProjectFile(
            "goals/hand-rolled/ops/manifest.json",
            '{"initiative":{"id":"hand-rolled","status":"active"},"completionGate":{"operator":"yeet","requiresPullRequest":true,"requiresMergeable":true,"statement":"s","grandfathered":false},"steward":"x"}\n'
          );
          const plan = yield* compileAdoptionPlan(yield* readPacketSnapshot("hand-rolled"), O.none());
          assertTrue(A.isReadonlyArrayNonEmpty(plan.preservations));
          yield* writeProjectFile("goals/hand-rolled/ops/manifest.json", "{}\n");
          const exit = yield* Effect.exit(applyAdoptionPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("changed since the plan was reviewed");
        })
      )
    );
  });

  describe("goals bootstrap|adopt write gate", { concurrent: false }, () => {
    const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });
    const bootstrapArgs = [
      "bootstrap",
      "--slug",
      "fresh-goal",
      "--title",
      "Fresh Goal",
      "--mission",
      "Prove the executor.",
      "--today",
      "2026-10-13",
    ];

    it.effect("requires exactly one mode and a matching --expect", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals", { recursive: true });
          expectReportedExit(yield* Effect.exit(runGoalsCommand(bootstrapArgs)));
          expectReportedExit(yield* Effect.exit(runGoalsCommand([...bootstrapArgs, "--plan", "--write"])));
          expectReportedExit(yield* Effect.exit(runGoalsCommand([...bootstrapArgs, "--write"])));
          expectReportedExit(
            yield* Effect.exit(
              runGoalsCommand([...bootstrapArgs, "--write", "--expect", `goal-plan/v1:${"0".repeat(64)}`])
            )
          );
          expect(yield* listGoals).toEqual([]);

          const plan = yield* compileMaterializationPlan(input, []);
          (yield* Effect.exit(runGoalsCommand([...bootstrapArgs, "--write", "--expect", plan.planId]))).pipe(
            Exit.isSuccess,
            assertTrue
          );
          expect(yield* listGoals).toEqual(["fresh-goal"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
