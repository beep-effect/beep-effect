import {
  applySkillPatch,
  decodeSkillsLockDocumentJson,
  encodeSkillsLockDocumentJson,
  LocalSkillLockEntry,
  renderUnifiedHunks,
  SkillEffective,
  SkillMaterializer,
  SkillMaterializerLayer,
  SkillPatch,
  SkillPatches,
  SkillPathHistory,
  SkillSnapshot,
  SkillsLockDocument,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
  VendoredSkillLockEntry,
} from "@beep/repo-cli/commands/Skills";
import { computeSkillTree, hashBytes, installedTargetsHash, patchSetHashOf } from "@beep/repo-cli/test/Skills";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, expect, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SkillMaterializeMode, SkillMaterializeReport } from "@beep/repo-cli/commands/Skills";

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();
const oracleLockFixture = new URL("./fixtures/skills-provenance/oracle-lock-v2.json", import.meta.url).pathname;

const SKILL = "demo";
const CLAUDE_TARGET = `.claude/skills/${SKILL}`;
const AGENTS_TARGET = `.agents/skills/${SKILL}`;
const TARGETS = [CLAUDE_TARGET, AGENTS_TARGET];

const pristineSkill = A.join(
  ["---", "name: demo", "description: Demo fixture.", "---", "", "# Demo", "", "one", "two", "three", "four", ""],
  "\n"
);
const pristineTail = A.join(["five", "six", "seven", "eight", "nine", "ten", "eleven", ""], "\n");
// Two separated hunks: a changed line near the top, and a tail that loses its final newline.
const effectiveSkill =
  Str.replace("two\n", "TWO\n")(pristineSkill) + Str.replace("eleven\n", "eleven\ntwelve")(pristineTail);
const goneText = "remove me\n";
const keepText = "keep\n";
const runText = "#!/bin/sh\necho demo\n";
const openaiText = 'interface:\n  display_name: "Demo"\n';

const file = (path: string, text: string, mode: "100644" | "100755" = "100644") =>
  SkillUpstreamContentFile.make({ path, mode, bytes: textEncoder.encode(text) });

const pristineFiles = [
  file("SKILL.md", pristineSkill + pristineTail),
  file("rules/gone.md", goneText),
  file("rules/keep.md", keepText),
  file("scripts/run.sh", runText, "100755"),
];

const effectiveFiles = [
  file("SKILL.md", effectiveSkill),
  file("agents/openai.yaml", openaiText),
  file("rules/keep.md", keepText),
  file("scripts/run.sh", runText),
];

const header = (path: string) => `diff --git a/${path} b/${path}`;

const modifyPatch = (path: string, before: string, after: string): string =>
  A.join(
    [
      header(path),
      "index 111111111111..222222222222 100644",
      `--- a/${path}`,
      `+++ b/${path}`,
      ...renderUnifiedHunks(before, after),
      "",
    ],
    "\n"
  );

const modeOnlyPatch = (path: string): string => A.join([header(path), "old mode 100755", "new mode 100644", ""], "\n");

const createPatch = (path: string, after: string): string =>
  A.join(
    [
      header(path),
      "new file mode 100644",
      "index 000000000000..222222222222",
      "--- /dev/null",
      `+++ b/${path}`,
      ...renderUnifiedHunks("", after),
      "",
    ],
    "\n"
  );

const deletePatch = (path: string, before: string): string =>
  A.join(
    [
      header(path),
      "deleted file mode 100644",
      "index 111111111111..000000000000",
      `--- a/${path}`,
      "+++ /dev/null",
      ...renderUnifiedHunks(before, ""),
      "",
    ],
    "\n"
  );

// The series the lock records, in order: one multi-section patch, then a new file.
const patchSeries = [
  {
    path: `.agents/skill-patches/${SKILL}/0001-skill-md.patch`,
    text:
      modifyPatch("SKILL.md", pristineSkill + pristineTail, effectiveSkill) +
      deletePatch("rules/gone.md", goneText) +
      modeOnlyPatch("scripts/run.sh"),
  },
  {
    path: `.agents/skill-patches/${SKILL}/0002-agents-openai-yaml.patch`,
    text: createPatch("agents/openai.yaml", openaiText),
  },
];

const applySeries = (files: ReadonlyArray<SkillUpstreamContentFile>) =>
  Effect.reduce(
    patchSeries,
    () => files,
    (tree, patch) => applySkillPatch(patch.path, patch.text, tree)
  );

const pinnedHistory = S.decodeEffect(SkillPathHistory)({
  revisions: ["d6e773a562dc85c2a81b7c571f40ca2d81896679"],
  truncated: false,
}).pipe(Effect.orDie);

const sourceOf = (files: ReadonlyArray<SkillUpstreamContentFile>) =>
  SkillUpstreamContentSource.of({
    load: Effect.fn("SkillsMaterializeTest.source.load")(() =>
      Effect.succeed(SkillUpstreamContent.make({ files, licenseBytes: new Uint8Array() }))
    ),
    listPathHistory: Effect.fn("SkillsMaterializeTest.source.listPathHistory")(() => pinnedHistory),
  });

const writeTree = Effect.fn("SkillsMaterializeTest.writeTree")(function* (
  root: string,
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.remove(root, { recursive: true, force: true });
  yield* fs.makeDirectory(root, { recursive: true });
  for (const entry of files) {
    const absolute = path.join(root, entry.path);
    yield* fs.makeDirectory(path.dirname(absolute), { recursive: true });
    yield* fs.writeFile(absolute, entry.bytes);
    yield* fs.chmod(absolute, entry.mode === "100755" ? 0o755 : 0o644);
  }
});

const readText = Effect.fn("SkillsMaterializeTest.readText")(function* (root: string, relative: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(root, relative));
});

type Layout = "linked" | "split";

// A temp repository holding the lock, the patch series, and both install targets. `linked`
// mirrors this repository (`.agents/skills` is a symlink onto `.claude/skills`); `split` gives
// each target its own directory, so the clearing house publishes two physical trees.
const makeRepo = Effect.fn("SkillsMaterializeTest.makeRepo")(function* (layout: Layout) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: `skills-materialize-${layout}-` });
  yield* fs.makeDirectory(path.join(repoRoot, ".claude/skills"), { recursive: true });
  yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
  if (layout === "linked") {
    yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));
  }
  for (const patch of patchSeries) {
    const absolute = path.join(repoRoot, patch.path);
    yield* fs.makeDirectory(path.dirname(absolute), { recursive: true });
    yield* fs.writeFileString(absolute, patch.text);
  }
  for (const target of TARGETS) {
    yield* writeTree(path.join(repoRoot, target), effectiveFiles);
  }
  yield* writeTree(path.join(repoRoot, ".claude/skills/local-one"), [file("SKILL.md", "---\nname: local-one\n---\n")]);
  if (layout === "split") {
    yield* writeTree(path.join(repoRoot, ".agents/skills/local-one"), [
      file("SKILL.md", "---\nname: local-one\n---\n"),
    ]);
  }

  const pristine = yield* computeSkillTree(pristineFiles, "pristine");
  const effective = yield* computeSkillTree(effectiveFiles, "effective");
  const patchBytes = A.map(patchSeries, (patch) => ({ path: patch.path, bytes: textEncoder.encode(patch.text) }));
  const series = yield* Effect.forEach(
    patchBytes,
    Effect.fnUntraced(function* (patch) {
      return SkillPatch.make({
        path: patch.path,
        sha256: yield* hashBytes(patch.bytes, patch.path),
        label: "temporary-drift",
        owner: "@kriegcloud",
        dropCondition: "Drop when upstream contains an equivalent change.",
      });
    })
  );
  const base = (yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(oracleLockFixture))).skills.oracle;
  assert(base !== undefined && base._tag === "vendored");
  const localTree = yield* computeSkillTree([file("SKILL.md", "---\nname: local-one\n---\n")], "local");
  const vendored = VendoredSkillLockEntry.make({
    ...base,
    snapshot: SkillSnapshot.make({
      algorithm: "sha256",
      treeHash: pristine.treeHash,
      fileCount: pristine.manifest.length,
      manifestHash: pristine.manifestHash,
      manifest: pristine.manifest,
    }),
    patches: SkillPatches.make({
      required: true,
      patchSetHash: yield* patchSetHashOf(patchBytes, SKILL),
      series,
    }),
    effective: SkillEffective.make({
      treeHash: effective.treeHash,
      installedTargets: TARGETS,
      installedTreeHash: yield* installedTargetsHash(
        A.map(TARGETS, (target) => [target, effective.treeHash] as const),
        SKILL
      ),
    }),
  });
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

const materialize = Effect.fn("SkillsMaterializeTest.materialize")(function* (
  repoRoot: string,
  mode: SkillMaterializeMode,
  options: {
    readonly source?: ReadonlyArray<SkillUpstreamContentFile>;
    readonly fileSystem?: FileSystem.FileSystem;
  } = {}
) {
  const sourceLayer = Layer.succeed(SkillUpstreamContentSource, sourceOf(options.source ?? pristineFiles));
  const materializerLayer = SkillMaterializerLayer.pipe(
    Layer.provide(sourceLayer),
    Layer.provide(
      options.fileSystem === undefined ? Layer.empty : Layer.succeed(FileSystem.FileSystem, options.fileSystem)
    )
  );
  const context = yield* Layer.build(materializerLayer);
  return yield* Context.get(context, SkillMaterializer).materialize(repoRoot, mode, O.none());
});

const rowOf = (report: SkillMaterializeReport, skill: string) =>
  A.findFirst(report.rows, (entry) => entry.skill === skill).pipe(O.getOrThrow);

const targetStates = (report: SkillMaterializeReport, skill: string) =>
  A.map(rowOf(report, skill).targets, (target) => [target.target, target.state] as const);

layer(TestLayer, { timeout: "30 seconds" })("strict skill patch apply", (it) => {
  it.effect("reconstructs the effective tree byte for byte from the pristine tree and the series", () =>
    Effect.gen(function* () {
      const rebuilt = yield* applySeries(pristineFiles);
      expect(A.map(rebuilt, (entry) => [entry.path, entry.mode, textDecoder.decode(entry.bytes)])).toEqual(
        A.map(effectiveFiles, (entry) => [entry.path, entry.mode, textDecoder.decode(entry.bytes)])
      );
      expect((yield* computeSkillTree(rebuilt, "rebuilt")).treeHash).toBe(
        (yield* computeSkillTree(effectiveFiles, "effective")).treeHash
      );
      // The no-newline tail survived the round trip.
      expect(Str.endsWith("twelve")(textDecoder.decode(A.getUnsafe(rebuilt, 0).bytes))).toBe(true);
    })
  );

  it.effect("refuses a hunk whose context moved instead of searching nearby lines", () =>
    Effect.gen(function* () {
      // One extra line at the top shifts every hunk; an applier with offset search would accept it.
      const shifted = A.map(pristineFiles, (entry) =>
        entry.path === "SKILL.md" ? file("SKILL.md", `extra\n${pristineSkill}${pristineTail}`) : entry
      );
      const moved = yield* applySeries(shifted).pipe(Effect.flip);
      expect([moved._tag, moved.reason, moved.file, moved.patch]).toEqual([
        "SkillPatchApplyError",
        "context-mismatch",
        "SKILL.md",
        A.getUnsafe(patchSeries, 0).path,
      ]);

      // A changed context line at the recorded position is refused too.
      const edited = A.map(pristineFiles, (entry) =>
        entry.path === "SKILL.md"
          ? file("SKILL.md", Str.replace("three\n", "THREE\n")(pristineSkill) + pristineTail)
          : entry
      );
      expect((yield* applySeries(edited).pipe(Effect.flip)).reason).toBe("context-mismatch");

      // A new-file section over an existing file, and a malformed hunk body.
      const existing = A.append(pristineFiles, file("agents/openai.yaml", "already here\n"));
      expect((yield* applySeries(existing).pipe(Effect.flip)).reason).toBe("file-exists");
      const truncated = Str.replace(" three\n", "")(A.getUnsafe(patchSeries, 0).text);
      expect((yield* applySkillPatch("broken.patch", truncated, pristineFiles).pipe(Effect.flip)).reason).toBe(
        "malformed-patch"
      );
      expect(
        (yield* applySkillPatch("rename.patch", "diff --git a/a.md b/b.md\nrename from a.md\n", pristineFiles).pipe(
          Effect.flip
        )).reason
      ).toBe("unsupported-patch");
    })
  );

  it.effect("keeps a leading byte order mark through decode and re-encode", () =>
    Effect.gen(function* () {
      const patch = A.join(
        [
          "diff --git a/bom.md b/bom.md",
          "--- a/bom.md",
          "+++ b/bom.md",
          "@@ -1,3 +1,3 @@",
          " \uFEFFa",
          "-b",
          "+B",
          " c",
          "",
        ],
        "\n"
      );
      const patched = yield* applySkillPatch("bom.patch", patch, [file("bom.md", "\uFEFFa\nb\nc\n")]);
      expect(A.fromIterable(A.getUnsafe(patched, 0).bytes)).toEqual(
        A.fromIterable(textEncoder.encode("\uFEFFa\nB\nc\n"))
      );
    })
  );

  it.effect("applies a mode-only section to a file that is not UTF-8 without decoding it", () =>
    Effect.gen(function* () {
      const bytes = Uint8Array.from([0xff, 0xfe, 0x00, 0x80]);
      const patch = A.join(["diff --git a/blob.bin b/blob.bin", "old mode 100644", "new mode 100755", ""], "\n");
      const patched = yield* applySkillPatch("mode.patch", patch, [
        SkillUpstreamContentFile.make({ path: "blob.bin", mode: "100644", bytes }),
      ]);
      const blob = A.getUnsafe(patched, 0);
      expect([blob.mode, A.fromIterable(blob.bytes)]).toEqual(["100755", A.fromIterable(bytes)]);
    })
  );
});

layer(TestLayer, { timeout: "60 seconds" })("skills materialize", (it) => {
  it.effect("verifies a current install in check mode, writing nothing", () =>
    Effect.gen(function* () {
      const repoRoot = yield* makeRepo("linked");
      const report = yield* materialize(repoRoot, "check");
      expect(A.map(report.rows, (row) => [row.skill, row.kind, row.status, row.patches])).toEqual([
        [SKILL, "vendored", "current", 2],
        ["local-one", "local", "current", 0],
      ]);
    })
  );

  it.effect("reverts a hand edit through the one writer and leaves the symlinked targets equivalent", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("linked");
      yield* fs.writeFileString(path.join(repoRoot, CLAUDE_TARGET, "SKILL.md"), "hand edit\n");

      const checked = yield* materialize(repoRoot, "check");
      expect(rowOf(checked, SKILL).status).toBe("would-rebuild");
      expect(yield* readText(repoRoot, `${AGENTS_TARGET}/SKILL.md`)).toBe("hand edit\n");

      const written = yield* materialize(repoRoot, "write");
      expect(rowOf(written, SKILL).status).toBe("rebuilt");
      for (const target of TARGETS) {
        expect(yield* readText(repoRoot, `${target}/SKILL.md`)).toBe(effectiveSkill);
      }
      expect((yield* fs.stat(path.join(repoRoot, CLAUDE_TARGET, "scripts/run.sh"))).mode & 0o777).toBe(0o644);
      // `.agents/skills` is still the link, and no stage or set-aside tree is left behind.
      expect(yield* fs.readLink(path.join(repoRoot, ".agents/skills"))).toBe("../.claude/skills");
      expect(yield* fs.exists(path.join(repoRoot, ".claude/.skills-materialize"))).toBe(false);
      expect(rowOf(yield* materialize(repoRoot, "check"), SKILL).status).toBe("current");
    })
  );

  it.effect("detects a crash between the two renames as target skew and repairs it with a re-run", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("split");
      // What a process that died between the renames leaves: one target new, the other old.
      yield* writeTree(path.join(repoRoot, AGENTS_TARGET), pristineFiles);
      // ...plus a stale stage and set-aside tree that no restore ran for.
      yield* writeTree(path.join(repoRoot, `.agents/.skills-materialize/${SKILL}.stage-dead`), pristineFiles);

      const checked = yield* materialize(repoRoot, "check");
      expect(rowOf(checked, SKILL).status).toBe("would-rebuild");
      expect(targetStates(checked, SKILL)).toEqual([
        [CLAUDE_TARGET, "matches"],
        [AGENTS_TARGET, "differs"],
      ]);

      const repaired = yield* materialize(repoRoot, "write");
      expect(rowOf(repaired, SKILL).status).toBe("rebuilt");
      expect(yield* readText(repoRoot, `${AGENTS_TARGET}/agents/openai.yaml`)).toBe(openaiText);
      expect(yield* fs.exists(path.join(repoRoot, AGENTS_TARGET, "rules/gone.md"))).toBe(false);
      expect(yield* fs.exists(path.join(repoRoot, ".agents/.skills-materialize"))).toBe(false);
      expect(targetStates(yield* materialize(repoRoot, "check"), SKILL)).toEqual([
        [CLAUDE_TARGET, "matches"],
        [AGENTS_TARGET, "matches"],
      ]);
    })
  );

  it.effect("restores both targets when a rename fails after the first target was published", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("split");
      for (const target of TARGETS) {
        yield* fs.writeFileString(path.join(repoRoot, target, "SKILL.md"), "hand edit\n");
      }
      // Renames run: claude aside, claude stage in, agents aside, agents stage in. Fail the fourth.
      const renames = yield* Ref.make(0);
      const failingRename: FileSystem.FileSystem = {
        ...fs,
        rename: (from, to) =>
          Effect.flatMap(
            Ref.updateAndGet(renames, (count) => count + 1),
            (count) =>
              count === 4
                ? Effect.fail(
                    PlatformError.systemError({
                      _tag: "PermissionDenied",
                      module: "FileSystem",
                      method: "rename",
                      pathOrDescriptor: to,
                    })
                  )
                : fs.rename(from, to)
          ),
      };

      const error = yield* materialize(repoRoot, "write", { fileSystem: failingRename }).pipe(Effect.flip);

      expect(error._tag).toBe("SkillsCommandError");
      expect(error.message).toContain("Failed to publish");
      expect(yield* Ref.get(renames)).toBeGreaterThanOrEqual(4);
      for (const target of TARGETS) {
        expect(yield* readText(repoRoot, `${target}/SKILL.md`)).toBe("hand edit\n");
        expect(yield* fs.exists(path.join(repoRoot, target, "agents/openai.yaml"))).toBe(true);
      }
      for (const workDir of [".claude/.skills-materialize", ".agents/.skills-materialize"]) {
        const leftovers = yield* fs
          .readDirectory(path.join(repoRoot, workDir))
          .pipe(Effect.orElseSucceed(A.empty<string>));
        expect(leftovers).toEqual([]);
      }
      // A plain re-run then publishes both targets.
      expect(rowOf(yield* materialize(repoRoot, "write"), SKILL).status).toBe("rebuilt");
      expect(rowOf(yield* materialize(repoRoot, "check"), SKILL).status).toBe("current");
    })
  );

  it.effect("names a set-aside tree it could not move back and refuses to sweep it later", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("split");
      yield* fs.writeFileString(path.join(repoRoot, CLAUDE_TARGET, "SKILL.md"), "hand edit\n");
      // Renames 1-4 publish both targets; fail the fourth, then fail restoring the claude tree (sixth).
      const renames = yield* Ref.make(0);
      const failingRename: FileSystem.FileSystem = {
        ...fs,
        rename: (from, to) =>
          Effect.flatMap(
            Ref.updateAndGet(renames, (count) => count + 1),
            (count) =>
              count === 4 || count === 6
                ? Effect.fail(
                    PlatformError.systemError({
                      _tag: "PermissionDenied",
                      module: "FileSystem",
                      method: "rename",
                      pathOrDescriptor: to,
                    })
                  )
                : fs.rename(from, to)
          ),
      };

      const error = yield* materialize(repoRoot, "write", { fileSystem: failingRename }).pipe(Effect.flip);
      expect(error._tag).toBe("SkillsCommandError");
      expect(error.message).toContain("could not be moved back");
      const workDir = path.join(repoRoot, ".claude/.skills-materialize");
      const kept = A.filter(yield* fs.readDirectory(workDir), Str.endsWith(".previous"));
      expect(A.length(kept)).toBe(1);
      expect(yield* fs.readFileString(path.join(workDir, A.getUnsafe(kept, 0), "SKILL.md"))).toBe("hand edit\n");

      const refused = yield* materialize(repoRoot, "write").pipe(Effect.flip);
      expect(refused.message).toContain(A.getUnsafe(kept, 0));
      expect(yield* fs.exists(path.join(workDir, A.getUnsafe(kept, 0)))).toBe(true);
    })
  );

  it.effect("refuses an install target that is not the skill's own directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("linked");
      const lockPath = path.join(repoRoot, "skills-lock.json");
      const lock = yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(lockPath));
      const entry = lock.skills[SKILL];
      assert(entry !== undefined && entry._tag === "vendored");
      const widened = VendoredSkillLockEntry.make({
        ...entry,
        effective: SkillEffective.make({ ...entry.effective, installedTargets: [CLAUDE_TARGET, ".claude/skills"] }),
      });
      yield* fs.writeFileString(
        lockPath,
        `${yield* encodeSkillsLockDocumentJson(SkillsLockDocument.make({ ...lock, skills: { ...lock.skills, [SKILL]: widened } }))}\n`
      );

      const refused = yield* materialize(repoRoot, "check").pipe(Effect.flip);
      expect([refused._tag, refused._tag === "SkillMaterializeRefusal" ? refused.reason : ""]).toEqual([
        "SkillMaterializeRefusal",
        "unsafe-target",
      ]);
    })
  );

  it.effect("refuses an unverified pristine tree or patch before writing anything", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("linked");
      yield* fs.writeFileString(path.join(repoRoot, CLAUDE_TARGET, "SKILL.md"), "hand edit\n");

      const movedUpstream = A.map(pristineFiles, (entry) =>
        entry.path === "rules/keep.md" ? file("rules/keep.md", "upstream moved\n") : entry
      );
      const pristine = yield* materialize(repoRoot, "write", { source: movedUpstream }).pipe(Effect.flip);
      expect([pristine._tag, pristine._tag === "SkillMaterializeRefusal" ? pristine.reason : ""]).toEqual([
        "SkillMaterializeRefusal",
        "pristine-mismatch",
      ]);

      yield* fs.writeFileString(path.join(repoRoot, A.getUnsafe(patchSeries, 1).path), "tampered\n");
      const tampered = yield* materialize(repoRoot, "write").pipe(Effect.flip);
      expect(tampered._tag === "SkillMaterializeRefusal" ? tampered.reason : tampered._tag).toBe(
        "patch-digest-mismatch"
      );
      expect(yield* readText(repoRoot, `${CLAUDE_TARGET}/SKILL.md`)).toBe("hand edit\n");
    })
  );

  it.effect("reports local drift without rewriting the local skill", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* makeRepo("linked");
      yield* fs.writeFileString(path.join(repoRoot, ".claude/skills/local-one/SKILL.md"), "edited\n");
      const report = yield* materialize(repoRoot, "write");
      expect(rowOf(report, "local-one").status).toBe("local-drift");
      expect(yield* readText(repoRoot, ".claude/skills/local-one/SKILL.md")).toBe("edited\n");
    })
  );
});
