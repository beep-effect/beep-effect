import {
  applyAdoptionPlan,
  BootstrapInput,
  compileAdoptionPlan,
  compileMaterializationPlan,
  GoalPlanOperationalError,
  goalsCommand,
  listGoalPackets,
  MaterializationPlan,
  PacketEventStoreLive,
  PlanEntry,
  publishBootstrapPlan,
  readPacketSnapshot,
  replacePinnedFile,
  sha256Hex,
} from "@beep/repo-cli/test/Goals";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";
import {
  expectReportedExit,
  NodeTestLayer,
  temporaryWorkingDirectory,
  writeProjectFile,
} from "./support/CommandTest.ts";

const input = BootstrapInput.make({
  slug: "fresh-goal",
  title: "Fresh Goal",
  mission: "Prove the executor.",
  today: "2026-10-13",
});

const listGoals = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const readDirectory1 = yield* fs.readDirectory("goals");
  return A.sort(readDirectory1, (left: string, right: string) => (left < right ? -1 : 1));
});

const commandTestLayer = PacketEventStoreLive.pipe(Layer.provideMerge(NodeTestLayer));

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
            const readFileString2 = yield* fs.readFileString(entry.path);
            strictEqual(readFileString2, entry.payload);
          }
          expect(A.map(receipt.written, (file) => file.path)).toEqual(A.map(creates, (entry) => entry.path));
          expect(receipt.validations).toEqual(["manifest-decodes", "goal-md-within-budget", "readme-lifecycle-line"]);
          const listGoals3 = yield* listGoals;
          expect(listGoals3).toEqual(["fresh-goal"]);
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
          const readDirectory4 = yield* fs.readDirectory("goals/fresh-goal");
          expect(readDirectory4).toEqual([]);
          const listGoals5 = yield* listGoals;
          expect(listGoals5).toEqual(["fresh-goal"]);
        })
      )
    );

    it.effect("refuses a plan whose staged manifest does not decode and publishes nothing", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* fs.makeDirectory("goals", { recursive: true });
          const plan = yield* compileMaterializationPlan(input, []);
          // Simulate a tampered plan: the manifest payload is JSON but not a GoalManifest.
          const tampered = MaterializationPlan.make({
            ...plan,
            entries: A.map(plan.entries, (entry) =>
              Str.endsWith("ops/manifest.json")(entry.path) ? PlanEntry.make({ ...entry, payload: "{}\n" }) : entry
            ),
          });
          const exit = yield* Effect.exit(publishBootstrapPlan(tampered));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("does not decode");
          const listGoals6 = yield* listGoals;
          expect(listGoals6).toEqual([]);
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
          const readDirectory7 = yield* fs.readDirectory("goals/fresh-goal");
          expect(readDirectory7).toEqual(["NOTES.md"]);
          const listGoals8 = yield* listGoals;
          expect(listGoals8).toEqual(["fresh-goal"]);
        })
      )
    );

    it.effect("recovers from a crashed attempt: stale stages are swept and an empty claim is reclaimed", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const plan = yield* compileMaterializationPlan(input, []);
          const ownStage = `goals/.staging-${Str.slice(-16)(plan.planId)}`;
          // A crash after staging (own digest), a foreign attempt's stage, and a crash
          // between claim and rename (empty slug directory).
          yield* writeProjectFile(`${ownStage}/README.md`, "half-written\n");
          yield* writeProjectFile("goals/.staging-0000000000000000/GOAL.md", "foreign\n");
          yield* fs.makeDirectory("goals/fresh-goal", { recursive: true });

          // E11: the inventory does not count the abandoned claim as a packet.
          const listGoalPackets9 = yield* listGoalPackets();
          expect(A.map(listGoalPackets9, (record) => record.slug)).toEqual([]);

          const receipt = yield* publishBootstrapPlan(plan);
          expect(receipt.slug).toBe("fresh-goal");
          const listGoals10 = yield* listGoals;
          expect(listGoals10).toEqual(["fresh-goal"]);
          const listGoalPackets11 = yield* listGoalPackets();
          expect(A.map(listGoalPackets11, (record) => record.slug)).toEqual(["fresh-goal"]);
        })
      )
    );

    it.effect("keeps a packet whose directory cannot be listed in the permissive inventory", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* writeProjectFile("goals/locked-goal/README.md", "# Locked\n");
          yield* fs.makeDirectory("goals/abandoned", { recursive: true });
          // An unlistable directory is not an abandoned claim.
          yield* fs.chmod("goals/locked-goal", 0o111);
          const listGoalPackets12 = yield* listGoalPackets();
          const slugs = A.map(listGoalPackets12, (record) => record.slug);
          yield* fs.chmod("goals/locked-goal", 0o755);
          expect(slugs).toEqual(["locked-goal"]);
        })
      )
    );

    it.effect("names every stale stage it could not remove instead of failing later", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const plan = yield* compileMaterializationPlan(input, []);
          yield* writeProjectFile("goals/.staging-0000000000000000/GOAL.md", "foreign\n");
          // A read-only goals/ makes the stale stage unremovable.
          yield* fs.chmod("goals", 0o555);
          const exit = yield* Effect.exit(publishBootstrapPlan(plan));
          yield* fs.chmod("goals", 0o755);
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("could not remove stale staging directory goals/.staging-0000000000000000");
          const listGoals13 = yield* listGoals;
          expect(listGoals13).toEqual([".staging-0000000000000000"]);
        })
      )
    );

    it.effect("does not sweep staging names through a symlinked goals root", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const plan = yield* compileMaterializationPlan(input, []);
          yield* writeProjectFile("outside/.staging-keep/data.txt", "keep\n");
          yield* fs.symlink(`${process.cwd()}/outside`, "goals");

          const exit = yield* Effect.exit(publishBootstrapPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("symlinked goals root");
          const readFileString14 = yield* fs.readFileString("outside/.staging-keep/data.txt");
          strictEqual(readFileString14, "keep\n");
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
          const readPacketSnapshot15 = yield* readPacketSnapshot("hand-rolled");
          const plan = yield* compileAdoptionPlan(readPacketSnapshot15, O.none());
          const receipt = yield* applyAdoptionPlan(plan);
          const creates = A.filter(plan.entries, (entry) => entry.action === "create");
          assertTrue(A.isReadonlyArrayNonEmpty(creates));
          expect(A.map(receipt.written, (file) => file.path)).toEqual(A.map(creates, (entry) => entry.path));
          for (const entry of creates) {
            const readFileString16 = yield* fs.readFileString(entry.path);
            strictEqual(readFileString16, entry.payload);
          }
          const readFileString17 = yield* fs.readFileString("goals/hand-rolled/README.md");
          strictEqual(
            readFileString17,
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
          const readPacketSnapshot18 = yield* readPacketSnapshot("hand-rolled");
          const plan = yield* compileAdoptionPlan(readPacketSnapshot18, O.none());
          yield* writeProjectFile("goals/hand-rolled/research/.gitkeep", "racing writer\n");
          const exit = yield* Effect.exit(applyAdoptionPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          const readFileString19 = yield* fs.readFileString("goals/hand-rolled/research/.gitkeep");
          strictEqual(readFileString19, "racing writer\n");
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
          const readPacketSnapshot20 = yield* readPacketSnapshot("hand-rolled");
          const plan = yield* compileAdoptionPlan(readPacketSnapshot20, O.none());
          assertTrue(A.isReadonlyArrayNonEmpty(plan.preservations));
          yield* writeProjectFile("goals/hand-rolled/ops/manifest.json", "{}\n");
          const exit = yield* Effect.exit(applyAdoptionPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("changed since the plan was reviewed");
        })
      )
    );

    it.effect("refuses a reviewed adoption write through a symlinked packet ancestor", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          yield* seedHandRolled;
          yield* fs.makeDirectory("outside", { recursive: true });
          yield* fs.symlink(`${process.cwd()}/outside`, "goals/hand-rolled/ops");
          const readPacketSnapshot21 = yield* readPacketSnapshot("hand-rolled");
          const plan = yield* compileAdoptionPlan(readPacketSnapshot21, O.none());

          const exit = yield* Effect.exit(applyAdoptionPlan(plan));
          exit.pipe(Exit.isFailure, assertTrue);
          expect(String(exit)).toContain("Refusing to write");
          const readDirectory22 = yield* fs.readDirectory("outside");
          expect(readDirectory22).toEqual([]);
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
          const exit23 = yield* Effect.exit(runGoalsCommand(bootstrapArgs));
          expectReportedExit(exit23);
          const exit24 = yield* Effect.exit(runGoalsCommand([...bootstrapArgs, "--plan", "--write"]));
          expectReportedExit(exit24);
          const exit25 = yield* Effect.exit(runGoalsCommand([...bootstrapArgs, "--write"]));
          expectReportedExit(exit25);
          const exit26 = yield* Effect.exit(
            runGoalsCommand([...bootstrapArgs, "--write", "--expect", `goal-plan/v1:${Str.repeat(64)("0")}`])
          );
          expectReportedExit(exit26);
          const listGoals27 = yield* listGoals;
          expect(listGoals27).toEqual([]);

          const plan = yield* compileMaterializationPlan(input, []);
          (yield* Effect.exit(runGoalsCommand([...bootstrapArgs, "--write", "--expect", plan.planId]))).pipe(
            Exit.isSuccess,
            assertTrue
          );
          const listGoals28 = yield* listGoals;
          expect(listGoals28).toEqual(["fresh-goal"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("replacePinnedFile", { concurrent: false }, () => {
    it.effect("refuses a lost generation lock and removes the staged replacement", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const preImage = '{"version":0}\n';
          yield* writeProjectFile("pinned/state.json", preImage);
          const preImageDigest = yield* sha256Hex(preImage);
          const refused = yield* Effect.flip(
            replacePinnedFile(
              "pinned/state.json",
              preImageDigest,
              Effect.fnUntraced(function* () {
                yield* fs
                  .remove("pinned/state.json.lock")
                  .pipe(Effect.mapError(GoalPlanOperationalError.new("Could not remove the fixture generation lock.")));
                return '{"version":1}\n';
              })
            )
          );
          strictEqual(refused._tag, "GoalPlanOperationalError");
          expect(refused.message).toContain("Refusing to replace pinned/state.json");
          const readFileString29 = yield* fs.readFileString("pinned/state.json");
          strictEqual(readFileString29, preImage);
          const readDirectory30 = yield* fs.readDirectory("pinned");
          expect(readDirectory30).toEqual(["state.json"]);
        })
      ).pipe(TestClock.withLive)
    );

    it.effect("serializes two writers of one pre-image into one replacement and one refusal", () =>
      Effect.andThen(
        temporaryWorkingDirectory,
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const preImage = '{"version":0}\n';
          yield* writeProjectFile("pinned/state.json", preImage);
          const preImageDigest = yield* sha256Hex(preImage);
          const writer = (version: number) =>
            Effect.result(
              replacePinnedFile("pinned/state.json", preImageDigest, () => Effect.succeed(`{"version":${version}}\n`))
            );
          const outcomes = yield* Effect.all([writer(1), writer(2)], { concurrency: "unbounded" });
          const successes = A.filter(outcomes, Result.isSuccess);
          strictEqual(A.length(successes), 1);
          strictEqual(A.length(A.filter(outcomes, Result.isFailure)), 1);
          const readFileString31 = yield* fs.readFileString("pinned/state.json");
          const finalDigest = yield* sha256Hex(readFileString31);
          strictEqual(successes[0]?.success.afterDigest, finalDigest);
          const readDirectory32 = yield* fs.readDirectory("pinned");
          expect(readDirectory32).toEqual(["state.json"]);
        })
      ).pipe(TestClock.withLive)
    );
  });
});
