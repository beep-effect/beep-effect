import { ExplorationManifest } from "@beep/repo-cli/commands/Explore";
import { runGoalsArchive } from "@beep/repo-cli/commands/Goals/Archive";
import { ArchiveRecord, tombstoneKeeps } from "@beep/repo-cli/commands/Goals/Archive.schemas";
import { ArchivePlanner, ArchivePlannerLive, archivePlanId } from "@beep/repo-cli/commands/Goals/Archive.service";
import { GoalExplorationPathState, goalPacketFindings } from "@beep/repo-cli/commands/Goals/Doctor";
import { ArchiveError } from "@beep/repo-cli/commands/Goals/Goals.errors";
import { decodeGoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas";
import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import { assertFalse, assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { GoalPacketReader } from "@beep/repo-cli/commands/Goals/Doctor";

const REPO = "beep-effect/beep-effect-goals-archive";
const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const parseJson = flow(S.decodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const ARCHIVE_BLOCK = {
  repo: REPO,
  path: "goals/archived",
  commit: Str.repeat(40)("a"),
  contentHash: Str.repeat(40)("b"),
  archivedAt: "2026-11-06T12:00:00.000Z",
  sourceCommit: Str.repeat(40)("c"),
};

const goalManifest = (slug: string, status: string, extra: Readonly<Record<string, unknown>> = {}): string =>
  `${encodeJson({
    schemaVersion: "initiative-manifest/v2",
    initiative: { id: slug, status },
    lifecycle: status,
    completionGate: COMPLETION_GATE,
    ...extra,
  })}\n`;

const explorationManifest = (slug: string, status: string, extra: Readonly<Record<string, unknown>> = {}): string =>
  `${encodeJson({
    schemaVersion: "exploration-manifest/v1",
    exploration: { slug, title: slug, status, stage: "graduate", updated: "2026-11-06", ...extra },
  })}\n`;

const GUIDE = A.join(
  [
    "# Guide",
    "",
    "See [the plan](../goals/done/PLAN.md#p1) and [the readme](../goals/done/README.md).",
    "External [site](https://example.com/goals/done/PLAN.md).",
    "~~~md",
    "[fenced](../goals/done/SPEC.md)",
    "~~~",
    "",
  ],
  "\n"
);

const FIXTURE: ReadonlyArray<readonly [string, string]> = [
  ["goals/done/ops/manifest.json", goalManifest("done", "completed-retained")],
  ["goals/done/README.md", "# Done\n\nSee [plan](./PLAN.md).\n"],
  ["goals/done/PLAN.md", "# Plan\n"],
  ["goals/done/SPEC.md", "# Spec\n"],
  ["goals/done/history/reflections/2026-11-06-codex.md", "---\ngoal: done\n---\n"],
  ["goals/done/research/OPPORTUNITIES.md", "# Friction\n"],
  ["goals/done/research/notes.md", "notes\n"],
  ["goals/old/ops/manifest.json", goalManifest("old", "superseded", { supersededBy: "done" })],
  ["goals/old/README.md", "# Old\n"],
  ["goals/kept/ops/manifest.json", goalManifest("kept", "completed-retained", { retentionReason: "Live fixtures." })],
  ["goals/archived/ops/manifest.json", goalManifest("archived", "completed-retained", { archive: ARCHIVE_BLOCK })],
  ["goals/live/ops/manifest.json", goalManifest("live", "active")],
  ["goals/_template/ops/manifest.json", goalManifest("template", "completed-retained")],
  ["explorations/gone/ops/manifest.json", explorationManifest("gone", "graduated")],
  ["explorations/gone/README.md", "# Gone\n"],
  ["explorations/gone/DECISIONS.md", "# Decisions\n"],
  ["explorations/gone/BRIEF.md", "# Brief\n"],
  ["explorations/gone/RESEARCH.md", "# Research\n"],
  ["explorations/open/ops/manifest.json", explorationManifest("open", "active")],
  ["docs/guide.md", GUIDE],
];

const git = Effect.fn("ArchiveTest.git")(function* (root: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const handle = yield* spawner.spawn(
    ChildProcess.make("git", args, { cwd: root, stdout: "ignore", stderr: "ignore" })
  );
  const exitCode = yield* handle.exitCode;
  assert.strictEqual(exitCode, 0, `git ${A.join(args, " ")}`);
});

const makeFixtureRepo = Effect.fn("ArchiveTest.makeFixtureRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-goals-archive-" });
  yield* git(root, ["init", "-q"]);
  yield* Effect.forEach(
    FIXTURE,
    ([relative, text]) =>
      Effect.gen(function* () {
        const target = path.join(root, relative);
        yield* fs.makeDirectory(path.dirname(target), { recursive: true });
        yield* fs.writeFileString(target, text);
      }),
    { discard: true }
  );
  yield* git(root, ["add", "-A"]);
  yield* git(root, [
    "-c",
    "user.name=archive",
    "-c",
    "user.email=archive@example.invalid",
    "-c",
    "commit.gpgsign=false",
    "commit",
    "-q",
    "--no-verify",
    "-m",
    "fixture",
  ]);
  return root;
});

const stubReader: GoalPacketReader<never, never> = {
  decisionFiles: () => Effect.succeed(A.empty<string>()),
  readDecision: () => Effect.succeed(""),
  readDocument: () => Effect.succeedNone,
  explorationPath: () => Effect.succeed(GoalExplorationPathState.Enum.present),
  opsFiles: () => Effect.succeed(A.empty<string>()),
  researchFiles: () => Effect.succeed(A.empty<string>()),
  readReflection: () => Effect.succeed(""),
  reflectionFiles: () => Effect.succeed(A.empty<string>()),
};

const doctorRecord = (slug: string, manifestText: string): GoalPacketRecord =>
  GoalPacketRecord.make({
    slug,
    packetPath: `goals/${slug}`,
    manifestPath: `goals/${slug}/ops/manifest.json`,
    readmePath: `goals/${slug}/README.md`,
    manifestText,
  });

const TestLayer = Layer.provideMerge(ArchivePlannerLive, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer));

describe("goals archive", () => {
  it.effect("decodes the archive block and retentionReason on goal and exploration manifests", () =>
    Effect.gen(function* () {
      const goal = yield* decodeGoalManifest(
        parseJson(goalManifest("archived", "completed-retained", { archive: ARCHIVE_BLOCK, retentionReason: "Kept." }))
      );
      assertInstanceOf(goal.archive, ArchiveRecord);
      assert.strictEqual(goal.retentionReason, "Kept.");
      const plain = yield* decodeGoalManifest(parseJson(goalManifest("plain", "active")));
      assert.strictEqual(plain.archive, undefined);
      const badRepo = yield* decodeGoalManifest(
        parseJson(goalManifest("bad", "completed-retained", { archive: { ...ARCHIVE_BLOCK, repo: "no-slash" } }))
      ).pipe(Effect.option);
      assertNone(badRepo);
      const exploration = S.decodeOption(S.fromJsonString(ExplorationManifest))(
        explorationManifest("gone", "graduated", { archive: { ...ARCHIVE_BLOCK, path: "explorations/gone" } })
      );
      assertSome(
        O.map(exploration, (manifest) => manifest.exploration.archive?.path),
        "explorations/gone"
      );
      const emptyReason = S.decodeOption(S.fromJsonString(ExplorationManifest))(
        explorationManifest("gone", "graduated", { retentionReason: "" })
      );
      assertNone(emptyReason);
    })
  );

  it("keeps exactly the tombstone set per root", () => {
    assertTrue(tombstoneKeeps("goals", "history/reflections/a.md"));
    assertTrue(tombstoneKeeps("goals", "research/OPPORTUNITIES.md"));
    assertFalse(tombstoneKeeps("goals", "research/notes.md"));
    assertTrue(tombstoneKeeps("explorations", "BRIEF.md"));
    assertFalse(tombstoneKeeps("explorations", "history/reflections/a.md"));
  });

  it.effect("doctor flags a terminal goal with neither archive nor retentionReason as advisory", () =>
    Effect.gen(function* () {
      const kinds = (text: string, slug: string) =>
        Effect.map(goalPacketFindings(doctorRecord(slug, text), stubReader), (result) =>
          A.filter(result.findings, (finding) => finding.kind === "archive-decision-missing")
        );
      const missing = yield* kinds(goalManifest("done", "completed-retained"), "done");
      assert.deepStrictEqual(
        A.map(missing, (finding) => finding.severity),
        ["advisory"]
      );
      const superseded = yield* kinds(goalManifest("old", "superseded", { supersededBy: "done" }), "old");
      assert.strictEqual(A.length(superseded), 1);
      const retained = yield* kinds(goalManifest("kept", "completed-retained", { retentionReason: "Kept." }), "kept");
      const archived = yield* kinds(
        goalManifest("archived", "completed-retained", { archive: ARCHIVE_BLOCK }),
        "archived"
      );
      const active = yield* kinds(goalManifest("live", "active"), "live");
      assert.strictEqual(A.length(retained) + A.length(archived) + A.length(active), 0);
    })
  );

  it.layer(TestLayer, { timeout: "60 seconds" })((it) => {
    it.effect("plans terminal packets in index order with keep/remove partitions and inbound links", () =>
      Effect.gen(function* () {
        const root = yield* makeFixtureRepo();
        const planner = yield* ArchivePlanner;
        const plan = yield* planner.plan({ kinds: ["goals", "explorations"], slugs: [], repo: REPO, repoRoot: root });
        assert.deepStrictEqual(
          A.map(plan.entries, (entry) => `${entry.root}/${entry.slug}`),
          ["goals/done", "goals/old", "explorations/gone"]
        );
        const [done, , gone] = plan.entries;
        assert.deepStrictEqual(done?.keep, [
          "goals/done/README.md",
          "goals/done/history/reflections/2026-11-06-codex.md",
          "goals/done/ops/manifest.json",
          "goals/done/research/OPPORTUNITIES.md",
        ]);
        assert.deepStrictEqual(done?.remove, [
          "goals/done/PLAN.md",
          "goals/done/SPEC.md",
          "goals/done/research/notes.md",
        ]);
        assert.deepStrictEqual(gone?.keep, [
          "explorations/gone/BRIEF.md",
          "explorations/gone/DECISIONS.md",
          "explorations/gone/README.md",
          "explorations/gone/ops/manifest.json",
        ]);
        assert.deepStrictEqual(gone?.remove, ["explorations/gone/RESEARCH.md"]);
        assert.match(done?.localTreeHash ?? "", /^[0-9a-f]{40}$/);
        assert.deepStrictEqual(
          A.map(
            done?.inboundLinks ?? [],
            (link) => [link.file, link.line, link.destination, link.rewrittenTo] as const
          ),
          [
            [
              "docs/guide.md",
              3,
              "../goals/done/PLAN.md#p1",
              `https://github.com/${REPO}/blob/main/goals/done/PLAN.md#p1`,
            ],
          ]
        );
        assert.strictEqual(A.length(gone?.inboundLinks ?? []), 0);

        const again = yield* planner.plan({ kinds: ["goals", "explorations"], slugs: [], repo: REPO, repoRoot: root });
        assert.strictEqual(again.planId, plan.planId);
        const recomputed = yield* archivePlanId({
          repo: plan.repo,
          sourceCommit: plan.sourceCommit,
          entries: plan.entries,
        });
        assert.strictEqual(recomputed, plan.planId);

        const batch = yield* planner.plan({
          kinds: ["goals", "explorations"],
          slugs: [],
          batchSize: 2,
          repo: REPO,
          repoRoot: root,
        });
        assert.deepStrictEqual(
          A.map(batch.entries, (entry) => entry.slug),
          ["done", "old"]
        );
        assert.notStrictEqual(batch.planId, plan.planId);
        const explorationsOnly = yield* planner.plan({
          kinds: ["explorations"],
          slugs: [],
          repo: REPO,
          repoRoot: root,
        });
        assert.deepStrictEqual(
          A.map(explorationsOnly.entries, (entry) => entry.slug),
          ["gone"]
        );
        const bySlug = yield* planner.plan({ kinds: ["goals"], slugs: ["old"], repo: REPO, repoRoot: root });
        assert.deepStrictEqual(
          A.map(bySlug.entries, (entry) => entry.slug),
          ["old"]
        );
        const ineligible = yield* planner
          .plan({ kinds: ["goals"], slugs: ["live", "kept"], repo: REPO, repoRoot: root })
          .pipe(Effect.flip);
        assert.strictEqual(ineligible.reason, "archive-input-invalid");
      })
    );

    it.effect("refuses --write until slice 3 and requires --plan", () =>
      Effect.gen(function* () {
        const root = yield* makeFixtureRepo();
        const base = { kind: "goals", slugs: [], repo: REPO, plan: false, json: false, write: false } as const;
        const write = yield* runGoalsArchive({ ...base, write: true }, root).pipe(Effect.flip);
        assertInstanceOf(write, ArchiveError);
        assert.strictEqual(write.reason, "archive-write-not-implemented");
        const noMode = yield* runGoalsArchive(base, root).pipe(Effect.flip);
        assertInstanceOf(noMode, ArchiveError);
        assert.strictEqual(noMode.reason, "archive-input-invalid");
        const badRepo = yield* runGoalsArchive({ ...base, plan: true, repo: "nope" }, root).pipe(Effect.flip);
        assertInstanceOf(badRepo, ArchiveError);
        const plan = yield* runGoalsArchive({ ...base, plan: true, batch: 1 }, root);
        assert.strictEqual(A.length(plan.entries), 1);
      })
    );
  });
});
