import { Git } from "@beep/git/Git";
import { ExplorationManifest } from "@beep/repo-cli/commands/Explore";
import { runGoalsArchive } from "@beep/repo-cli/commands/Goals/Archive";
import { ArchiveRecord, tombstoneKeeps } from "@beep/repo-cli/commands/Goals/Archive.schemas";
import { ArchivePlanner, ArchivePlannerLive, archivePlanId } from "@beep/repo-cli/commands/Goals/Archive.service";
import {
  explorationArchiveFindings,
  GoalExplorationPathState,
  goalPacketFindings,
} from "@beep/repo-cli/commands/Goals/Doctor";
import { decodeGoalManifest } from "@beep/repo-cli/commands/Goals/Goals.schemas";
import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory";
import { GoalManifestFormatter } from "@beep/repo-cli/commands/Goals/Manifest.service";
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

const REFLECTION = (instruction: string): string =>
  A.join(
    [
      "---",
      "goal: done",
      "agent: codex",
      "date: 2026-11-06",
      "trigger: closeout",
      "confidence: high",
      "findings:",
      "  - category: tooling-friction",
      "    confidence: high",
      `    instruction: ${instruction}`,
      "    explanation: It ran twice.",
      "---",
      "",
    ],
    "\n"
  );

const FIXTURE: ReadonlyArray<readonly [string, string]> = [
  [
    "goals/done/ops/manifest.json",
    goalManifest("done", "completed-retained", { mission: "Ship the done packet.", provides: ["archive/done"] }),
  ],
  ["goals/done/README.md", "# Done\n\nSee [plan](./PLAN.md).\n"],
  ["goals/done/PLAN.md", "# Plan\n"],
  ["goals/done/SPEC.md", "# Spec\n"],
  ["goals/done/history/reflections/2026-11-05-codex.md", REFLECTION("Older finding.")],
  ["goals/done/history/reflections/2026-11-06-codex.md", REFLECTION("Cache the slow scan.")],
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

const gitOutput = Effect.fn("ArchiveTest.gitOutput")(function* (root: string, args: ReadonlyArray<string>) {
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const output = yield* spawner.string(ChildProcess.make("git", args, { cwd: root }));
  return Str.trim(output);
});

const makeArchiveCheckout = Effect.fn("ArchiveTest.makeArchiveCheckout")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const archiveDir = yield* fs.makeTempDirectoryScoped({ prefix: "beep-goals-archive-checkout-" });
  yield* git(archiveDir, ["init", "-q"]);
  for (const [key, value] of [
    ["user.name", "archive"],
    ["user.email", "archive@example.invalid"],
    ["commit.gpgsign", "false"],
    ["core.hooksPath", "/dev/null"],
  ] as const) {
    yield* git(archiveDir, ["config", key, value]);
  }
  return archiveDir;
});

const existsAll = Effect.fn("ArchiveTest.existsAll")(function* (base: string, files: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* Effect.forEach(files, (file) => fs.exists(path.join(base, file)));
});

const readText = Effect.fn("ArchiveTest.readText")(function* (base: string, file: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(base, file));
});

const noFormatter = { format: () => Effect.void };

const writeOptions = (archiveDir: string) =>
  ({
    kind: "all",
    slugs: [],
    repo: REPO,
    plan: false,
    json: false,
    write: true,
    dryRun: false,
    archiveDir,
  }) as const;

const TestLayer = Layer.provideMerge(
  ArchivePlannerLive,
  Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer))
);

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

  it("doctor flags a terminal exploration with neither archive nor retentionReason as advisory", () => {
    const flagged = explorationArchiveFindings("gone", explorationManifest("gone", "killed"));
    assert.deepStrictEqual(
      A.map(flagged, (finding) => [finding.slug, finding.kind, finding.severity] as const),
      [["explorations/gone", "archive-decision-missing", "advisory"]]
    );
    const quiet = [
      explorationManifest("open", "active"),
      explorationManifest("kept", "graduated", { retentionReason: "Live fixtures." }),
      explorationManifest("archived", "graduated", { archive: { ...ARCHIVE_BLOCK, path: "explorations/archived" } }),
      "{ not json",
    ];
    assert.deepStrictEqual(
      A.flatMap(quiet, (text) => explorationArchiveFindings("x", text)),
      []
    );
  });

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
          "goals/done/history/reflections/2026-11-05-codex.md",
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

    it.effect("validates the mode, --expect and --repo before planning", () =>
      Effect.gen(function* () {
        const root = yield* makeFixtureRepo();
        const base = {
          kind: "goals",
          slugs: [],
          repo: REPO,
          plan: false,
          json: false,
          write: false,
          dryRun: false,
          archiveDir: ".repos/goals-archive",
        } as const;
        const reasons = yield* Effect.forEach(
          [
            { ...base, write: true },
            base,
            { ...base, plan: true, write: true },
            { ...base, plan: true, repo: "nope" },
            { ...base, plan: true, batch: 0 },
          ],
          (options) => Effect.map(Effect.flip(runGoalsArchive(options, root)), (error) => error.reason)
        );
        assert.deepStrictEqual(reasons, [
          "archive-input-invalid",
          "archive-input-invalid",
          "archive-input-invalid",
          "archive-input-invalid",
          "archive-input-invalid",
        ]);
        const planned = yield* runGoalsArchive({ ...base, plan: true, batch: 1 }, root);
        assertNone(planned);
      })
    );

    it.effect("writes: mirrors and verifies, tombstones, rewrites links and records the receipt", () =>
      Effect.gen(function* () {
        const root = yield* makeFixtureRepo();
        const archiveDir = yield* makeArchiveCheckout();
        const planner = yield* ArchivePlanner;
        const plan = yield* planner.plan({ kinds: ["goals", "explorations"], slugs: [], repo: REPO, repoRoot: root });
        const receipt = yield* runGoalsArchive({ ...writeOptions(archiveDir), expect: plan.planId }, root).pipe(
          Effect.provideService(GoalManifestFormatter, noFormatter)
        );
        receipt.pipe(O.isSome, assertTrue);
        const archiveCommit = O.getOrElse(
          O.map(receipt, (value) => value.archiveCommit),
          () => ""
        );
        assert.deepStrictEqual(
          O.map(receipt, (value) => A.map(value.entries, (entry) => [entry.slug, entry.verified] as const)),
          O.some([
            ["done", true],
            ["old", true],
            ["gone", true],
          ])
        );

        // Archive checkout: complete packet trees at the recorded hashes, index and README.
        const doneEntry = A.findFirst(plan.entries, (entry) => entry.slug === "done");
        const archivedTree = yield* gitOutput(archiveDir, ["rev-parse", `${archiveCommit}:goals/done`]);
        assertSome(
          O.map(doneEntry, (entry) => entry.localTreeHash),
          archivedTree
        );
        const archived = yield* existsAll(archiveDir, [
          "goals/done/PLAN.md",
          "goals/done/history/reflections/2026-11-06-codex.md",
          "README.md",
        ]);
        assert.deepStrictEqual(archived, [true, true, true]);
        const index = yield* readText(archiveDir, "ARCHIVE-INDEX.md");
        assertTrue(
          Str.includes(`| goals | done | completed-retained | ${archiveCommit} | ${plan.sourceCommit} |`)(index)
        );
        assertTrue(Str.includes(`| explorations | gone | graduated | ${archiveCommit} |`)(index));

        // Main: tombstone keep/remove result.
        const removed = yield* existsAll(root, [
          "goals/done/PLAN.md",
          "goals/done/SPEC.md",
          "goals/done/research/notes.md",
          "explorations/gone/RESEARCH.md",
        ]);
        assert.deepStrictEqual(removed, [false, false, false, false]);
        const kept = yield* existsAll(root, [
          "goals/done/research/OPPORTUNITIES.md",
          "goals/done/history/reflections/2026-11-06-codex.md",
          "explorations/gone/DECISIONS.md",
          "explorations/gone/BRIEF.md",
        ]);
        assert.deepStrictEqual(kept, [true, true, true, true]);

        // Stub README content.
        const readme = yield* readText(root, "goals/done/README.md");
        const fragments = [
          "# done",
          "Lifecycle: `completed-retained`",
          "Ship the done packet.",
          "- `archive/done`",
          "Cache the slow scan.",
          `https://github.com/${REPO}/tree/main/goals/done`,
        ];
        assertTrue(A.every(fragments, (fragment) => Str.includes(fragment)(readme)));
        assertFalse(Str.includes("Older finding.")(readme));
        const explorationReadme = yield* readText(root, "explorations/gone/README.md");
        assertTrue(
          Str.includes("<!-- BEGIN GENERATED: EXPLORATION STATUS -->\nStage: `graduate`\nStatus: `graduated`")(
            explorationReadme
          )
        );

        // Manifest archive blocks.
        const manifestText = yield* readText(root, "goals/done/ops/manifest.json");
        const manifest = yield* decodeGoalManifest(parseJson(manifestText));
        assert.strictEqual(manifest.archive?.commit, archiveCommit);
        assert.strictEqual(manifest.archive?.contentHash, archivedTree);
        assert.strictEqual(manifest.archive?.path, "goals/done");
        const explorationText = yield* readText(root, "explorations/gone/ops/manifest.json");
        assertSome(
          O.map(
            S.decodeOption(S.fromJsonString(ExplorationManifest))(explorationText),
            (value) => value.exploration.archive?.path
          ),
          "explorations/gone"
        );

        // Inbound link rewrite: the removed-file link moves, the kept README link and fenced text stay.
        const guide = yield* readText(root, "docs/guide.md");
        assertTrue(
          Str.includes(
            `See [the plan](https://github.com/${REPO}/blob/main/goals/done/PLAN.md#p1) and [the readme](../goals/done/README.md).`
          )(guide)
        );
        assertTrue(Str.includes("[fenced](../goals/done/SPEC.md)")(guide));

        // Receipt, and archived packets leave the next plan.
        const receiptWritten = yield* existsAll(root, [`.beep/archive/receipts/${plan.planId}.json`]);
        assert.deepStrictEqual(receiptWritten, [true]);
        const next = yield* planner.plan({ kinds: ["goals", "explorations"], slugs: [], repo: REPO, repoRoot: root });
        assert.deepStrictEqual(next.entries, []);
      })
    );

    it.effect("a verify mismatch aborts before anything on main changes", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeFixtureRepo();
        const archiveDir = yield* makeArchiveCheckout();
        const planner = yield* ArchivePlanner;
        const plan = yield* planner.plan({ kinds: ["goals"], slugs: ["done"], repo: REPO, repoRoot: root });
        // An uncommitted edit diverges the copied working tree from the HEAD tree the plan recorded.
        yield* fs.writeFileString(path.join(root, "goals/done/PLAN.md"), "# Plan (edited)\n");
        const watched = ["goals/done/PLAN.md", "goals/done/ops/manifest.json", "docs/guide.md"];
        const before = yield* Effect.forEach(watched, (file) => readText(root, file));
        const failure = yield* runGoalsArchive(
          { ...writeOptions(archiveDir), slugs: ["done"], expect: plan.planId },
          root
        ).pipe(Effect.provideService(GoalManifestFormatter, noFormatter), Effect.flip);
        assert.strictEqual(failure.reason, "archive-verify-mismatch");
        const after = yield* Effect.forEach(watched, (file) => readText(root, file));
        assert.deepStrictEqual(after, before);
        const present = yield* existsAll(root, ["goals/done/SPEC.md", ".beep/archive"]);
        assert.deepStrictEqual(present, [true, false]);
      })
    );

    it.effect("refuses a stale --expect and changes nothing on --dry-run", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const root = yield* makeFixtureRepo();
        const archiveDir = yield* makeArchiveCheckout();
        const planner = yield* ArchivePlanner;
        const plan = yield* planner.plan({ kinds: ["goals"], slugs: [], repo: REPO, repoRoot: root });
        const stale = yield* runGoalsArchive(
          { ...writeOptions(archiveDir), kind: "goals", expect: Str.repeat(64)("0") },
          root
        ).pipe(Effect.flip);
        assert.strictEqual(stale.reason, "archive-plan-mismatch");
        const dry = yield* runGoalsArchive(
          { ...writeOptions(archiveDir), kind: "goals", expect: plan.planId, dryRun: true },
          root
        );
        assertNone(dry);
        const archiveEntries = yield* fs.readDirectory(archiveDir);
        assert.deepStrictEqual(archiveEntries, [".git"]);
        const present = yield* existsAll(root, ["goals/done/PLAN.md", ".beep/archive"]);
        assert.deepStrictEqual(present, [true, false]);
        const status = yield* gitOutput(root, ["status", "--porcelain"]);
        assert.strictEqual(status, "");
      })
    );
  });
});
