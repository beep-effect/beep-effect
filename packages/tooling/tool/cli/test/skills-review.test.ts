import * as NodeURL from "node:url";
import { TestTerminal } from "@beep/cli-kit/testing";
import {
  decodeSkillsLockDocumentJson,
  dequeueGhosted,
  encodeSkillsLockDocumentJson,
  LocalSkillLockEntry,
  makeSkillReviewDeciderPrompt,
  renderSkillReplayMarkdown,
  renderSkillReviewSessionSummary,
  renderUnifiedHunks,
  SkillEffective,
  SkillGitRevision,
  SkillHunkReview,
  SkillHunkReviewLayer,
  SkillLicense,
  SkillMaterializer,
  SkillMaterializerLayer,
  SkillPatch,
  SkillPatches,
  SkillPatchOwnerSource,
  SkillPatchRecorder,
  SkillPatchRecorderLayer,
  SkillPathHistory,
  SkillReviewBaseSource,
  SkillReviewDecide,
  SkillReviewDecider,
  SkillReviewItem,
  SkillReviewOptions,
  SkillReviewQuit,
  SkillReviewScriptEntry,
  SkillSnapshot,
  SkillsLockDocument,
  SkillUpdateTrain,
  SkillUpdateTrainLayer,
  SkillUpstream,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
  skillPatchDropCondition,
  skillPatchOwnerSourceFromCodeowners,
  skillReviewDeciderFromScript,
  VendoredSkillLockEntry,
} from "@beep/repo-cli/commands/Skills";
import {
  appendHunkLedgerRows,
  computeSkillTree,
  HUNK_LEDGER_PATH,
  hashBytes,
  installedTargetsHash,
  patchSetHashOf,
  readHunkLedger,
} from "@beep/repo-cli/test/Skills";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, expect, layer, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Str from "effect/String";
import type { SkillReviewAnswer, SkillReviewScript, SkillReviewSession } from "@beep/repo-cli/commands/Skills";

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const textEncoder = new TextEncoder();
const oracleLockFixture = NodeURL.fileURLToPath(
  new URL("./fixtures/skills-provenance/oracle-lock-v2.json", import.meta.url)
);

const SKILL = "demo";
const TARGETS = [`.claude/skills/${SKILL}`, `.agents/skills/${SKILL}`];
const LICENSE = textEncoder.encode("MIT License\n");
const REV_A = SkillGitRevision.make(Str.repeat(40)("a"));
const REV_B = SkillGitRevision.make(Str.repeat(40)("b"));
const REV_C = SkillGitRevision.make(Str.repeat(40)("c"));
const REV_D = SkillGitRevision.make(Str.repeat(40)("d"));

const lines = (values: ReadonlyArray<string>): string => `${A.join(values, "\n")}\n`;
const pristineSkill = lines([
  "---",
  "name: demo",
  "---",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
  "thirteen",
]);
// Two edits far enough apart to render as two hunks.
const effectiveSkill = Str.replace("twelve\n", "TWELVE\n")(Str.replace("two\n", "TWO\n")(pristineSkill));

const file = (path: string, text: string) =>
  SkillUpstreamContentFile.make({ path, mode: "100644", bytes: textEncoder.encode(text) });

const pristineFiles = [file("SKILL.md", pristineSkill), file("rules/keep.md", "keep\n")];
const effectiveFiles = [file("SKILL.md", effectiveSkill), file("rules/keep.md", "keep\n")];
// Upstream rewrote a context line of the second hunk only: hunk 1 applies, hunk 2 conflicts.
const conflictedPristine = [
  file("SKILL.md", Str.replace("eleven\n", "ELEVEN\n")(pristineSkill)),
  file("rules/keep.md", "keep\n"),
];

const PATCH_PATH = `.agents/skill-patches/${SKILL}/0001-skill-md.patch`;
const patchText = A.join(
  [
    "diff --git a/SKILL.md b/SKILL.md",
    "index 111111111111..222222222222 100644",
    "--- a/SKILL.md",
    "+++ b/SKILL.md",
    ...renderUnifiedHunks(pristineSkill, effectiveSkill),
    "",
  ],
  "\n"
);

const pinnedHistory = S.decodeEffect(SkillPathHistory)({ revisions: [REV_A], truncated: false }).pipe(Effect.orDie);

const sourceLayer = (files: ReadonlyArray<SkillUpstreamContentFile>) =>
  Layer.succeed(
    SkillUpstreamContentSource,
    SkillUpstreamContentSource.of({
      load: Effect.fn("SkillsReviewTest.source.load")(() =>
        Effect.succeed(SkillUpstreamContent.make({ files, licenseBytes: LICENSE }))
      ),
      listPathHistory: Effect.fn("SkillsReviewTest.source.listPathHistory")(() => pinnedHistory),
    })
  );

const ownerLayer = Layer.succeed(SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners("* @kriegcloud\n"));

const effectiveOf = Effect.fn("SkillsReviewTest.effectiveOf")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const tree = yield* computeSkillTree(files, "effective");
  return SkillEffective.make({
    treeHash: tree.treeHash,
    installedTargets: TARGETS,
    installedTreeHash: yield* installedTargetsHash(
      A.map(TARGETS, (target) => [target, tree.treeHash] as const),
      SKILL
    ),
  });
});

const snapshotOf = Effect.fn("SkillsReviewTest.snapshotOf")(function* (files: ReadonlyArray<SkillUpstreamContentFile>) {
  const tree = yield* computeSkillTree(files, "pristine");
  return SkillSnapshot.make({
    algorithm: "sha256",
    treeHash: tree.treeHash,
    fileCount: tree.manifest.length,
    manifestHash: tree.manifestHash,
    manifest: tree.manifest,
  });
});

const writeTree = Effect.fn("SkillsReviewTest.writeTree")(function* (
  root: string,
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(root, { recursive: true });
  for (const entry of files) {
    const absolute = path.join(root, entry.path);
    yield* fs.makeDirectory(path.dirname(absolute), { recursive: true });
    yield* fs.writeFile(absolute, entry.bytes);
    yield* fs.chmod(absolute, 0o644);
  }
});

const lockPathOf = Effect.fn("SkillsReviewTest.lockPathOf")(function* (repoRoot: string) {
  const path = yield* Path.Path;
  return path.join(repoRoot, "skills-lock.json");
});

const readLock = Effect.fn("SkillsReviewTest.readLock")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  return yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(yield* lockPathOf(repoRoot)));
});

const writeLock = Effect.fn("SkillsReviewTest.writeLock")(function* (repoRoot: string, lock: SkillsLockDocument) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.writeFileString(yield* lockPathOf(repoRoot), `${yield* encodeSkillsLockDocumentJson(lock)}\n`);
});

const vendoredEntry = Effect.fn("SkillsReviewTest.vendoredEntry")(function* (repoRoot: string) {
  const entry = (yield* readLock(repoRoot)).skills[SKILL];
  assert(entry !== undefined && entry._tag === "vendored");
  return entry;
});

// A Renovate bump moves only the pin; the recorded hashes stay the old pin's.
const setPin = Effect.fn("SkillsReviewTest.setPin")(function* (repoRoot: string, sourceRevision: SkillGitRevision) {
  const lock = yield* readLock(repoRoot);
  const entry = yield* vendoredEntry(repoRoot);
  yield* writeLock(
    repoRoot,
    SkillsLockDocument.make({
      version: 2,
      skills: {
        ...lock.skills,
        [SKILL]: VendoredSkillLockEntry.make({
          ...entry,
          upstream: SkillUpstream.make({ ...entry.upstream, sourceRevision }),
        }),
      },
    })
  );
});

// A temp repository whose lock records `demo` at REV_A with one two-hunk patch, plus one local skill.
const makeRepo = Effect.fn("SkillsReviewTest.makeRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-review-" });
  yield* fs.makeDirectory(path.join(repoRoot, ".claude/skills"), { recursive: true });
  yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
  yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));
  yield* fs.makeDirectory(path.join(repoRoot, path.dirname(PATCH_PATH)), { recursive: true });
  yield* fs.writeFileString(path.join(repoRoot, PATCH_PATH), patchText);
  yield* writeTree(path.join(repoRoot, TARGETS[0] ?? ""), effectiveFiles);
  const localFiles = [file("SKILL.md", "---\nname: local-one\n---\n")];
  yield* writeTree(path.join(repoRoot, ".claude/skills/local-one"), localFiles);

  const patchBytes = [{ path: PATCH_PATH, bytes: textEncoder.encode(patchText) }];
  const base = (yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(oracleLockFixture))).skills.oracle;
  assert(base !== undefined && base._tag === "vendored");
  const vendored = VendoredSkillLockEntry.make({
    ...base,
    upstream: SkillUpstream.make({ ...base.upstream, sourceRevision: REV_A }),
    license: SkillLicense.make({ ...base.license, sha256: yield* hashBytes(LICENSE, "license") }),
    snapshot: yield* snapshotOf(pristineFiles),
    patches: SkillPatches.make({
      required: true,
      patchSetHash: yield* patchSetHashOf(patchBytes, SKILL),
      series: [
        SkillPatch.make({
          path: PATCH_PATH,
          sha256: yield* hashBytes(A.getUnsafe(patchBytes, 0).bytes, PATCH_PATH),
          label: "temporary-drift",
          owner: "@kriegcloud",
          dropCondition: "Drop when upstream contains an equivalent change.",
        }),
      ],
    }),
    effective: yield* effectiveOf(effectiveFiles),
  });
  const localTree = yield* computeSkillTree(localFiles, "local");
  const local = LocalSkillLockEntry.make({
    installedTargets: [".claude/skills/local-one", ".agents/skills/local-one"],
    installedTreeHash: yield* installedTargetsHash(
      [
        [".claude/skills/local-one", localTree.treeHash],
        [".agents/skills/local-one", localTree.treeHash],
      ],
      "local-one"
    ),
  });
  yield* writeLock(
    repoRoot,
    SkillsLockDocument.make({ version: 2, skills: { [SKILL]: vendored, "local-one": local } })
  );
  return repoRoot;
});

const reviewWith = Effect.fn("SkillsReviewTest.reviewWith")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>,
  base: Readonly<Record<string, SkillGitRevision>> = {}
) {
  const baseLayer = Layer.succeed(
    SkillReviewBaseSource,
    SkillReviewBaseSource.of({
      baseRevisions: Effect.fn("SkillsReviewTest.baseRevisions")(function* () {
        return base;
      }),
    })
  );
  const train = SkillUpdateTrainLayer.pipe(Layer.provide(sourceLayer(files)));
  const context = yield* Layer.build(SkillHunkReviewLayer.pipe(Layer.provide(Layer.mergeAll(train, baseLayer))));
  return Context.get(context, SkillHunkReview);
});

const options = (overrides: Partial<SkillReviewOptions> = {}): SkillReviewOptions =>
  SkillReviewOptions.make({
    skill: O.none(),
    decide: false,
    ghost: false,
    reviewer: "@kriegcloud",
    budget: Duration.minutes(20),
    ...overrides,
  });

type Reviewer = Effect.Success<ReturnType<typeof reviewWith>>;

const list = (review: Reviewer, repoRoot: string) =>
  review.review(repoRoot, options()).pipe(Effect.provideService(SkillReviewDecider, skillReviewDeciderFromScript([])));

const decideWith = (
  review: Reviewer,
  repoRoot: string,
  script: SkillReviewScript,
  overrides: Partial<SkillReviewOptions> = {}
) =>
  review
    .review(repoRoot, options({ decide: true, ...overrides }))
    .pipe(Effect.provideService(SkillReviewDecider, skillReviewDeciderFromScript(script)));

const answer = (
  item: SkillReviewItem,
  decision: SkillReviewScriptEntry["decision"],
  label: O.Option<SkillReviewScriptEntry["label"] extends O.Option<infer L> ? L : never> = O.none()
) => SkillReviewScriptEntry.make({ hunk: Str.slice(0, 16)(item.hunkHash), decision, label });

const itemAt = (session: SkillReviewSession, hunk: number): SkillReviewItem =>
  A.findFirst(session.queue, (item) => item.hunk === hunk).pipe(O.getOrThrow);

const refusalReason = (error: { readonly _tag: string; readonly reason?: string }): string =>
  error.reason ?? error._tag;

const recorderWith = Effect.fn("SkillsReviewTest.recorderWith")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const context = yield* Layer.build(
    SkillPatchRecorderLayer.pipe(Layer.provide(Layer.mergeAll(sourceLayer(files), ownerLayer)))
  );
  return Context.get(context, SkillPatchRecorder);
});

const materializerWith = Effect.fn("SkillsReviewTest.materializerWith")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const context = yield* Layer.build(SkillMaterializerLayer.pipe(Layer.provide(sourceLayer(files))));
  return Context.get(context, SkillMaterializer);
});

layer(TestLayer, { timeout: "60 seconds" })("skills review", (it) => {
  it.effect("prepares the first classification ritual without writing anything", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      const review = yield* reviewWith(pristineFiles);
      const session = yield* list(review, repoRoot);
      expect(session.stoppedBy).toBe("listed");
      expect(A.map(session.queue, (item) => [item.kind, item.hunk, item.status, item.currentLabel])).toEqual([
        ["classification", 1, "applied", "temporary-drift"],
        ["classification", 2, "applied", "temporary-drift"],
      ]);
      expect(itemAt(session, 1).text).toContain("-two\n+TWO");
      expect([itemAt(session, 1).oldRevision, itemAt(session, 1).newRevision]).toEqual([REV_A, REV_A]);
      expect(A.map(session.skills, (skill) => [skill.skill, skill.state, skill.unresolved])).toEqual([
        [SKILL, "queued", 2],
      ]);
      expect(renderSkillReviewSessionSummary(session)).toContain("Queued hunks:");
      expect(yield* fs.exists(path.join(repoRoot, HUNK_LEDGER_PATH))).toBe(false);
    })
  );

  it.effect("checkpoints scripted decisions, resumes from the rest, and replays a script as a no-op", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      const first = [answer(itemAt(listed, 1), "keep", O.some("policy"))];

      const partial = yield* decideWith(review, repoRoot, first);
      expect(partial.stoppedBy).toBe("queue-empty");
      deepStrictEqual(
        A.map(partial.recorded, (row) => [row.hunk, row.decision, row.label, row.reviewer, row.origin]),
        [[1, "keep", O.some("policy"), "@kriegcloud", "review"]]
      );
      expect(A.map(partial.queue, (item) => item.hunk)).toEqual([2]);
      expect(A.map(partial.skills, (skill) => skill.state)).toEqual(["queued"]);

      const rest = [answer(itemAt(listed, 2), "keep", O.some("repo-adaptation"))];
      const finished = yield* decideWith(review, repoRoot, A.appendAll(first, rest));
      expect(A.map(finished.recorded, (row) => row.hunk)).toEqual([2]);
      expect(A.map(finished.skills, (skill) => skill.state)).toEqual(["decided"]);

      const ledger = yield* readHunkLedger(repoRoot);
      expect(A.map(ledger, (row) => [row.hunk, row.oldRevision, row.newRevision])).toEqual([
        [1, REV_A, REV_A],
        [2, REV_A, REV_A],
      ]);
      const again = yield* decideWith(review, repoRoot, A.appendAll(first, rest));
      expect([A.length(again.recorded), A.length(again.queue), A.map(again.skills, (skill) => skill.state)]).toEqual([
        0,
        0,
        ["clear"],
      ]);
      expect(A.length(yield* readHunkLedger(repoRoot))).toBe(2);
    })
  );

  it.effect("refuses answers that do not fit or do not name exactly one hunk", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      const unlabelled = yield* decideWith(review, repoRoot, [answer(itemAt(listed, 1), "keep")]).pipe(Effect.flip);
      expect(refusalReason(unlabelled)).toBe("invalid-decision");
      const rebase = yield* decideWith(review, repoRoot, [answer(itemAt(listed, 1), "rebase")]).pipe(Effect.flip);
      expect(refusalReason(rebase)).toBe("invalid-decision");
      const unknown = yield* decideWith(review, repoRoot, [
        SkillReviewScriptEntry.make({ hunk: Str.repeat(12)("f"), decision: "drop", label: O.none() }),
      ]).pipe(Effect.flip);
      expect(refusalReason(unknown)).toBe("unknown-hunk");
      const twice = yield* decideWith(review, repoRoot, [
        answer(itemAt(listed, 1), "drop"),
        answer(itemAt(listed, 1), "keep", O.some("policy")),
      ]).pipe(Effect.flip);
      expect(refusalReason(twice)).toBe("ambiguous-hunk");
      expect(yield* readHunkLedger(repoRoot)).toEqual([]);
    })
  );

  it.effect("stops at the budget and on quit, keeping every recorded checkpoint", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      const spent = yield* decideWith(review, repoRoot, [answer(itemAt(listed, 1), "drop")], {
        budget: Duration.zero,
      });
      expect([spent.stoppedBy, A.length(spent.recorded), A.length(spent.queue)]).toEqual(["budget", 0, 2]);

      const calls = yield* Ref.make(0);
      const decideThenQuit = SkillReviewDecider.of({
        prepare: Effect.fn("SkillsReviewTest.prepare")(function* () {}),
        answer: Effect.fn("SkillsReviewTest.answer")(function* (): Effect.fn.Return<SkillReviewAnswer> {
          const count = yield* Ref.getAndUpdate(calls, (value) => value + 1);
          return count === 0
            ? SkillReviewDecide.make({ decision: "keep", label: O.some("temporary-drift") })
            : SkillReviewQuit.make({});
        }),
      });
      const quit = yield* review
        .review(repoRoot, options({ decide: true }))
        .pipe(Effect.provideService(SkillReviewDecider, decideThenQuit));
      expect([quit.stoppedBy, A.length(quit.recorded), A.map(quit.queue, (item) => item.hunk)]).toEqual([
        "quit",
        1,
        [2],
      ]);
      expect(A.length(yield* readHunkLedger(repoRoot))).toBe(1);
    })
  );

  it.effect("flags a hunk that conflicts at two pins as a promote candidate and never ghosts it", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      // Bump 1: REV_A -> REV_B, hunk 2 conflicts.
      yield* setPin(repoRoot, REV_B);
      const bump1 = yield* reviewWith(conflictedPristine, { [SKILL]: REV_A });
      const listed1 = yield* list(bump1, repoRoot);
      const conflict = itemAt(listed1, 2);
      expect([conflict.kind, conflict.status, conflict.twoStrike, conflict.oldRevision, conflict.newRevision]).toEqual([
        "conflict",
        "conflicted",
        false,
        REV_A,
        REV_B,
      ]);
      yield* decideWith(bump1, repoRoot, [answer(conflict, "rebase")]);

      // Bump 2: the same hunk conflicts again at REV_C.
      yield* setPin(repoRoot, REV_C);
      const bump2 = yield* reviewWith(conflictedPristine, { [SKILL]: REV_A });
      const listed2 = yield* list(bump2, repoRoot);
      const second = itemAt(listed2, 2);
      assertTrue(second.twoStrike);
      assertNone(second.ghost);
      const ghosted = yield* decideWith(bump2, repoRoot, [], { ghost: true });
      expect(A.length(ghosted.recorded)).toBe(0);

      // The PR report carries the same flag.
      const train = Context.get(
        yield* Layer.build(SkillUpdateTrainLayer.pipe(Layer.provide(sourceLayer(conflictedPristine)))),
        SkillUpdateTrain
      );
      const batch = yield* train.replay(repoRoot, O.none());
      expect(A.flatMap(batch.reports, (report) => report.promoteCandidates)).toEqual([second.hunkHash]);
      expect(renderSkillReplayMarkdown(batch)).toContain("conflicted (two strikes: promote-candidate)");
    })
  );

  it.effect("ghosts an earlier decision on a byte-identical hunk at the same pin", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      yield* setPin(repoRoot, REV_B);
      const fromA = yield* reviewWith(conflictedPristine, { [SKILL]: REV_A });
      const listedA = yield* list(fromA, repoRoot);
      yield* decideWith(fromA, repoRoot, [
        answer(itemAt(listedA, 1), "keep", O.some("policy")),
        answer(itemAt(listedA, 2), "drop"),
      ]);

      // The base moved (REV_D), so the key differs while the hunk and the pin do not.
      const fromD = yield* reviewWith(conflictedPristine, { [SKILL]: REV_D });
      const listedD = yield* list(fromD, repoRoot);
      const proposal = itemAt(listedD, 2);
      assertSome(
        O.map(proposal.ghost, (row) => [row.decision, row.reviewer]),
        ["drop", "@kriegcloud"]
      );

      const ghosted = yield* decideWith(fromD, repoRoot, [], { ghost: true, reviewer: "@agent" });
      expect(A.map(ghosted.recorded, (row) => [row.decision, row.reviewer, row.origin, row.oldRevision])).toEqual([
        ["drop", "@kriegcloud", "ghost", REV_D],
      ]);
      expect([A.length(ghosted.queue), A.map(ghosted.skills, (skill) => skill.state)]).toEqual([0, ["decided"]]);

      // The same hunk queued for another skill stays queued: ghosts match on skill and hunk.
      const twin = SkillReviewItem.make({ ...proposal, skill: "other-skill" });
      expect(dequeueGhosted([proposal, twin], ghosted.recorded)).toEqual([twin]);
    })
  );

  it.effect("refuses a ledger line that does not decode, naming the line", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      yield* fs.writeFileString(path.join(repoRoot, HUNK_LEDGER_PATH), "\n{not json}\n");
      const error = yield* readHunkLedger(repoRoot).pipe(Effect.flip);
      expect(error.message).toContain(`${HUNK_LEDGER_PATH}:2`);
    })
  );

  it.effect("rejects a dangling ledger symlink before reading or appending a decision", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "skills-ledger-outside-" });
      const target = path.join(outside, ".bash_profile");
      const ledger = path.join(repoRoot, HUNK_LEDGER_PATH);
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      const recorded = yield* decideWith(review, repoRoot, [answer(itemAt(listed, 1), "drop")]);
      const row = O.getOrThrow(A.head(recorded.recorded));
      yield* fs.remove(ledger);
      yield* fs.symlink(target, ledger);

      expect((yield* readHunkLedger(repoRoot).pipe(Effect.result))._tag).toBe("Failure");
      expect((yield* appendHunkLedgerRows(repoRoot, [row]).pipe(Effect.result))._tag).toBe("Failure");
      expect(yield* fs.exists(target)).toBe(false);
    })
  );

  it.effect("rejects symlinked ledger ancestors without writing outside the checkout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const source = yield* makeRepo();
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, source);
      const recorded = yield* decideWith(review, source, [answer(itemAt(listed, 1), "drop")]);
      const row = O.getOrThrow(A.head(recorded.recorded));
      const outside = yield* fs.makeTempDirectoryScoped({ prefix: "skills-ledger-outside-" });

      for (const ancestor of [".agents", ".agents/skill-patches"]) {
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-ledger-link-" });
        if (ancestor === ".agents/skill-patches") yield* fs.makeDirectory(path.join(repoRoot, ".agents"));
        yield* fs.symlink(outside, path.join(repoRoot, ancestor));
        expect((yield* readHunkLedger(repoRoot).pipe(Effect.result))._tag, ancestor).toBe("Failure");
        expect((yield* appendHunkLedgerRows(repoRoot, [row]).pipe(Effect.result))._tag, ancestor).toBe("Failure");
        expect(yield* fs.exists(path.join(outside, "ledger.jsonl")), ancestor).toBe(false);
      }
    })
  );

  it.effect("fails closed for reads and appends when procfs descriptor paths are unavailable", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      const recorded = yield* decideWith(review, repoRoot, [answer(itemAt(listed, 1), "drop")]);
      const row = O.getOrThrow(A.head(recorded.recorded));
      const nativeFs = process.getBuiltinModule("node:fs");
      const originalStat = nativeFs.statSync;
      const statSpy = vi.spyOn(nativeFs, "statSync").mockImplementation((path) => {
        if (typeof path === "string" && Str.startsWith("/proc/self/fd/")(path)) throw new Error("procfs unavailable");
        return originalStat(path);
      });
      try {
        expect((yield* Effect.flip(readHunkLedger(repoRoot))).message).toContain("unsupported on this platform");
        expect((yield* Effect.flip(appendHunkLedgerRows(repoRoot, [row]))).message).toContain(
          "unsupported on this platform"
        );
      } finally {
        statSpy.mockRestore();
      }
      expect(A.length(yield* readHunkLedger(repoRoot))).toBe(1);
    })
  );
});

layer(TestLayer, { timeout: "60 seconds" })("skills patch", (it) => {
  it.effect("plans a hand edit as a new patch, writes it with the reviewed digest, and materializes clean", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      const lockBefore = yield* fs.readFileString(yield* lockPathOf(repoRoot));
      yield* fs.writeFileString(path.join(repoRoot, TARGETS[0] ?? "", "rules/keep.md"), "keep\nlocal note\n");
      const recorder = yield* recorderWith(pristineFiles);

      const planned = yield* recorder.add(repoRoot, SKILL, O.none());
      const added = `.agents/skill-patches/${SKILL}/0002-rules-keep-md.patch`;
      expect([planned.outcome, A.map(planned.added, (patch) => [patch.path, patch.label, patch.owner])]).toEqual([
        "planned",
        [[added, "temporary-drift", "@kriegcloud"]],
      ]);
      expect(yield* fs.exists(path.join(repoRoot, added))).toBe(false);
      expect(yield* fs.readFileString(yield* lockPathOf(repoRoot))).toBe(lockBefore);

      const stale = yield* recorder.add(repoRoot, SKILL, O.some(Str.repeat(64)("0"))).pipe(Effect.flip);
      expect(refusalReason(stale)).toBe("digest-mismatch");

      const written = yield* recorder.add(repoRoot, SKILL, O.some(planned.planDigest));
      expect(written.outcome).toBe("written");
      expect(yield* fs.readFileString(path.join(repoRoot, added))).toContain("+local note");
      const entry = yield* vendoredEntry(repoRoot);
      expect(A.map(entry.patches.series, (patch) => patch.path)).toEqual([PATCH_PATH, added]);
      expect(entry.effective).toEqual(planned.effective);

      const materializer = yield* materializerWith(pristineFiles);
      const check = yield* materializer.materialize(repoRoot, "check", O.none());
      expect(A.map(check.rows, (row) => row.status)).toEqual(["current", "current"]);
      const again = yield* recorder.add(repoRoot, SKILL, O.none()).pipe(Effect.flip);
      expect(refusalReason(again)).toBe("no-hand-edit");
    })
  );

  it.effect("rolls back only the patch files it created when the write fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      const lockBefore = yield* fs.readFileString(yield* lockPathOf(repoRoot));
      yield* fs.writeFileString(path.join(repoRoot, TARGETS[0] ?? "", "rules/keep.md"), "keep\nlocal note\n");
      const recorder = yield* recorderWith(pristineFiles);
      const planned = yield* recorder.add(repoRoot, SKILL, O.none());
      const added = path.join(repoRoot, A.getUnsafe(planned.added, 0).path);

      // Someone else's file appears at the planned path after planning passed, inside publishAdd:
      // the exclusive create fails, and the rollback must leave that file alone.
      const racing: FileSystem.FileSystem = {
        ...fs,
        writeFile: (target, data, options) =>
          target === added && options?.flag === "wx"
            ? Effect.andThen(fs.writeFileString(added, "not ours\n"), fs.writeFile(target, data, options))
            : fs.writeFile(target, data, options),
      };
      const racingRecorder = Context.get(
        yield* Layer.build(
          SkillPatchRecorderLayer.pipe(
            Layer.provide(
              Layer.mergeAll(sourceLayer(pristineFiles), ownerLayer, Layer.succeed(FileSystem.FileSystem, racing))
            )
          )
        ),
        SkillPatchRecorder
      );
      const error = yield* racingRecorder.add(repoRoot, SKILL, O.some(planned.planDigest)).pipe(Effect.flip);
      expect(error._tag).toBe("SkillsCommandError");
      expect(error.message).toContain("Failed to write");
      expect(yield* fs.readFileString(added)).toBe("not ours\n");
      expect(yield* fs.readFileString(yield* lockPathOf(repoRoot))).toBe(lockBefore);
    })
  );

  it.effect("refuses a clean install, a missing target, and local or unknown skills", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      const recorder = yield* recorderWith(pristineFiles);
      expect(refusalReason(yield* recorder.add(repoRoot, SKILL, O.none()).pipe(Effect.flip))).toBe("no-hand-edit");
      expect(refusalReason(yield* recorder.add(repoRoot, "local-one", O.none()).pipe(Effect.flip))).toBe(
        "not-vendored"
      );
      expect(refusalReason(yield* recorder.add(repoRoot, "missing", O.none()).pipe(Effect.flip))).toBe("unknown-skill");
      yield* fs.remove(path.join(repoRoot, TARGETS[0] ?? ""), { recursive: true });
      expect(refusalReason(yield* recorder.add(repoRoot, SKILL, O.none()).pipe(Effect.flip))).toBe("missing-target");
    })
  );

  it.effect("keeps a patch pending while its hunks are unclassified or kept under different labels", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const recorder = yield* recorderWith(pristineFiles);
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);

      const untouched = yield* recorder.label(repoRoot, SKILL, O.none());
      expect([untouched.changes, A.map(untouched.pending, (pending) => pending.reason)]).toEqual([
        [],
        ["unclassified"],
      ]);

      yield* decideWith(review, repoRoot, [
        answer(itemAt(listed, 1), "keep", O.some("policy")),
        answer(itemAt(listed, 2), "keep", O.some("repo-adaptation")),
      ]);
      const mixed = yield* recorder.label(repoRoot, SKILL, O.none());
      expect([mixed.changes, A.map(mixed.pending, (pending) => pending.reason)]).toEqual([[], ["mixed"]]);
    })
  );

  it.effect("moves a patch label once every hunk is kept under one label, touching no hash", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const recorder = yield* recorderWith(pristineFiles);
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      yield* decideWith(review, repoRoot, [
        answer(itemAt(listed, 1), "keep", O.some("policy")),
        answer(itemAt(listed, 2), "keep", O.some("policy")),
      ]);
      const agreed = yield* recorder.label(repoRoot, SKILL, O.none());
      expect(A.map(agreed.changes, (change) => [change.patch, change.from, change.to])).toEqual([
        [PATCH_PATH, "temporary-drift", "policy"],
      ]);
      const patchSetBefore = (yield* vendoredEntry(repoRoot)).patches.patchSetHash;
      const written = yield* recorder.label(repoRoot, SKILL, O.some(agreed.planDigest));
      expect(written.outcome).toBe("written");
      const entry = yield* vendoredEntry(repoRoot);
      expect([A.map(entry.patches.series, (patch) => patch.label), entry.patches.patchSetHash]).toEqual([
        ["policy"],
        patchSetBefore,
      ]);
      // The drop condition follows the label (B42): a policy patch is replayed on every bump.
      expect(A.map(entry.patches.series, (patch) => patch.dropCondition)).toEqual([skillPatchDropCondition("policy")]);
      const replanned = yield* recorder.label(repoRoot, SKILL, O.none());
      expect((yield* recorder.label(repoRoot, SKILL, O.some(replanned.planDigest))).outcome).toBe("already-current");

      // A hand-authored retirement condition is kept; a stale canonical text from another label is
      // replaced, and the plan shows that rewrite.
      const withCondition = Effect.fnUntraced(function* (dropCondition: string) {
        const lock = yield* readLock(repoRoot);
        const current = yield* vendoredEntry(repoRoot);
        yield* writeLock(
          repoRoot,
          SkillsLockDocument.make({
            version: 2,
            skills: {
              ...lock.skills,
              [SKILL]: VendoredSkillLockEntry.make({
                ...current,
                patches: SkillPatches.make({
                  ...current.patches,
                  series: A.map(current.patches.series, (patch) => SkillPatch.make({ ...patch, dropCondition })),
                }),
              }),
            },
          })
        );
      });
      yield* withCondition("Drop when the vendor ships the same guardrail.");
      expect((yield* recorder.label(repoRoot, SKILL, O.none())).changes).toEqual([]);
      yield* withCondition(skillPatchDropCondition("temporary-drift"));
      const stale = yield* recorder.label(repoRoot, SKILL, O.none());
      expect(
        A.map(stale.changes, (change) => [change.from, change.to, change.fromDropCondition, change.toDropCondition])
      ).toEqual([["policy", "policy", skillPatchDropCondition("temporary-drift"), skillPatchDropCondition("policy")]]);
      yield* recorder.label(repoRoot, SKILL, O.some(stale.planDigest));

      const materializer = yield* materializerWith(pristineFiles);
      const check = yield* materializer.materialize(repoRoot, "check", O.none());
      expect(A.map(check.rows, (row) => row.status)).toEqual(["current", "current"]);
    })
  );

  it.effect("keeps a patch with a dropped hunk pending", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const recorder = yield* recorderWith(pristineFiles);
      const review = yield* reviewWith(pristineFiles);
      const listed = yield* list(review, repoRoot);
      yield* decideWith(review, repoRoot, [
        answer(itemAt(listed, 1), "drop"),
        answer(itemAt(listed, 2), "keep", O.some("policy")),
      ]);
      const plan = yield* recorder.label(repoRoot, SKILL, O.none());
      expect([plan.changes, A.map(plan.pending, (pending) => pending.reason)]).toEqual([[], ["dropped"]]);
    })
  );
});

// The interactive decider runs behind `CliPrompt.gateTerminal`: the gate decides from the audience and the
// terminal whether a person can be asked, and a run that cannot prompt quits before reading a key.
layer(TestLayer, { timeout: "60 seconds" })("skills review prompt gate", (it) => {
  const firstItem = Effect.fn("SkillsReviewTest.firstItem")(function* () {
    const repoRoot = yield* makeRepo();
    const review = yield* reviewWith(pristineFiles);
    return itemAt(yield* list(review, repoRoot), 1);
  });

  it.effect("quits without reading a key when the run cannot prompt", () =>
    Effect.gen(function* () {
      const item = yield* firstItem();
      const terminal = yield* TestTerminal.make({ columns: 90, rows: 40 });
      yield* terminal.input([{ name: "enter" }]);
      const context = yield* Layer.build(Layer.mergeAll(terminal.layer, Stdio.layerTest({})));
      const decider = yield* makeSkillReviewDeciderPrompt.pipe(Effect.provide(context));
      const decided = yield* decider.answer(item);
      assertTrue(S.is(SkillReviewQuit)(decided));
      expect(yield* terminal.reads).toEqual({ keys: 0, lines: 0, subscriptions: 0 });
      expect(yield* terminal.pending).toBe(1);
      expect(yield* terminal.output).toBe("");
    })
  );

  it.effect("asks a person on a terminal and decides by the keys they type", () =>
    Effect.gen(function* () {
      const item = yield* firstItem();
      const terminal = yield* TestTerminal.make({ columns: 90, rows: 40 });
      yield* terminal.input([{ name: "down" }, { name: "enter" }]);
      const context = yield* Layer.build(
        Layer.mergeAll(
          terminal.layer,
          Stdio.layerTest({ stdinIsTerminal: Effect.succeed(true), stdoutIsTerminal: Effect.succeed(true) })
        )
      );
      // A person: no agent or CI variable, and a terminal that is not `dumb`.
      const decider = yield* makeSkillReviewDeciderPrompt.pipe(
        Effect.provide(context),
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ TERM: "xterm-256color" }))
      );
      const decided = yield* decider.answer(item);
      deepStrictEqual(decided, SkillReviewDecide.make({ decision: "keep", label: O.some("repo-adaptation") }));
      expect((yield* terminal.reads).keys).toBe(2);
      expect(yield* terminal.output).toContain("Decision");
    })
  );
});
