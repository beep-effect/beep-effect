import {
  BootstrapInput,
  buildPortfolioIndexContent,
  canonicalJsonTextPretty,
  compileAdoptionPlan,
  compileMaterializationPlan,
  decodeGoalManifest,
  GoalDoctorFindingKind,
  GoalManifest,
  GoalSlug,
  goalsCommand,
  isJsonRecord,
  MaterializationPlan,
  PacketEventStoreLive,
  PacketSnapshot,
  PORTFOLIO_INDEX_PATH,
  parseGoalManifestText,
  readPacketSnapshot,
  validationRequirementsForGoalDoctorFinding,
} from "@beep/repo-cli/test/Goals";
import { findRepoRoot } from "@beep/repo-utils";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { Effect, Exit, FileSystem, Layer, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { Command } from "effect/unstable/cli";
import { describe, expect, it } from "vitest";
import { expectReportedExit, withTempWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import type { Path } from "effect";

const FIXTURES_ROOT = new URL("./fixtures/goals-plan", import.meta.url).pathname;
const REGEN = Bun.env.REGEN_GOLDENS === "1";
const PILOT_SLUG = "knowledge-surface-automation";

const encodeGoalManifest = S.encodeUnknownEffect(GoalManifest);

const encodePlan = (plan: MaterializationPlan) =>
  Effect.map(S.encodeUnknownEffect(MaterializationPlan)(plan), canonicalJsonTextPretty);

const minimalInput = BootstrapInput.make({
  slug: "example-goal",
  title: "Example Goal",
  mission: "Prove the plan compiler.",
  today: "2026-08-17",
});

const fullInput = BootstrapInput.make({
  slug: "full-example-goal",
  title: "Full Example Goal",
  mission: "Prove the fully populated plan compiler.",
  provides: ["goals/bootstrap"],
  requires: ["knowledge/doctor"],
  provenanceExploration: "plan-compiler-exploration",
  today: "2026-08-17",
});

const reportFirstInput = BootstrapInput.make({
  slug: "report-first-goal",
  title: "Report First Goal",
  mission: "Prove the report-first archetype.",
  archetype: "report-first",
  today: "2026-08-17",
});

const expectGolden = Effect.fn("expectGolden")(function* (name: string, plan: MaterializationPlan) {
  const fs = yield* FileSystem.FileSystem;
  const rendered = yield* encodePlan(plan);
  const goldenPath = `${FIXTURES_ROOT}/${name}.json`;
  if (REGEN) {
    yield* fs.makeDirectory(FIXTURES_ROOT, { recursive: true });
    yield* fs.writeFileString(goldenPath, rendered);
    return;
  }
  const golden = yield* fs.readFileString(goldenPath);
  expect(rendered).toBe(golden);
});

const run = <A, E>(effect: Effect.Effect<A, E, FileSystem.FileSystem | Path.Path>) =>
  Effect.runPromise(effect.pipe(provideScopedLayer(NodeServices.layer)));

const commandTestLayer = PacketEventStoreLive.pipe(Layer.provideMerge(NodeServices.layer));

describe("goals bootstrap --plan golden fixtures", () => {
  it("pins the minimal standard-delivery plan byte-for-byte", () =>
    run(expectGolden("bootstrap-minimal", compileMaterializationPlan(minimalInput, []))));

  it("pins the fully populated plan with capabilities and exploration provenance", () =>
    run(expectGolden("bootstrap-full", compileMaterializationPlan(fullInput, []))));

  it("pins the report-first archetype plan", () =>
    run(expectGolden("bootstrap-report-first", compileMaterializationPlan(reportFirstInput, []))));
});

describe("goals bootstrap --plan determinism", () => {
  it("compiles identical bytes and plan ids across repeated runs and permuted input field order", () =>
    run(
      Effect.gen(function* () {
        const permuted = BootstrapInput.make({
          today: "2026-08-17",
          mission: "Prove the plan compiler.",
          title: "Example Goal",
          slug: "example-goal",
        });
        const first = compileMaterializationPlan(minimalInput, []);
        const second = compileMaterializationPlan(minimalInput, []);
        const third = compileMaterializationPlan(permuted, []);
        expect(second.planId).toBe(first.planId);
        expect(third.planId).toBe(first.planId);
        const firstBytes = yield* encodePlan(first);
        const secondBytes = yield* encodePlan(second);
        expect(secondBytes).toBe(firstBytes);
      })
    ));
});

describe("goals bootstrap --plan input rejection", () => {
  const decodeSlug = S.decodeUnknownEffect(GoalSlug);

  it.each(["Uppercase-Slug", "slug/with/separators", "../escape", "spaced slug", "_template"])(
    "rejects %j at the slug grammar",
    (candidate) =>
      Effect.runPromise(
        Effect.gen(function* () {
          const outcome = yield* Effect.exit(decodeSlug(candidate));
          expect(outcome._tag).toBe("Failure");
        })
      )
  );

  it("fails closed with a slug-exists conflict and no entries", () => {
    const plan = compileMaterializationPlan(minimalInput, ["example-goal"]);
    expect(A.length(plan.conflicts)).toBe(1);
    expect(plan.conflicts[0]?.reason).toBe("slug-exists");
    expect(A.length(plan.entries)).toBe(0);
    expect(A.length(plan.validations)).toBe(0);
  });
});

describe("goals adopt --plan evergreen pilot", () => {
  it(
    "retains every live pilot file once, preserves the five unmodeled manifest keys, and creates nothing authored",
    () =>
      run(
        Effect.gen(function* () {
          const repoRoot = yield* findRepoRoot();
          const snapshot = yield* readPacketSnapshot(PILOT_SLUG, repoRoot);
          expect(snapshot.exists).toBe(true);
          const plan = compileAdoptionPlan(snapshot, O.none());

          expect(A.length(plan.conflicts)).toBe(0);
          expect(plan.towardArchetype).toBe("report-first");
          expect(plan.templateSnapshotHash).toBe(snapshot.templateSnapshotHash);

          for (const file of snapshot.files) {
            const fullPath = `${snapshot.packetPath}/${file.path}`;
            const matches = A.filter(plan.entries, (entry) => entry.path === fullPath);
            expect(A.length(matches)).toBe(1);
            const action = file.path === "ops/manifest.json" ? "preserve" : "retain";
            expect(matches[0]?.action).toBe(action);
          }

          const unmodeledKeys = pipe(
            plan.preservations,
            A.findFirst((row) => row.path === `${snapshot.packetPath}/ops/manifest.json`),
            O.map((row) => [...row.unmodeledKeys]),
            O.getOrElse(() => A.empty<string>())
          );
          expect(unmodeledKeys).toStrictEqual([
            "agentLaunchers",
            "currentSourceOfTruth",
            "researchReports",
            "stopConditions",
            "verificationCommands",
          ]);

          const authoredCreates = A.filter(
            plan.entries,
            (entry) => entry.action === "create" && entry.ownership === "authored"
          );
          expect(A.length(authoredCreates)).toBe(0);

          // Zero-write + doctor-input parity: compilation left every packet file's
          // digest untouched, so any doctor run before and after sees identical input.
          const after = yield* readPacketSnapshot(PILOT_SLUG, repoRoot);
          expect(A.map(after.files, (file) => file.digest)).toStrictEqual(A.map(snapshot.files, (file) => file.digest));
        })
      ),
    30_000
  );

  it(
    "is idempotent and a fixed point: recompiling matches, and the simulated overlay plans zero creates",
    () =>
      run(
        Effect.gen(function* () {
          const repoRoot = yield* findRepoRoot();
          const snapshot = yield* readPacketSnapshot(PILOT_SLUG, repoRoot);
          const first = compileAdoptionPlan(snapshot, O.none());
          const second = compileAdoptionPlan(snapshot, O.none());
          expect(second.planId).toBe(first.planId);

          const overlayFiles = A.appendAll(
            snapshot.files,
            A.getSomes(
              A.map(first.entries, (entry) =>
                entry.action === "create" && entry.payload !== undefined && entry.payloadDigest !== undefined
                  ? O.some({
                      path: entry.path.replace(`${snapshot.packetPath}/`, ""),
                      text: entry.payload,
                      digest: entry.payloadDigest,
                    })
                  : O.none<{ path: string; text: string; digest: string }>()
              )
            )
          );
          const overlay = PacketSnapshot.make({
            slug: snapshot.slug,
            packetPath: snapshot.packetPath,
            exists: true,
            files: overlayFiles,
            templateFiles: snapshot.templateFiles,
            templateSnapshotHash: snapshot.templateSnapshotHash,
          });
          const fixedPoint = compileAdoptionPlan(overlay, O.none());
          const creates = A.filter(fixedPoint.entries, (entry) => entry.action === "create");
          expect(A.length(creates)).toBe(0);
        })
      ),
    30_000
  );
});

describe("goals adopt --plan preservation counterfactual", () => {
  it("proves the naive decode-encode round trip destroys the pilot's unmodeled keys", () =>
    run(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = yield* findRepoRoot();
        const manifestText = yield* fs.readFileString(`${repoRoot}/goals/${PILOT_SLUG}/ops/manifest.json`);
        const parsedRecord = pipe(
          parseGoalManifestText(manifestText),
          O.filter(isJsonRecord),
          O.getOrElse((): Readonly<Record<string, unknown>> => ({}))
        );
        const originalKeys = R.keys(parsedRecord);
        expect(originalKeys).not.toStrictEqual([]);
        const parsedUnknown: unknown = parsedRecord;
        const decoded = yield* decodeGoalManifest(parsedUnknown);
        const encoded: unknown = yield* encodeGoalManifest(decoded);
        expect(isJsonRecord(encoded)).toBe(true);
        const roundTripKeys = isJsonRecord(encoded) ? R.keys(encoded) : A.empty<string>();
        for (const lost of [
          "agentLaunchers",
          "currentSourceOfTruth",
          "researchReports",
          "stopConditions",
          "verificationCommands",
        ]) {
          expect(originalKeys).toContain(lost);
          expect(roundTripKeys).not.toContain(lost);
        }
      })
    ));
});

describe("goals adopt --plan manifest-less packet", () => {
  it(
    "plans exactly one generated manifest plus report rows, never writing the README",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("goals/_template/README.md", "# <Goal Title>\n");
            yield* writeProjectFile("goals/_template/SPEC.md", "# <Goal Title> Spec\n");
            yield* writeProjectFile("goals/_template/ops/manifest.json", "{}\n");
            yield* writeProjectFile("goals/_template/research/.gitkeep", "\n");
            yield* writeProjectFile("goals/_template/history/reflections/_TEMPLATE.md", "# Reflection\n");
            yield* writeProjectFile(
              "goals/hand-rolled/README.md",
              "# Hand Rolled\n\n## Status\n\nLifecycle: `active`\n\n## Mission\n\nA hand-rolled packet.\n"
            );
            yield* writeProjectFile("goals/hand-rolled/SPEC.md", "# Hand Rolled Spec\n");

            const snapshot = yield* readPacketSnapshot("hand-rolled");
            const plan = compileAdoptionPlan(snapshot, O.none());

            const creates = A.filter(plan.entries, (entry) => entry.action === "create");
            const manifestCreate = A.filter(creates, (entry) => entry.path === "goals/hand-rolled/ops/manifest.json");
            expect(A.length(manifestCreate)).toBe(1);
            expect(manifestCreate[0]?.ownership).toBe("generated");
            expect(manifestCreate[0]?.payload).toContain('"id": "hand-rolled"');
            expect(manifestCreate[0]?.payload).toContain('"title": "Hand Rolled"');
            expect(manifestCreate[0]?.payload).toContain('"mission": "A hand-rolled packet."');

            const readmeWrites = A.filter(
              plan.entries,
              (entry) => entry.path === "goals/hand-rolled/README.md" && entry.action !== "retain"
            );
            expect(A.length(readmeWrites)).toBe(0);

            const reports = A.filter(plan.entries, (entry) => entry.action === "report");
            expect(
              A.some(reports, (entry) => entry.path === "goals/hand-rolled/history/reflections/_TEMPLATE.md")
            ).toBe(true);
            const authoredCreates = A.filter(creates, (entry) => entry.ownership === "authored");
            expect(A.length(authoredCreates)).toBe(0);
          })
        ).pipe(provideScopedLayer(NodeServices.layer))
      ),
    30_000
  );

  it(
    "fails closed with packet-not-found for a missing packet",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("goals/_template/README.md", "# <Goal Title>\n");
            const snapshot = yield* readPacketSnapshot("missing-goal");
            const plan = compileAdoptionPlan(snapshot, O.none());
            expect(plan.conflicts[0]?.reason).toBe("packet-not-found");
            expect(A.length(plan.entries)).toBe(0);
          })
        ).pipe(provideScopedLayer(NodeServices.layer))
      ),
    30_000
  );

  it(
    "fails closed with manifest-unparseable for a corrupt manifest",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("goals/_template/README.md", "# <Goal Title>\n");
            yield* writeProjectFile("goals/broken/ops/manifest.json", "{ not json");
            const snapshot = yield* readPacketSnapshot("broken");
            const plan = compileAdoptionPlan(snapshot, O.none());
            expect(plan.conflicts[0]?.reason).toBe("manifest-unparseable");
            expect(A.length(plan.entries)).toBe(0);
          })
        ).pipe(provideScopedLayer(NodeServices.layer))
      ),
    30_000
  );
});

describe("goals adopt --plan index parity", () => {
  it(
    "regenerating the index around a retain-only pilot plan produces the tracked bytes",
    () =>
      run(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const repoRoot = yield* findRepoRoot();
          const snapshot = yield* readPacketSnapshot(PILOT_SLUG, repoRoot);
          const plan = compileAdoptionPlan(snapshot, O.none());
          const manifestWrites = A.filter(
            plan.entries,
            (entry) => entry.path === `${snapshot.packetPath}/ops/manifest.json` && entry.action !== "preserve"
          );
          expect(A.length(manifestWrites)).toBe(0);
          const regenerated = yield* buildPortfolioIndexContent(repoRoot);
          const tracked = yield* fs.readFileString(`${repoRoot}/${PORTFOLIO_INDEX_PATH}`);
          expect(regenerated).toBe(tracked);
        })
      ),
    60_000
  );
});

describe("goals plan validation mapping", () => {
  const BLOCKING_KINDS: ReadonlyArray<GoalDoctorFindingKind> = [
    "manifest-missing",
    "manifest-invalid",
    "lifecycle-mismatch",
    "readme-status-line",
    "goal-md-oversize",
    "phases-terminal-but-active",
    "reflection-frontmatter-invalid",
  ];

  it("maps every blocking doctor finding kind to at least one validation requirement", () => {
    for (const kind of GoalDoctorFindingKind.Options) {
      const requirements = validationRequirementsForGoalDoctorFinding(kind);
      if (A.contains(BLOCKING_KINDS, kind)) {
        expect(A.isReadonlyArrayNonEmpty(requirements)).toBe(true);
      } else {
        expect(Array.isArray(requirements)).toBe(true);
      }
    }
  });
});

describe("goals bootstrap command gate", () => {
  const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });

  it(
    "refuses without --plan, rejects a provides/requires self-cycle, and prints a JSON plan on the happy path",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            const missingPlan = yield* Effect.exit(
              runGoalsCommand(["bootstrap", "--slug", "x-goal", "--title", "X", "--mission", "Y."])
            );
            expectReportedExit(missingPlan);

            const selfCycle = yield* Effect.exit(
              runGoalsCommand([
                "bootstrap",
                "--slug",
                "cycle-goal",
                "--title",
                "Cycle",
                "--mission",
                "Self-cycle must refuse.",
                "--today",
                "2026-08-17",
                "--provides",
                "goals/bootstrap",
                "--requires",
                "goals/bootstrap",
                "--plan",
              ])
            );
            expectReportedExit(selfCycle);

            const happy = yield* Effect.exit(
              runGoalsCommand([
                "bootstrap",
                "--slug",
                "fresh-goal",
                "--title",
                "Fresh Goal",
                "--mission",
                "Compile through the command surface.",
                "--today",
                "2026-08-17",
                "--plan",
                "--json",
              ])
            );
            expect(Exit.isSuccess(happy)).toBe(true);
          })
        ).pipe(provideScopedLayer(commandTestLayer))
      ),
    30_000
  );
});

describe("goals adopt command gate", () => {
  const runGoalsCommand = Command.runWith(goalsCommand, { version: "0.0.0" });

  it(
    "refuses without --plan, prints a JSON plan for a fixture packet, and gates on packet-not-found",
    () =>
      Effect.runPromise(
        withTempWorkingDirectory(
          Effect.gen(function* () {
            yield* writeProjectFile("goals/_template/README.md", "# <Goal Title>\n");
            yield* writeProjectFile("goals/_template/ops/manifest.json", "{}\n");
            yield* writeProjectFile("goals/_template/research/.gitkeep", "\n");
            yield* writeProjectFile(
              "goals/fixture-packet/README.md",
              "# Fixture Packet\n\n## Status\n\nLifecycle: `active`\n\n## Mission\n\nAdopt me.\n"
            );

            const missingPlan = yield* Effect.exit(runGoalsCommand(["adopt", "fixture-packet"]));
            expectReportedExit(missingPlan);

            const happy = yield* Effect.exit(runGoalsCommand(["adopt", "fixture-packet", "--plan", "--json"]));
            expect(Exit.isSuccess(happy)).toBe(true);

            const human = yield* Effect.exit(
              runGoalsCommand(["adopt", "fixture-packet", "--plan", "--toward", "standard-delivery"])
            );
            expect(Exit.isSuccess(human)).toBe(true);

            const notFound = yield* Effect.exit(runGoalsCommand(["adopt", "missing-packet", "--plan"]));
            expectReportedExit(notFound);
          })
        ).pipe(provideScopedLayer(commandTestLayer))
      ),
    30_000
  );
});

// The sealed design's empirical zero-write proof: git state is byte-identical
// around compilation and snapshotting (equality, not emptiness, so a dirty
// developer tree does not false-fail the suite).
describe("goals plan zero-write proof", () => {
  it(
    "leaves git status byte-identical around compilation and snapshotting",
    () =>
      run(
        Effect.gen(function* () {
          const repoRoot = yield* findRepoRoot();
          const porcelain = (): string =>
            Bun.spawnSync(["git", "status", "--porcelain"], {
              cwd: repoRoot,
              stdout: "pipe",
              stderr: "pipe",
            }).stdout.toString();
          const before = porcelain();
          const snapshot = yield* readPacketSnapshot(PILOT_SLUG, repoRoot);
          compileAdoptionPlan(snapshot, O.none());
          compileMaterializationPlan(minimalInput, []);
          expect(porcelain()).toBe(before);
        })
      ),
    30_000
  );
});
