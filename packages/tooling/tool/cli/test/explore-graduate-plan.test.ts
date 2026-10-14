import {
  compileGraduationPlan,
  ExistingGoalPacket,
  ExplorationSnapshot,
  exploreCommand,
  GraduationChildInput,
  GraduationPlan,
  GraduationRequest,
  parseGraduationGoal,
  renderGraduationPlanHuman,
} from "@beep/repo-cli/test/Explore";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertTrue, strictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import { Command } from "effect/cli";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import { expectReportedExit, temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";

const EXPLORATION = "graduation-fixture";
const PROVENANCE = `explorations/${EXPLORATION}`;
const DIGEST = "0".repeat(64);
const TODAY = "2026-10-13";

const isGraduationPlan = S.is(GraduationPlan);
const decodeGraduationPlanJson = S.decodeUnknownEffect(S.fromJsonString(GraduationPlan));
const runExploreCommand = Command.runWith(exploreCommand, { version: "0.0.0" });

const manifestText = (status: string, stage: string, goals: ReadonlyArray<string> = []): string =>
  `${JSON.stringify(
    {
      schemaVersion: "exploration-manifest/v1",
      exploration: {
        slug: EXPLORATION,
        title: "Graduation Fixture",
        status,
        stage,
        openQuestions: [],
        links: { goals, docs: [], supersededBy: null },
        created: "2026-10-01",
        updated: "2026-10-01",
      },
    },
    null,
    2
  )}\n`;

const snapshotOf = (
  fields: {
    readonly exists?: boolean;
    readonly manifestText?: string;
    readonly goals?: ReadonlyArray<ExistingGoalPacket>;
  } = {}
): ExplorationSnapshot =>
  ExplorationSnapshot.make({
    exploration: EXPLORATION,
    manifestPath: `${PROVENANCE}/ops/manifest.json`,
    exists: fields.exists ?? true,
    ...(fields.exists === false ? {} : { manifestText: fields.manifestText ?? manifestText("active", "decompose") }),
    ...(fields.exists === false ? {} : { manifestDigest: DIGEST }),
    goals: fields.goals ?? [],
  });

const child = (slug: string, title = "Child Goal") => GraduationChildInput.make({ slug, title });

const requestOf = (...children: ReadonlyArray<GraduationChildInput>) =>
  GraduationRequest.make({ children, today: TODAY });

const reasons = (plan: GraduationPlan) => A.map(plan.conflicts, (conflict) => conflict.reason);

const childGoalManifest = (provenance?: string): string =>
  `${JSON.stringify(
    {
      schemaVersion: "initiative-manifest/v2",
      initiative: { id: "child", title: "Child" },
      ...(provenance === undefined ? {} : { provenance: { exploration: provenance, graduated: TODAY } }),
    },
    null,
    2
  )}\n`;

const consoleLogText = Effect.fnUntraced(function* () {
  return A.join(A.filter(yield* TestConsole.logLines, P.isString), "\n");
});

it.layer(NodeServices.layer, { concurrent: false, timeout: "60 seconds" })((it) => {
  describe("explore graduate --plan compiler", { concurrent: false }, () => {
    it.effect("compiles one bootstrap child plan with provenance and the manifest edit", () =>
      Effect.gen(function* () {
        const plan = yield* compileGraduationPlan(
          snapshotOf({ manifestText: manifestText("active", "decompose", ["goals/earlier-child"]) }),
          requestOf(child("first-child", "First Child"))
        );
        deepConflictFree(plan);
        strictEqual(A.length(plan.children), 1);
        const manifestEntry = A.findFirst(plan.children[0]?.entries ?? [], (entry) =>
          entry.path.endsWith("/ops/manifest.json")
        );
        assertTrue(manifestEntry._tag === "Some" && (manifestEntry.value.payload ?? "").includes(PROVENANCE));
        expect(plan.explorationEdit).toMatchObject({
          path: `${PROVENANCE}/ops/manifest.json`,
          preImageDigest: DIGEST,
          status: "graduated",
          stage: "graduate",
          updated: TODAY,
          appendGoals: ["goals/first-child"],
        });
        assertTrue(isGraduationPlan(plan));
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a missing exploration and an undecodable manifest", () =>
      Effect.gen(function* () {
        const missing = yield* compileGraduationPlan(snapshotOf({ exists: false }), requestOf(child("a-child")));
        expect(reasons(missing)).toEqual(["exploration-not-found"]);
        strictEqual(missing.explorationEdit, undefined);
        expect(renderGraduationPlanHuman(missing)).toContain("exploration-not-found");

        const undecodable = yield* compileGraduationPlan(
          snapshotOf({ manifestText: "{ not json" }),
          requestOf(child("a-child"))
        );
        expect(reasons(undecodable)).toEqual(["manifest-undecodable"]);
        strictEqual(undecodable.explorationEdit, undefined);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses an exploration already graduated or killed", () =>
      Effect.gen(function* () {
        const graduated = yield* compileGraduationPlan(
          snapshotOf({ manifestText: manifestText("graduated", "graduate") }),
          requestOf(child("a-child"))
        );
        expect(reasons(graduated)).toEqual(["exploration-closed"]);
        const killed = yield* compileGraduationPlan(
          snapshotOf({ manifestText: manifestText("killed", "align") }),
          requestOf(child("a-child"))
        );
        expect(reasons(killed)).toEqual(["exploration-closed"]);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses a manifest naming a different exploration", () =>
      Effect.gen(function* () {
        const text = Str.replace(EXPLORATION, "another-exploration")(manifestText("active", "decompose"));
        const plan = yield* compileGraduationPlan(snapshotOf({ manifestText: text }), requestOf(child("a-child")));
        expect(reasons(plan)).toEqual(["manifest-undecodable"]);
        expect(plan.conflicts[0]?.message).toContain('names slug "another-exploration"');
        strictEqual(plan.explorationEdit, undefined);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("refuses no --goal and a child repeated within the plan", () =>
      Effect.gen(function* () {
        const empty = yield* compileGraduationPlan(snapshotOf(), requestOf());
        expect(reasons(empty)).toEqual(["no-goals"]);

        const duplicate = yield* compileGraduationPlan(
          snapshotOf(),
          requestOf(child("same-child", "First"), child("same-child", "Second"))
        );
        expect(reasons(duplicate)).toEqual(["duplicate-child"]);
        strictEqual(A.length(duplicate.children), 1);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("classifies an own earlier child as already published and a foreign packet as a conflict", () =>
      Effect.gen(function* () {
        const goals = [
          ExistingGoalPacket.make({ slug: "own-child", provenanceExploration: PROVENANCE }),
          ExistingGoalPacket.make({ slug: "foreign-child", provenanceExploration: "explorations/someone-else" }),
          ExistingGoalPacket.make({ slug: "bare-child" }),
        ];
        const resumed = yield* compileGraduationPlan(
          snapshotOf({ goals }),
          requestOf(child("own-child"), child("new-child"))
        );
        deepConflictFree(resumed);
        expect(A.map(resumed.alreadyPublished, (published) => published.slug)).toEqual(["own-child"]);
        expect(A.map(resumed.children, (plan) => plan.slug)).toEqual(["new-child"]);
        expect(resumed.explorationEdit?.appendGoals).toEqual(["goals/own-child", "goals/new-child"]);

        const foreign = yield* compileGraduationPlan(
          snapshotOf({ goals }),
          requestOf(child("foreign-child"), child("bare-child"))
        );
        expect(reasons(foreign)).toEqual(["foreign-slug", "foreign-slug"]);
        expect(A.map(foreign.conflicts, (conflict) => conflict.child)).toEqual(["foreign-child", "bare-child"]);
        strictEqual(A.length(foreign.alreadyPublished), 0);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("keeps the plan id stable across runs and sensitive to titles, order, and the manifest pre-image", () =>
      Effect.gen(function* () {
        const request = requestOf(child("first-child", "First"), child("second-child", "Second"));
        const first = yield* compileGraduationPlan(snapshotOf(), request);
        const again = yield* compileGraduationPlan(snapshotOf(), request);
        strictEqual(first.planId, again.planId);
        expect(first.planId).toMatch(/^graduation-plan\/v1:[0-9a-f]{64}$/);

        const retitled = yield* compileGraduationPlan(
          snapshotOf(),
          requestOf(child("first-child", "First Renamed"), child("second-child", "Second"))
        );
        expect(retitled.planId).not.toBe(first.planId);

        const reordered = yield* compileGraduationPlan(
          snapshotOf(),
          requestOf(child("second-child", "Second"), child("first-child", "First"))
        );
        expect(reordered.planId).not.toBe(first.planId);

        const moved = yield* compileGraduationPlan(
          ExplorationSnapshot.make({ ...snapshotOf(), manifestDigest: "1".repeat(64) }),
          request
        );
        expect(moved.planId).not.toBe(first.planId);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("decodes --goal values and renders the human plan", () =>
      Effect.gen(function* () {
        const decoded = yield* parseGraduationGoal("first-child=First = Child");
        strictEqual(decoded.title, "First = Child");
        const bad = yield* Effect.exit(parseGraduationGoal("No Slug"));
        bad.pipe(Exit.isFailure, assertTrue);
        const invalid = yield* Effect.exit(parseGraduationGoal("Bad Slug=Title"));
        invalid.pipe(Exit.isFailure, assertTrue);

        const plan = yield* compileGraduationPlan(snapshotOf(), requestOf(child("first-child")));
        const human = renderGraduationPlanHuman(plan);
        expect(human).toContain(`plan-id: ${plan.planId}`);
        expect(human).toContain("append links.goals: goals/first-child");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });

  describe("explore graduate command", { concurrent: false }, () => {
    it.effect(
      "prints a --plan --json plan for a fixture exploration and resumes over its own child",
      () =>
        Effect.andThen(
          temporaryWorkingDirectory,
          Effect.gen(function* () {
            yield* writeProjectFile(`${PROVENANCE}/ops/manifest.json`, manifestText("active", "decompose"));
            yield* writeProjectFile("goals/own-child/ops/manifest.json", childGoalManifest(PROVENANCE));
            yield* writeProjectFile("goals/foreign-child/ops/manifest.json", childGoalManifest());

            const missingPlan = yield* Effect.exit(
              runExploreCommand(["graduate", EXPLORATION, "--goal", "first-child=First Child"])
            );
            expectReportedExit(missingPlan);

            const happy = yield* Effect.exit(
              runExploreCommand([
                "graduate",
                EXPLORATION,
                "--goal",
                "first-child=First Child",
                "--goal",
                "own-child=Own Child",
                "--today",
                TODAY,
                "--plan",
                "--json",
              ])
            );
            happy.pipe(Exit.isSuccess, assertTrue);
            const plan = yield* decodeGraduationPlanJson(yield* consoleLogText());
            expect(A.map(plan.children, (childPlan) => childPlan.slug)).toEqual(["first-child"]);
            expect(A.map(plan.alreadyPublished, (published) => published.slug)).toEqual(["own-child"]);
            expect(plan.explorationEdit?.appendGoals).toEqual(["goals/first-child", "goals/own-child"]);
            strictEqual(A.length(plan.conflicts), 0);

            const foreign = yield* Effect.exit(
              runExploreCommand([
                "graduate",
                EXPLORATION,
                "--goal",
                "foreign-child=Foreign Child",
                "--today",
                TODAY,
                "--plan",
              ])
            );
            expectReportedExit(foreign);

            const missingExploration = yield* Effect.exit(
              runExploreCommand(["graduate", "absent-idea", "--goal", "x-child=X", "--plan"])
            );
            expectReportedExit(missingExploration);
          })
        ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make)),
      30_000
    );
  });
});

function deepConflictFree(plan: GraduationPlan): void {
  expect(plan.conflicts).toEqual([]);
}
