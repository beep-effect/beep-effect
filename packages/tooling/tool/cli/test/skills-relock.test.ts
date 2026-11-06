import * as NodeURL from "node:url";
import {
  classifySkillPatchHunks,
  decodeSkillsLockDocumentJson,
  encodeSkillsLockDocumentJson,
  isSkillReplayClean,
  LocalSkillLockEntry,
  readSkillReplayMarker,
  renderSkillReplayMarkdown,
  renderSkillReplaySummary,
  renderSkillTrainBatchIssue,
  renderUnifiedHunks,
  SkillEffective,
  SkillLicense,
  SkillMaterializer,
  SkillMaterializerLayer,
  SkillPatch,
  SkillPatches,
  SkillPathHistory,
  SkillReplayBatch,
  SkillSnapshot,
  SkillsLockDocument,
  SkillTrainPullRequest,
  SkillTrainPullRequestComment,
  SkillUpdateTrain,
  SkillUpdateTrainLayer,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
  VendoredSkillLockEntry,
} from "@beep/repo-cli/commands/Skills";
import {
  computeSkillTree,
  hashBytes,
  installedTargetsHash,
  patchSetHashOf,
  publishSkillsLockText,
  skillsLockTextSha256,
} from "@beep/repo-cli/test/Skills";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, expect, layer } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const textEncoder = new TextEncoder();
const oracleLockFixture = NodeURL.fileURLToPath(
  new URL("./fixtures/skills-provenance/oracle-lock-v2.json", import.meta.url)
);
const repoRootDir = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const RenovateConfig = S.fromJsonString(
  S.Struct({
    customManagers: S.Array(S.Struct({ matchStrings: S.Array(S.String), datasourceTemplate: S.String })),
  })
);

const SKILL = "demo";
const TARGETS = [`.claude/skills/${SKILL}`, `.agents/skills/${SKILL}`];
const LICENSE = textEncoder.encode("MIT License\n");

const pristineSkill = A.join(
  ["---", "name: demo", "---", "", "# Demo", "", "one", "two", "three", "four", "five", "six", "seven", ""],
  "\n"
);
const effectiveSkill = Str.replace("two\n", "TWO\n")(pristineSkill);

const file = (path: string, text: string) =>
  SkillUpstreamContentFile.make({ path, mode: "100644", bytes: textEncoder.encode(text) });

const pristineFiles = [file("SKILL.md", pristineSkill), file("rules/keep.md", "keep\n")];
const effectiveFiles = [file("SKILL.md", effectiveSkill), file("rules/keep.md", "keep\n")];

// Upstream moved a file no patch touches: the series replays exactly at the new pin.
const bumpedPristine = [file("SKILL.md", pristineSkill), file("rules/keep.md", "keep upstream\n")];
const bumpedEffective = [file("SKILL.md", effectiveSkill), file("rules/keep.md", "keep upstream\n")];
// Upstream inserted a line above the hunk: it matches only one line lower.
const shiftedPristine = [file("SKILL.md", `intro\n${pristineSkill}`), file("rules/keep.md", "keep\n")];
// Upstream rewrote a context line of the hunk: it matches nowhere.
const conflictedPristine = [
  file("SKILL.md", Str.replace("three\n", "THREE\n")(pristineSkill)),
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

const pinnedHistory = S.decodeEffect(SkillPathHistory)({
  revisions: ["d6e773a562dc85c2a81b7c571f40ca2d81896679"],
  truncated: false,
}).pipe(Effect.orDie);

const sourceLayer = (files: ReadonlyArray<SkillUpstreamContentFile>, licenseBytes: Uint8Array = LICENSE) =>
  Layer.succeed(
    SkillUpstreamContentSource,
    SkillUpstreamContentSource.of({
      load: Effect.fn("SkillsRelockTest.source.load")(() =>
        Effect.succeed(SkillUpstreamContent.make({ files, licenseBytes }))
      ),
      listPathHistory: Effect.fn("SkillsRelockTest.source.listPathHistory")(() => pinnedHistory),
    })
  );

const effectiveOf = Effect.fn("SkillsRelockTest.effectiveOf")(function* (
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

const snapshotOf = Effect.fn("SkillsRelockTest.snapshotOf")(function* (files: ReadonlyArray<SkillUpstreamContentFile>) {
  const tree = yield* computeSkillTree(files, "pristine");
  return SkillSnapshot.make({
    algorithm: "sha256",
    treeHash: tree.treeHash,
    fileCount: tree.manifest.length,
    manifestHash: tree.manifestHash,
    manifest: tree.manifest,
  });
});

const writeTree = Effect.fn("SkillsRelockTest.writeTree")(function* (
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

// A temp repository whose lock records the old pin's hashes, as a Renovate bump leaves it.
const makeRepo = Effect.fn("SkillsRelockTest.makeRepo")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-relock-" });
  yield* fs.makeDirectory(path.join(repoRoot, ".claude/skills"), { recursive: true });
  yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
  yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));
  yield* fs.makeDirectory(path.join(repoRoot, path.dirname(PATCH_PATH)), { recursive: true });
  yield* fs.writeFileString(path.join(repoRoot, PATCH_PATH), patchText);
  yield* writeTree(path.join(repoRoot, TARGETS[0] ?? ""), effectiveFiles);
  yield* writeTree(path.join(repoRoot, ".claude/skills/local-one"), [file("SKILL.md", "---\nname: local-one\n---\n")]);

  const patchBytes = [{ path: PATCH_PATH, bytes: textEncoder.encode(patchText) }];
  const readFileString1 = yield* fs.readFileString(oracleLockFixture);
  const base = (yield* decodeSkillsLockDocumentJson(readFileString1)).skills.oracle;
  assert(base !== undefined && base._tag === "vendored");
  const vendored = VendoredSkillLockEntry.make({
    ...base,
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
  const localTree = yield* computeSkillTree([file("SKILL.md", "---\nname: local-one\n---\n")], "local");
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
  const lock = SkillsLockDocument.make({ version: 2, skills: { [SKILL]: vendored, "local-one": local } });
  yield* fs.writeFileString(path.join(repoRoot, "skills-lock.json"), `${yield* encodeSkillsLockDocumentJson(lock)}\n`);
  return repoRoot;
});

const trainWith = Effect.fn("SkillsRelockTest.trainWith")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>,
  licenseBytes: Uint8Array = LICENSE
) {
  const context = yield* Layer.build(SkillUpdateTrainLayer.pipe(Layer.provide(sourceLayer(files, licenseBytes))));
  return Context.get(context, SkillUpdateTrain);
});

const readLockText = Effect.fn("SkillsRelockTest.readLockText")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(repoRoot, "skills-lock.json"));
});

const onlyReport = (batch: SkillReplayBatch) => {
  assert(batch.reports.length === 1);
  return A.getUnsafe(batch.reports, 0);
};

layer(TestLayer, { timeout: "60 seconds" })("skills replay", (it) => {
  it.effect("reports a clean replay that the lock already records at an unmoved pin", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(pristineFiles);
      const replay2 = yield* train.replay(repoRoot, O.none());
      const report = onlyReport(replay2);
      expect([report.skill, report.status, report.recorded, report.licenseMatches]).toEqual([
        SKILL,
        "clean",
        true,
        true,
      ]);
      expect(A.map(report.hunks, (row) => [row.patch, row.file, row.hunk, row.status])).toEqual([
        [PATCH_PATH, "SKILL.md", 1, "applied"],
      ]);
      expect(Str.startsWith("diff --git a/SKILL.md b/SKILL.md")(report.diff)).toBe(true);
    })
  );

  it.effect("reports a bumped pin as clean but not yet recorded, and writes nothing", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const before = yield* readLockText(repoRoot);
      const train = yield* trainWith(bumpedPristine);
      const replay3 = yield* train.replay(repoRoot, O.some(SKILL));
      const report = onlyReport(replay3);
      expect([report.status, report.recorded]).toEqual(["clean", false]);
      expect(O.getOrThrow(report.effectiveTreeHash)).toBe((yield* computeSkillTree(bumpedEffective, "e")).treeHash);
      const readLockText4 = yield* readLockText(repoRoot);
      expect(readLockText4).toBe(before);
    })
  );

  it.effect("reports a license change at an unmoved tree as unrecorded and unclean", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(pristineFiles, textEncoder.encode("Apache License\n"));
      const replay5 = yield* train.replay(repoRoot, O.none());
      const report = onlyReport(replay5);
      expect([report.status, report.recorded, report.licenseMatches]).toEqual(["clean", false, false]);
      expect(isSkillReplayClean(report)).toBe(false);
      const replay6 = yield* (yield* trainWith(pristineFiles)).replay(repoRoot, O.none());
      const unmoved = onlyReport(replay6);
      expect(isSkillReplayClean(unmoved)).toBe(true);
    })
  );

  it.effect("classifies a hunk that only matches at a shifted line as fuzz-applied", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(shiftedPristine);
      const replay7 = yield* train.replay(repoRoot, O.none());
      const report = onlyReport(replay7);
      expect(report.status).toBe("fuzz-only");
      expect(A.map(report.hunks, (row) => [row.status, row.shift])).toEqual([["fuzz-applied", 1]]);
      assertNone(report.effectiveTreeHash);
    })
  );

  it.effect("classifies a hunk whose context changed upstream as conflicted", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(conflictedPristine);
      const replay8 = yield* train.replay(repoRoot, O.none());
      const report = onlyReport(replay8);
      expect(report.status).toBe("conflicted");
      expect(A.map(report.hunks, (row) => [row.file, row.status])).toEqual([["SKILL.md", "conflicted"]]);
      expect(renderSkillReplaySummary(SkillReplayBatch.make({ reports: [report] }))).toContain(`${SKILL}: conflicted`);
    })
  );

  it.effect("reports missing, mode-mismatched, and non-text files without altering the tree", () =>
    Effect.gen(function* () {
      const wrongMode = SkillUpstreamContentFile.make({ ...file("SKILL.md", pristineSkill), mode: "100755" });
      const binary = SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: new Uint8Array([255]) });
      for (const tree of [[], [wrongMode], [binary]]) {
        const result = yield* classifySkillPatchHunks(PATCH_PATH, patchText, tree);
        expect(A.map(result.rows, (row) => row.status)).toEqual(["conflicted"]);
        expect(result.tree).toEqual(tree);
      }
    })
  );

  it.effect("classifies mode-only, empty-file creation, and complete deletion sections", () =>
    Effect.gen(function* () {
      const modeOnly = A.join(["diff --git a/SKILL.md b/SKILL.md", "old mode 100644", "new mode 100755", ""], "\n");
      const changed = yield* classifySkillPatchHunks(PATCH_PATH, modeOnly, [file("SKILL.md", "keep\n")]);
      expect(A.map(changed.rows, (row) => [row.hunk, row.status])).toEqual([[0, "applied"]]);
      expect(A.getUnsafe(changed.tree, 0).mode).toBe("100755");
      const blocked = yield* classifySkillPatchHunks(PATCH_PATH, modeOnly, []);
      expect(A.map(blocked.rows, (row) => [row.hunk, row.status])).toEqual([[0, "conflicted"]]);
      const addition = A.join(["diff --git a/SKILL.md b/SKILL.md", "new file mode 100644", ""], "\n");
      const created = yield* classifySkillPatchHunks(PATCH_PATH, addition, []);
      expect(A.map(created.rows, (row) => [row.hunk, row.status])).toEqual([[0, "applied"]]);
      expect(A.getUnsafe(created.tree, 0).bytes.length).toBe(0);
      const deletion = A.join(["diff --git a/SKILL.md b/SKILL.md", "deleted file mode 100644", ""], "\n");
      const deleted = yield* classifySkillPatchHunks(PATCH_PATH, deletion, [file("SKILL.md", "")]);
      expect(A.map(deleted.rows, (row) => [row.hunk, row.status])).toEqual([[0, "applied"]]);
      expect(deleted.tree).toEqual([]);
    })
  );

  it.effect("refuses to delete a file when a classified deletion leaves content", () =>
    Effect.gen(function* () {
      const patch = A.join(
        [
          "diff --git a/SKILL.md b/SKILL.md",
          "deleted file mode 100644",
          "--- a/SKILL.md",
          "+++ /dev/null",
          "@@ -1 +0,0 @@",
          "-old",
          "",
        ],
        "\n"
      );
      const tree = [file("SKILL.md", "old\nkeep\n")];
      const result = yield* classifySkillPatchHunks(PATCH_PATH, patch, tree);
      expect(A.map(result.rows, (row) => row.status)).toEqual(["applied", "conflicted"]);
      expect(A.getUnsafe(result.rows, 1).detail).toContain("leaves 1 line(s)");
      expect(result.tree).toEqual(tree);
    })
  );

  it.effect("keeps a hunk's identity when upstream only shifts it", () =>
    Effect.gen(function* () {
      const exact = yield* classifySkillPatchHunks(PATCH_PATH, patchText, pristineFiles);
      const shifted = yield* classifySkillPatchHunks(PATCH_PATH, patchText, shiftedPristine);
      const conflicted = yield* classifySkillPatchHunks(PATCH_PATH, patchText, conflictedPristine);
      const hashOf = (rows: ReadonlyArray<{ readonly hunkHash: string }>) => A.getUnsafe(rows, 0).hunkHash;
      expect(hashOf(shifted.rows)).toBe(hashOf(exact.rows));
      expect(hashOf(conflicted.rows)).toBe(hashOf(exact.rows));
      const malformed = yield* classifySkillPatchHunks("broken.patch", "not a patch\n", pristineFiles);
      expect(A.map(malformed.rows, (row) => row.status)).toEqual(["conflicted"]);
      expect(malformed.tree).toEqual(pristineFiles);
    })
  );

  it.effect("refuses a skill that the lock does not carry as a vendored entry", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(pristineFiles);
      const unknown = yield* train.replay(repoRoot, O.some("missing")).pipe(Effect.flip);
      expect(unknown._tag === "SkillRelockRefusal" ? unknown.reason : unknown._tag).toBe("unknown-skill");
      const local = yield* train.replay(repoRoot, O.some("local-one")).pipe(Effect.flip);
      expect(local._tag === "SkillRelockRefusal" ? local.reason : local._tag).toBe("not-vendored");
    })
  );

  it.effect("refuses a patch whose bytes no longer match the lock", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      yield* fs.writeFileString(path.join(repoRoot, PATCH_PATH), `${patchText}\n`);
      const train = yield* trainWith(bumpedPristine);
      const error = yield* train.replay(repoRoot, O.none()).pipe(Effect.flip);
      expect(error._tag === "SkillMaterializeRefusal" ? error.reason : error._tag).toBe("patch-digest-mismatch");
    })
  );
});

layer(TestLayer, { timeout: "60 seconds" })("skills relock", (it) => {
  it.effect("plans a bumped pin without writing, then records it with the reviewed digest", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const before = yield* readLockText(repoRoot);
      const train = yield* trainWith(bumpedPristine);

      const planned = yield* train.relock(repoRoot, SKILL, O.none());
      expect(planned.outcome).toBe("planned");
      expect(planned.snapshot.treeHash).toBe((yield* snapshotOf(bumpedPristine)).treeHash);
      const expectation = expect(planned.effective);
      const effectiveOf1 = yield* effectiveOf(bumpedEffective);
      expectation.toEqual(effectiveOf1);
      const expectation1 = expect(planned.lockSha256);
      const skillsLockTextSha2562 = yield* skillsLockTextSha256(before, "lock");
      expectation1.toBe(skillsLockTextSha2562);
      const readLockText9 = yield* readLockText(repoRoot);
      expect(readLockText9).toBe(before);

      const written = yield* train.relock(repoRoot, SKILL, O.some(planned.planDigest));
      expect(written.outcome).toBe("written");
      const after = yield* readLockText(repoRoot);
      const expectation2 = expect(O.getOrThrow(written.lock).sha256);
      const skillsLockTextSha2563 = yield* skillsLockTextSha256(after, "lock");
      expectation2.toBe(skillsLockTextSha2563);
      const entry = (yield* decodeSkillsLockDocumentJson(after)).skills[SKILL];
      assert(entry !== undefined && entry._tag === "vendored");
      expect(entry.snapshot).toEqual(planned.snapshot);
      expect(entry.effective).toEqual(planned.effective);
      // The other entries and the patch series ride along unchanged.
      expect((yield* decodeSkillsLockDocumentJson(after)).skills["local-one"]).toEqual(
        (yield* decodeSkillsLockDocumentJson(before)).skills["local-one"]
      );

      // Materialize now rebuilds the installed tree at the new pin, and --check proves it.
      const build10 = yield* Layer.build(SkillMaterializerLayer.pipe(Layer.provide(sourceLayer(bumpedPristine))));
      const materializer = Context.get(build10, SkillMaterializer);
      expect(A.map((yield* materializer.materialize(repoRoot, "check", O.none())).rows, (row) => row.status)).toEqual([
        "would-rebuild",
        "current",
      ]);
      yield* materializer.materialize(repoRoot, "write", O.none());
      expect(A.map((yield* materializer.materialize(repoRoot, "check", O.none())).rows, (row) => row.status)).toEqual([
        "current",
        "current",
      ]);

      // A second relock is a fixed point: a fresh plan, then already-current with no write.
      const replanned = yield* train.relock(repoRoot, SKILL, O.none());
      const again = yield* train.relock(repoRoot, SKILL, O.some(replanned.planDigest));
      expect(again.outcome).toBe("already-current");
      const readLockText11 = yield* readLockText(repoRoot);
      expect(readLockText11).toBe(after);
      // The pre-write digest no longer matches the lock it was sealed against.
      const stale = yield* train.relock(repoRoot, SKILL, O.some(planned.planDigest)).pipe(Effect.flip);
      expect(stale._tag === "SkillsLockWriteRefusal" ? stale.reason : stale._tag).toBe("digest-mismatch");
    })
  );

  it.effect("refuses an unreviewed digest and leaves the lock untouched", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const before = yield* readLockText(repoRoot);
      const train = yield* trainWith(bumpedPristine);
      const error = yield* train.relock(repoRoot, SKILL, O.some(Str.repeat(64)("0"))).pipe(Effect.flip);
      expect(error._tag === "SkillsLockWriteRefusal" ? error.reason : error._tag).toBe("digest-mismatch");
      const readLockText12 = yield* readLockText(repoRoot);
      expect(readLockText12).toBe(before);
    })
  );

  it.effect("refuses a conflicted replay and names the patch and file", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const before = yield* readLockText(repoRoot);
      const train = yield* trainWith(conflictedPristine);
      const error = yield* train.relock(repoRoot, SKILL, O.none()).pipe(Effect.flip);
      assert(error._tag === "SkillRelockRefusal");
      expect(error.reason).toBe("replay-conflicted");
      expect(error.message).toContain(`${PATCH_PATH} SKILL.md hunk 1 (conflicted`);
      const readLockText13 = yield* readLockText(repoRoot);
      expect(readLockText13).toBe(before);
    })
  );

  it.effect("refuses a replay that only applies at shifted positions", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(shiftedPristine);
      const error = yield* train.relock(repoRoot, SKILL, O.none()).pipe(Effect.flip);
      assert(error._tag === "SkillRelockRefusal");
      expect(error.reason).toBe("replay-fuzz-only");
      expect(error.message).toContain(`${PATCH_PATH} SKILL.md hunk 1 (fuzz-applied`);
    })
  );

  it.effect("refuses a pin whose license bytes changed", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(bumpedPristine, textEncoder.encode("Apache License\n"));
      const error = yield* train.relock(repoRoot, SKILL, O.none()).pipe(Effect.flip);
      assert(error._tag === "SkillRelockRefusal");
      expect(error.reason).toBe("license-changed");
    })
  );

  it.effect("refuses to relock a local or unknown skill", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const train = yield* trainWith(bumpedPristine);
      const local = yield* train.relock(repoRoot, "local-one", O.none()).pipe(Effect.flip);
      expect(local._tag === "SkillRelockRefusal" ? local.reason : local._tag).toBe("not-vendored");
      const unknown = yield* train.relock(repoRoot, "missing", O.none()).pipe(Effect.flip);
      expect(unknown._tag === "SkillRelockRefusal" ? unknown.reason : unknown._tag).toBe("unknown-skill");
    })
  );

  it.effect("refuses to publish over a lock that changed since planning and removes its stage", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo();
      const before = yield* readLockText(repoRoot);
      const skillsLockTextSha25614 = yield* skillsLockTextSha256("other\n", "x");
      const error = yield* publishSkillsLockText(repoRoot, "{}\n", skillsLockTextSha25614, "t").pipe(Effect.flip);
      expect(error._tag === "SkillsLockWriteRefusal" ? error.reason : error._tag).toBe("lock-changed");
      const readLockText15 = yield* readLockText(repoRoot);
      expect(readLockText15).toBe(before);
      const exists16 = yield* fs.exists(path.join(repoRoot, "skills-lock.json.staging-t"));
      expect(exists16).toBe(false);
    })
  );
});

layer(TestLayer, { timeout: "60 seconds" })("skills update train reports", (it) => {
  it.effect("round-trips the replay report through the comment marker without its diff", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const batch = yield* (yield* trainWith(conflictedPristine)).replay(repoRoot, O.none());
      const body = renderSkillReplayMarkdown(batch);
      expect(Str.startsWith("<!-- beep-skills-replay -->")(body)).toBe(true);
      expect(body).toContain("waits for the review ritual");
      const decoded = O.getOrThrow(readSkillReplayMarker(body));
      expect(A.map(decoded.reports, (report) => [report.skill, report.status, report.diff])).toEqual([
        [SKILL, "conflicted", ""],
      ]);
      assertNone(readSkillReplayMarker("<!-- beep-skills-replay/v1:not-json -->"));
    })
  );

  it.effect("renders the batch issue with each PR's latest replay verdict and its unresolved hunks", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo();
      const conflicted = yield* (yield* trainWith(conflictedPristine)).replay(repoRoot, O.none());
      const clean = yield* (yield* trainWith(bumpedPristine)).replay(repoRoot, O.none());
      const pr = (number: number, comments: ReadonlyArray<SkillTrainPullRequestComment>) =>
        SkillTrainPullRequest.make({
          number,
          title: `chore(deps): update skill ${SKILL}`,
          url: `https://github.com/kriegcloud/beep-effect/pull/${number}`,
          headRefName: `renovate/skill-${SKILL}`,
          headRefOid: Str.repeat(40)("a"),
          comments,
        });
      const comment = (
        createdAt: string,
        batch: SkillReplayBatch,
        author = "github-actions",
        head = Str.repeat(40)("a")
      ) =>
        SkillTrainPullRequestComment.make({
          author: { login: author },
          createdAt,
          body: `${renderSkillReplayMarkdown(batch)}\n<!-- beep-skills-replay-head:${head} -->`,
        });
      const issue = renderSkillTrainBatchIssue("2026-W42", [
        pr(12, [comment("2026-10-12T00:00:00Z", conflicted)]),
        // The later trusted comment for the current head wins.
        pr(11, [comment("2026-10-13T00:00:00Z", clean), comment("2026-10-12T00:00:00Z", conflicted)]),
        pr(13, []),
      ]);
      expect(issue.title).toBe("Skills update train 2026-W42");
      expect(issue.body).toContain("3 pull request(s): 1 clean, 0 fuzz-only, 1 conflicted, 1 pending.");
      expect(O.getOrElse(constant(-1))(Str.indexOf("[#11]")(issue.body))).toBeLessThan(
        O.getOrElse(constant(-1))(Str.indexOf("[#12]")(issue.body))
      );
      expect(issue.body).toContain("## Unresolved hunks");
      expect(issue.body).toContain(`- ${SKILL}: \`${PATCH_PATH}\` \`SKILL.md\` hunk 1 — conflicted`);
      const forged = renderSkillTrainBatchIssue("2026-W42", [
        pr(12, [
          comment("2026-10-12T00:00:00Z", conflicted),
          comment("2026-10-14T00:00:00Z", clean, "untrusted-contributor"),
          comment("2026-10-15T00:00:00Z", clean, "github-actions", Str.repeat(40)("b")),
        ]),
      ]);
      expect(forged.body).toContain("1 conflicted, 0 pending");
      expect(forged.body).toContain(`- ${SKILL}: \`${PATCH_PATH}\` \`SKILL.md\` hunk 1 — conflicted`);
      expect(renderSkillTrainBatchIssue("2026-W42", []).body).toContain("_No open skill update pull requests");
    })
  );
});

layer(TestLayer, { timeout: "30 seconds" })("skills update train Renovate manager", (it) => {
  it.effect("matches every vendored lock entry's pin and no local entry", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const argument = S.decodeEffect(RenovateConfig);
      const readFileString4 = yield* fs.readFileString(`${repoRootDir}renovate.json`);
      const renovate = yield* argument(readFileString4);
      const manager = A.getUnsafe(renovate.customManagers, 0);
      expect(manager.datasourceTemplate).toBe("git-refs");
      const pattern = new RegExp(A.getUnsafe(manager.matchStrings, 0), "gu");
      const lockText = yield* fs.readFileString(`${repoRootDir}skills-lock.json`);
      const lock = yield* decodeSkillsLockDocumentJson(lockText);
      const matched = A.map(A.fromIterable(Str.matchAll(pattern)(lockText)), (match) => [
        match.groups?.depName,
        match.groups?.currentDigest,
      ]);
      const vendored = A.flatMap(R.toEntries(lock.skills), ([name, entry]) =>
        entry._tag === "vendored" ? [[name, entry.upstream.sourceRevision]] : []
      );
      expect(matched).toEqual(vendored);
    })
  );
});
