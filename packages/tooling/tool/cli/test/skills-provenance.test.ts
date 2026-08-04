import {
  decodeSkillEffective,
  decodeSkillLicense,
  decodeSkillLockV2Entry,
  decodeSkillPatch,
  decodeSkillPatches,
  decodeSkillProvenance,
  decodeSkillSnapshot,
  decodeSkillSnapshotFile,
  decodeSkillsLockV2,
  decodeSkillsLockV2Json,
  decodeSkillUpstream,
  encodeSkillEffective,
  encodeSkillLicense,
  encodeSkillLockV2Entry,
  encodeSkillPatch,
  encodeSkillPatches,
  encodeSkillProvenance,
  encodeSkillSnapshot,
  encodeSkillSnapshotFile,
  encodeSkillsLockV2,
  encodeSkillsLockV2Json,
  encodeSkillUpstream,
  resolveSkillProvenance,
  SkillUpstreamContent,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
} from "@beep/repo-cli/commands/Skills";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, Encoding, FileSystem, Layer, Path } from "effect";
import * as A from "effect/Array";
import * as Str from "effect/String";

const fixtureRoot = new URL("./fixtures/skills-provenance", import.meta.url).pathname;
const textEncoder = new TextEncoder();

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

const readFixtureText = Effect.fn("SkillsProvenanceTest.readFixtureText")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(fixtureRoot, relativePath));
});

const readFixtureBinary = Effect.fn("SkillsProvenanceTest.readFixtureBinary")(function* (relativePath: string) {
  const encoded = Str.trim(yield* readFixtureText(relativePath));
  return yield* Effect.fromResult(Encoding.decodeHex(encoded));
});

const writeFixtureFile = Effect.fn("SkillsProvenanceTest.writeFixtureFile")(function* (
  repoRoot: string,
  relativePath: string,
  bytes: Uint8Array
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const target = path.join(repoRoot, relativePath);
  yield* fs.makeDirectory(path.dirname(target), { recursive: true });
  yield* fs.writeFile(target, Uint8Array.from(bytes));
});

const makeFixtureSource = Effect.fn("SkillsProvenanceTest.makeFixtureSource")(function* () {
  const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
  const compositionText = yield* readFixtureText("shadcn/upstream/rules/composition.md");
  const pngBytes = yield* readFixtureBinary("shadcn/upstream/assets/example.png.hex");
  const licenseBytes = textEncoder.encode(yield* readFixtureText("shadcn/LICENSE.md"));

  return SkillUpstreamContentSource.of({
    load: Effect.fn("SkillsProvenanceTest.fixtureSource.load")((resolution) => {
      expect(resolution.name).toBe("shadcn");
      expect(resolution.upstream.sourceRevision).toBe("91f21dfe1328585670275781b4525fff2507f917");
      return Effect.succeed(
        SkillUpstreamContent.make({
          files: [
            SkillUpstreamContentFile.make({
              path: "SKILL.md",
              mode: "100644",
              bytes: textEncoder.encode(skillText),
            }),
            SkillUpstreamContentFile.make({
              path: "assets/example.png",
              mode: "100644",
              bytes: pngBytes,
            }),
            SkillUpstreamContentFile.make({
              path: "rules/composition.md",
              mode: "100644",
              bytes: textEncoder.encode(compositionText),
            }),
          ],
          licenseBytes,
        })
      );
    }),
  });
});

layer(TestLayer)("skills-lock/v2 schemas", (it) => {
  it.effect("round-trips every lock block and the complete document", () =>
    Effect.gen(function* () {
      const fixture = Str.trimEnd(yield* readFixtureText("oracle-lock-v2.json"));
      const document = yield* decodeSkillsLockV2Json(fixture);
      const entry = document.skills.oracle;

      expect(entry).toBeDefined();
      if (entry === undefined) {
        return;
      }

      expect(yield* decodeSkillUpstream(yield* encodeSkillUpstream(entry.upstream))).toEqual(entry.upstream);
      expect(yield* decodeSkillSnapshot(yield* encodeSkillSnapshot(entry.snapshot))).toEqual(entry.snapshot);
      expect(yield* decodeSkillSnapshotFile(yield* encodeSkillSnapshotFile(entry.snapshot.manifest[0]))).toEqual(
        entry.snapshot.manifest[0]
      );
      expect(yield* decodeSkillLicense(yield* encodeSkillLicense(entry.license))).toEqual(entry.license);
      expect(yield* decodeSkillProvenance(yield* encodeSkillProvenance(entry.provenance))).toEqual(entry.provenance);
      expect(yield* decodeSkillPatches(yield* encodeSkillPatches(entry.patches))).toEqual(entry.patches);
      expect(yield* decodeSkillPatch(yield* encodeSkillPatch(entry.patches.series[0]))).toEqual(
        entry.patches.series[0]
      );
      expect(yield* decodeSkillEffective(yield* encodeSkillEffective(entry.effective))).toEqual(entry.effective);
      expect(yield* decodeSkillLockV2Entry(yield* encodeSkillLockV2Entry(entry))).toEqual(entry);
      expect(yield* decodeSkillsLockV2(yield* encodeSkillsLockV2(document))).toEqual(document);
    })
  );

  it.effect("preserves oracle's inferred medium-confidence d6e773a representation byte-identically", () =>
    Effect.gen(function* () {
      const fixture = Str.trimEnd(yield* readFixtureText("oracle-lock-v2.json"));
      const document = yield* decodeSkillsLockV2Json(fixture);
      const entry = document.skills.oracle;

      expect(entry).toBeDefined();
      if (entry === undefined) {
        return;
      }

      expect(entry.provenance.status).toBe("inferred");
      expect(entry.provenance.confidence).toBe("medium");
      expect(entry.upstream.sourceRevision).toBe("d6e773a562dc85c2a81b7c571f40ca2d81896679");
      expect(Str.startsWith("d6e773a")(entry.upstream.sourceRevision)).toBe(true);
      const encoded = yield* encodeSkillsLockV2Json(document);
      const decodedAgain = yield* decodeSkillsLockV2Json(encoded);
      expect(yield* encodeSkillsLockV2Json(decodedAgain)).toBe(encoded);
    })
  );
});

layer(TestLayer)("skills provenance service", (it) => {
  it.effect("detects text drift while proving the exact pin and unchanged binary asset", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-provenance-" });
        const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
        const localComposition = yield* readFixtureText("shadcn/local/rules/composition.md");
        const pngBytes = yield* readFixtureBinary("shadcn/upstream/assets/example.png.hex");
        const source = yield* makeFixtureSource();

        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(skillText));
        yield* writeFixtureFile(
          repoRoot,
          ".claude/skills/shadcn/rules/composition.md",
          textEncoder.encode(localComposition)
        );
        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/assets/example.png", pngBytes);
        yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
        yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));

        const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(
          Effect.provideService(SkillUpstreamContentSource, source)
        );

        expect(report.entry.upstream.sourceRevision).toBe("91f21dfe1328585670275781b4525fff2507f917");
        expect(report.entry.snapshot.fileCount).toBe(3);
        expect(A.map(report.entry.snapshot.manifest, (file) => file.path)).toEqual([
          "SKILL.md",
          "assets/example.png",
          "rules/composition.md",
        ]);
        expect(report.entry.snapshot.manifest[1]?.sha256).toHaveLength(64);
        expect(report.entry.provenance.status).toBe("exact");
        expect(report.entry.provenance.confidence).toBe("high");
        expect(report.entry.provenance.matchedFileCount).toBe(2);
        expect(report.entry.provenance.upstreamFileCount).toBe(3);
        expect(report.driftPaths).toEqual(["rules/composition.md"]);
        expect(report.entry.patches.required).toBe(true);
        expect(report.entry.patches.series).toHaveLength(1);
        expect(report.entry.patches.series[0]?.label).toBe("temporary-drift");
        expect(report.entry.patches.series[0]?.path).toBe("patches/0001-local-drift.patch");
        expect(report.entry.effective.installedTargets).toEqual([".claude/skills/shadcn", ".agents/skills/shadcn"]);
        expect(report.entry.effective.installedTreeHash).toHaveLength(64);
        expect(report.entry.effective.treeHash).not.toBe(report.entry.snapshot.treeHash);
        expect(yield* fs.exists(path.join(repoRoot, "skills-lock.json"))).toBe(false);
        expect(yield* fs.exists(path.join(repoRoot, "patches"))).toBe(false);
      })
    )
  );
});
