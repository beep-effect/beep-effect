import { pathToFileURL } from "node:url";
import {
  decodeSkillEffective,
  decodeSkillLicense,
  decodeSkillPatch,
  decodeSkillPatches,
  decodeSkillProvenance,
  decodeSkillSnapshot,
  decodeSkillSnapshotFile,
  decodeSkillsLockDocumentJson,
  decodeSkillUpstream,
  encodeSkillEffective,
  encodeSkillLicense,
  encodeSkillPatch,
  encodeSkillPatches,
  encodeSkillProvenance,
  encodeSkillSnapshot,
  encodeSkillSnapshotFile,
  encodeSkillsLockDocumentJson,
  encodeSkillUpstream,
  findSkillResolutionSeed,
  LocalSkillLockEntry,
  planSkillsLockMigration,
  renderSkillsLockMigrationPlanSummary,
  renderUnifiedHunks,
  resolveCodeownersOwner,
  resolveSkillProvenance,
  SkillDriftRow,
  SkillGitRevision,
  SkillPatchOwnerSource,
  SkillPathHistory,
  SkillPathHistoryWindow,
  SkillPinProposal,
  SkillsLockDocument,
  SkillsLockWriteRefusal,
  SkillUpstreamContent,
  SkillUpstreamContentError,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
  SkillUpstreamContentSourceLive,
  skillPatchOwnerSourceFromCodeowners,
  skillResolutionSeeds,
  VendoredSkillLockEntry,
  writeSkillsLockMigration,
} from "@beep/repo-cli/commands/Skills";
import { stagedPatchPath } from "@beep/repo-cli/test/Skills";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { Sha256HexFromBytes } from "@beep/schema";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, layer } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import { HttpClient, HttpClientResponse } from "effect/http";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SkillMigrationRow, VendoredMigrationRow } from "@beep/repo-cli/commands/Skills";

const PINNED_SHADCN_REVISION = "91f21dfe1328585670275781b4525fff2507f917";

const fixtureRoot = new URL("./fixtures/skills-provenance", import.meta.url).pathname;
const textEncoder = new TextEncoder();
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const TestLayer = Layer.mergeAll(
  NodeServices.layer,
  NodeCrypto.layer,
  Layer.succeed(SkillPatchOwnerSource, skillPatchOwnerSourceFromCodeowners("* @kriegcloud\n"))
);

const pinnedHistory = S.decodeEffect(SkillPathHistory)({
  revisions: [PINNED_SHADCN_REVISION],
  truncated: false,
}).pipe(Effect.orDie);

const readFixtureText = Effect.fn("SkillsProvenanceTest.readFixtureText")(function* (relativePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* fs.readFileString(path.join(fixtureRoot, relativePath));
});

const readFixtureBinary = Effect.fn("SkillsProvenanceTest.readFixtureBinary")(function* (relativePath: string) {
  const encoded = Str.trim(yield* readFixtureText(relativePath));
  return yield* Effect.fromResult(Hex.decode(encoded));
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

const linkAgentsTarget = Effect.fn("SkillsProvenanceTest.linkAgentsTarget")(function* (repoRoot: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.makeDirectory(path.join(repoRoot, ".agents"), { recursive: true });
  yield* fs.symlink("../.claude/skills", path.join(repoRoot, ".agents/skills"));
});

const makeStubSource = Effect.fn("SkillsProvenanceTest.makeStubSource")(function* (
  files: ReadonlyArray<SkillUpstreamContentFile>
) {
  const licenseBytes = textEncoder.encode(yield* readFixtureText("shadcn/LICENSE.md"));

  return SkillUpstreamContentSource.of({
    load: Effect.fn("SkillsProvenanceTest.stubSource.load")(() =>
      Effect.succeed(SkillUpstreamContent.make({ files, licenseBytes }))
    ),
    listPathHistory: Effect.fn("SkillsProvenanceTest.listPathHistory")(() => pinnedHistory),
  });
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
    listPathHistory: Effect.fn("SkillsProvenanceTest.listPathHistory")(() => pinnedHistory),
  });
});

layer(TestLayer)("skills-lock/v2 schemas", (it) => {
  it.effect("round-trips every lock block and the complete document", () =>
    Effect.gen(function* () {
      const fixture = Str.trimEnd(yield* readFixtureText("oracle-lock-v2.json"));
      const document = yield* decodeSkillsLockDocumentJson(fixture);
      const entry = document.skills.oracle;

      expect(entry?._tag).toBe("vendored");
      if (entry === undefined || entry._tag !== "vendored") {
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
      expect(
        yield* S.decodeEffect(VendoredSkillLockEntry)(yield* S.encodeEffect(VendoredSkillLockEntry)(entry))
      ).toEqual(entry);
      expect(yield* decodeSkillsLockDocumentJson(yield* encodeSkillsLockDocumentJson(document))).toEqual(document);
    })
  );

  it.effect("preserves oracle's inferred medium-confidence d6e773a representation byte-identically", () =>
    Effect.gen(function* () {
      const fixture = Str.trimEnd(yield* readFixtureText("oracle-lock-v2.json"));
      const document = yield* decodeSkillsLockDocumentJson(fixture);
      const entry = document.skills.oracle;

      expect(entry?._tag).toBe("vendored");
      if (entry === undefined || entry._tag !== "vendored") {
        return;
      }

      expect(entry.provenance.status).toBe("inferred");
      expect(entry.provenance.confidence).toBe("medium");
      expect(entry.upstream.sourceRevision).toBe("d6e773a562dc85c2a81b7c571f40ca2d81896679");
      expect(Str.startsWith("d6e773a")(entry.upstream.sourceRevision)).toBe(true);
      const encoded = yield* encodeSkillsLockDocumentJson(document);
      const decodedAgain = yield* decodeSkillsLockDocumentJson(encoded);
      expect(yield* encodeSkillsLockDocumentJson(decodedAgain)).toBe(encoded);
    })
  );
});

layer(TestLayer, { timeout: "60 seconds" })("skills resolution seeds", (it) => {
  it.effect("decodes the six ratified first-wave resolutions with unique names", () =>
    Effect.gen(function* () {
      const seeds = yield* skillResolutionSeeds;
      expect(A.map(seeds, (seed) => seed.name)).toStrictEqual([
        "grill-me",
        "oracle",
        "portless",
        "shadcn",
        "teach",
        "turborepo",
      ]);
      const oracle = yield* findSkillResolutionSeed("oracle");
      oracle.pipe(O.isSome, assertTrue);
      if (O.isSome(oracle)) {
        expect([oracle.value.provenanceStatus, oracle.value.provenanceConfidence]).toStrictEqual([
          "inferred",
          "medium",
        ]);
      }
      assertNone(yield* findSkillResolutionSeed("yeet"));
    })
  );

  it.effect("refuses provenance for a skill with no ratified seed", () =>
    Effect.gen(function* () {
      const repoRoot = yield* findRepoRoot();
      const exit = yield* Effect.exit(resolveSkillProvenance("yeet", repoRoot));
      exit.pipe(Exit.isFailure, assertTrue);
      expect(String(exit)).toContain("No ratified provenance resolution");
    }).pipe(
      // Resolution fails before the source is acquired, so an untouched dying stub proves it.
      Effect.provideService(
        SkillUpstreamContentSource,
        SkillUpstreamContentSource.of({
          load: Effect.fn("SkillsProvenanceTest.unreachable.load")(() =>
            Effect.die("content source must not be reached")
          ),
          listPathHistory: Effect.fn("SkillsProvenanceTest.unreachable.listPathHistory")(() =>
            Effect.die("content source must not be reached")
          ),
        })
      )
    )
  );
});

const REVISION_1 = "1111111111111111111111111111111111111111";
const REVISION_2 = "2222222222222222222222222222222222222222";
const REVISION_3 = "3333333333333333333333333333333333333333";
const REVISION_4 = "4444444444444444444444444444444444444444";

const SKILLS_LOCK_V1_FIXTURE = `${JSON.stringify(
  {
    version: 1,
    skills: {
      yeet: { source: "beep-effect/beep-effect", sourceType: "local", computedHash: "0".repeat(64) },
      shadcn: {
        source: "shadcn-ui/ui",
        sourceType: "github",
        computedHash: "0".repeat(64),
        ref: "main",
        skillPath: "skills/shadcn/SKILL.md",
      },
      adhd: { source: "someone/adhd", sourceType: "github", computedHash: "0".repeat(64), ref: "main" },
    },
  },
  null,
  2
)}\n`;

/** One upstream tree the fake source serves: the three shadcn fixture files, varied by text. */
const FakeTree = S.Struct({ skill: S.String, composition: S.String });
type FakeTree = typeof FakeTree.Type;

/**
 * A fake upstream with a path history. `trees` maps a revision to its tree; a
 * revision without a tree is one where the skill path is absent. `loaded`
 * records every revision the plan loaded, in order.
 */
const makeHistorySource = Effect.fn("SkillsLockPlanTest.makeHistorySource")(function* (options: {
  readonly trees: ReadonlyArray<readonly [string, FakeTree]>;
  readonly history: ReadonlyArray<string>;
  readonly truncated: boolean;
  readonly licenseText?: string;
}) {
  const pngBytes = yield* readFixtureBinary("shadcn/upstream/assets/example.png.hex");
  const licenseBytes = textEncoder.encode(options.licenseText ?? (yield* readFixtureText("shadcn/LICENSE.md")));
  const history = yield* S.decodeUnknownEffect(SkillPathHistory)({
    revisions: options.history,
    truncated: options.truncated,
  }).pipe(Effect.orDie);
  const loaded: Array<string> = [];
  const source = SkillUpstreamContentSource.of({
    load: Effect.fn("SkillsLockPlanTest.history.load")(function* (resolution) {
      const revision = resolution.upstream.sourceRevision;
      loaded.push(revision);
      const tree = A.findFirst(options.trees, ([candidate]) => candidate === revision);
      if (O.isNone(tree)) {
        return yield* SkillUpstreamContentError.make({
          skill: resolution.name,
          reason: "path-absent",
          message: `No files found at ${revision}.`,
        });
      }
      const [, files] = tree.value;
      return SkillUpstreamContent.make({
        files: [
          SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: textEncoder.encode(files.skill) }),
          SkillUpstreamContentFile.make({ path: "assets/example.png", mode: "100644", bytes: pngBytes }),
          SkillUpstreamContentFile.make({
            path: "rules/composition.md",
            mode: "100644",
            bytes: textEncoder.encode(files.composition),
          }),
        ],
        licenseBytes,
      });
    }),
    listPathHistory: Effect.fn("SkillsLockPlanTest.history.listPathHistory")(() => Effect.succeed(history)),
  });
  return { source, loaded };
});

/** Installs a shadcn tree under `.claude/skills` (with `.agents/skills` linked) beside the fixture v1 lock. */
const installFixtureRepo = Effect.fn("SkillsLockPlanTest.installFixtureRepo")(function* (
  repoRoot: string,
  installed: FakeTree
) {
  const pngBytes = yield* readFixtureBinary("shadcn/upstream/assets/example.png.hex");
  yield* writeFixtureFile(repoRoot, "skills-lock.json", textEncoder.encode(SKILLS_LOCK_V1_FIXTURE));
  yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(installed.skill));
  yield* writeFixtureFile(
    repoRoot,
    ".claude/skills/shadcn/rules/composition.md",
    textEncoder.encode(installed.composition)
  );
  yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/assets/example.png", pngBytes);
  yield* writeFixtureFile(repoRoot, ".claude/skills/adhd/SKILL.md", textEncoder.encode("# adhd\n"));
  yield* writeFixtureFile(repoRoot, ".claude/skills/yeet/SKILL.md", textEncoder.encode("# yeet\n"));
  yield* linkAgentsTarget(repoRoot);
});

const fixtureTexts = Effect.fn("SkillsLockPlanTest.fixtureTexts")(function* () {
  const skill = yield* readFixtureText("shadcn/upstream/SKILL.md");
  return {
    pinned: { skill, composition: yield* readFixtureText("shadcn/upstream/rules/composition.md") },
    localComposition: yield* readFixtureText("shadcn/local/rules/composition.md"),
    skill,
  };
});

const vendoredRowOf = (rows: ReadonlyArray<SkillMigrationRow>, skill: string): O.Option<VendoredMigrationRow> =>
  A.findFirst(rows, (row): row is VendoredMigrationRow => row.skill === skill && row.disposition === "vendored");

layer(TestLayer, { timeout: "60 seconds" })("skills lock migration plan", (it) => {
  it.effect.prop(
    "round-trips schema-generated lock entries, drift rows, pin proposals, and history windows through their codecs",
    [
      Arbitrary.schema(LocalSkillLockEntry),
      Arbitrary.schema(SkillDriftRow),
      Arbitrary.schema(SkillPinProposal),
      Arbitrary.schema(SkillPathHistoryWindow),
    ],
    Effect.fnUntraced(function* ([entry, drift, pin, window]) {
      expect(
        yield* S.decodeEffect(LocalSkillLockEntry)(yield* S.encodeEffect(LocalSkillLockEntry)(entry))
      ).toStrictEqual(entry);
      expect(yield* S.decodeEffect(SkillDriftRow)(yield* S.encodeEffect(SkillDriftRow)(drift))).toStrictEqual(drift);
      expect(yield* S.decodeEffect(SkillPinProposal)(yield* S.encodeEffect(SkillPinProposal)(pin))).toStrictEqual(pin);
      expect(
        yield* S.decodeEffect(SkillPathHistoryWindow)(yield* S.encodeEffect(SkillPathHistoryWindow)(window))
      ).toStrictEqual(window);
    }),
    { arbitrary: { runs: 32 } }
  );

  it.effect("pins at the newest revision whose whole tree equals the installed tree", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-" });
      const texts = yield* fixtureTexts();
      const pulled = { skill: `${texts.skill}\nUpstream revision 2.\n`, composition: texts.localComposition };
      // REVISION_3 already moved SKILL.md on; REVISION_2 and the older REVISION_1 both
      // equal the installed tree, and the newer of the two must win.
      const { source, loaded } = yield* makeHistorySource({
        trees: [
          [PINNED_SHADCN_REVISION, texts.pinned],
          [REVISION_3, { skill: `${texts.skill}\nUpstream revision 3.\n`, composition: texts.localComposition }],
          [REVISION_2, pulled],
          [REVISION_1, pulled],
        ],
        history: [REVISION_3, REVISION_2, REVISION_1],
        truncated: false,
      });
      yield* installFixtureRepo(repoRoot, pulled);

      const plan = yield* planSkillsLockMigration(repoRoot).pipe(
        Effect.provideService(SkillUpstreamContentSource, source)
      );

      expect(plan.schemaVersion).toBe("skills-lock-migration-plan/v3");
      expect(A.map(plan.rows, (row) => [row.skill, row.disposition, row.entry?._tag])).toEqual([
        ["adhd", "unresolved", "local"],
        ["shadcn", "vendored", "vendored"],
        ["yeet", "local", "local"],
      ]);
      const shadcn = vendoredRowOf(plan.rows, "shadcn");
      shadcn.pipe(O.isSome, assertTrue);
      if (O.isSome(shadcn)) {
        expect(shadcn.value.pin).toEqual({ proposal: "pristine-at-revision", revision: REVISION_2 });
        expect(
          A.map(shadcn.value.drift, (row) => [row.path, row.driftClass, "revision" in row ? row.revision : ""])
        ).toEqual([
          ["SKILL.md", "matches-upstream-revision", REVISION_2],
          ["rules/composition.md", "matches-upstream-revision", REVISION_3],
        ]);
        expect(shadcn.value.pathHistory).toEqual({
          trackingRef: "main",
          head: REVISION_3,
          revisionCount: 3,
          truncated: false,
        });
      }
      // The walk stops at the first pristine revision: REVISION_1 is never loaded. The entry
      // is then recomputed at the proposed pin, which loads REVISION_2 once more.
      expect(loaded).toEqual([PINNED_SHADCN_REVISION, REVISION_3, REVISION_2, REVISION_2]);
      if (O.isSome(shadcn)) {
        expect(shadcn.value.entry.upstream.sourceRevision).toBe(REVISION_2);
        expect(shadcn.value.entry.patches.required).toBe(false);
        expect(shadcn.value.entry.effective.treeHash).toBe(shadcn.value.entry.snapshot.treeHash);
      }
      expect(renderSkillsLockMigrationPlanSummary(plan)).toContain("pristine at 2222222222 (proposed pin)");
      expect(yield* fs.readFileString(path.join(repoRoot, "skills-lock.json"))).toBe(SKILLS_LOCK_V1_FIXTURE);
    })
  );

  it.effect("keeps the seed pin, names files that match no revision, and reports a truncated history", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-local-" });
      const texts = yield* fixtureTexts();
      const installed = { skill: `${texts.skill}\nRepo-local note.\n`, composition: texts.localComposition };
      // REVISION_1 is where the skill path did not exist yet: an empty tree, not a failure.
      const { source } = yield* makeHistorySource({
        trees: [
          [PINNED_SHADCN_REVISION, texts.pinned],
          [REVISION_3, { skill: `${texts.skill}\nUpstream revision 3.\n`, composition: texts.localComposition }],
          [REVISION_2, texts.pinned],
        ],
        history: [REVISION_3, REVISION_2, REVISION_1],
        truncated: true,
      });
      yield* installFixtureRepo(repoRoot, installed);

      const plan = yield* planSkillsLockMigration(repoRoot).pipe(
        Effect.provideService(SkillUpstreamContentSource, source)
      );

      const shadcn = vendoredRowOf(plan.rows, "shadcn");
      shadcn.pipe(O.isSome, assertTrue);
      if (O.isSome(shadcn)) {
        expect(shadcn.value.pin).toEqual({ proposal: "keep-seed-pin", revision: PINNED_SHADCN_REVISION });
        expect(A.map(shadcn.value.drift, (row) => [row.path, row.driftClass])).toEqual([
          ["SKILL.md", "matches-no-examined-revision"],
          ["rules/composition.md", "matches-upstream-revision"],
        ]);
        expect(shadcn.value.pathHistory.truncated).toBe(true);
        expect(shadcn.value.entry.patches.required).toBe(true);
      }
      const summary = renderSkillsLockMigrationPlanSummary(plan);
      expect(summary).toContain("no pristine revision; keeps current pin 91f21dfe13");
      expect(summary).toContain(
        "patches: .agents/skill-patches/shadcn/0001-skill-md.patch, .agents/skill-patches/shadcn/0002-rules-composition-md.patch"
      );
      expect(summary).toContain(
        "1 match an upstream revision, 1 match no examined revision (patch candidates: SKILL.md)"
      );
      expect(summary).toContain("truncated (older revisions not examined)");
    })
  );

  it.effect("seals the classified-against path-history head into the plan digest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-digest-" });
      const texts = yield* fixtureTexts();
      const pulled = { skill: `${texts.skill}\nUpstream revision 2.\n`, composition: texts.localComposition };
      yield* installFixtureRepo(repoRoot, pulled);
      const planWith = Effect.fnUntraced(function* (history: ReadonlyArray<string>) {
        const { source } = yield* makeHistorySource({
          trees: [
            [PINNED_SHADCN_REVISION, texts.pinned],
            [REVISION_4, pulled],
            [REVISION_2, pulled],
          ],
          history,
          truncated: false,
        });
        return yield* planSkillsLockMigration(repoRoot).pipe(Effect.provideService(SkillUpstreamContentSource, source));
      });

      const reviewed = yield* planWith([REVISION_2]);
      const replayed = yield* planWith([REVISION_2]);
      // Upstream gained a commit touching the skill path; it carries the same tree.
      const moved = yield* planWith([REVISION_4, REVISION_2]);

      expect(replayed.planDigest).toBe(reviewed.planDigest);
      expect(moved.planDigest).not.toBe(reviewed.planDigest);
      assertSome(
        O.map(vendoredRowOf(moved.rows, "shadcn"), (row) => row.pathHistory.head),
        yield* S.decodeEffect(SkillGitRevision)(REVISION_4)
      );
      expect(renderSkillsLockMigrationPlanSummary(reviewed)).toContain(`plan-digest: ${reviewed.planDigest}`);
    })
  );

  it.effect("reports a per-skill provenance refusal as unresolved and keeps planning the rest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-license-" });
      const texts = yield* fixtureTexts();
      // A license that no longer hashes to the ratified digest makes the resolver refuse.
      const { source } = yield* makeHistorySource({
        trees: [[PINNED_SHADCN_REVISION, texts.pinned]],
        history: [PINNED_SHADCN_REVISION],
        truncated: false,
        licenseText: "Relicensed.\n",
      });
      yield* installFixtureRepo(repoRoot, texts.pinned);

      const plan = yield* planSkillsLockMigration(repoRoot).pipe(
        Effect.provideService(SkillUpstreamContentSource, source)
      );

      expect(A.map(plan.rows, (row) => [row.skill, row.disposition, row.entry?._tag])).toEqual([
        ["adhd", "unresolved", "local"],
        ["shadcn", "unresolved", "local"],
        ["yeet", "local", "local"],
      ]);
      const shadcn = plan.rows[1];
      expect(shadcn?.disposition === "unresolved" ? shadcn.note : "").toContain(
        "provenance-unavailable: Pinned license hash mismatch for shadcn"
      );
    })
  );

  it.effect("reports a partially installed skill as unresolved and keeps planning the rest", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-partial-" });
      yield* writeFixtureFile(
        repoRoot,
        "skills-lock.json",
        textEncoder.encode(
          '{"version": 1, "skills": {"broken": {"source": "x", "sourceType": "local", "computedHash": "0"}, "yeet": {"source": "x", "sourceType": "local", "computedHash": "0"}}}\n'
        )
      );
      yield* writeFixtureFile(repoRoot, ".claude/skills/yeet/SKILL.md", textEncoder.encode("# yeet\n"));
      yield* writeFixtureFile(repoRoot, ".agents/skills/yeet/SKILL.md", textEncoder.encode("# yeet\n"));
      // "broken" exists under .claude/skills only: its .agents target is missing.
      yield* writeFixtureFile(repoRoot, ".claude/skills/broken/SKILL.md", textEncoder.encode("# broken\n"));

      const plan = yield* planSkillsLockMigration(repoRoot).pipe(
        Effect.provideService(
          SkillUpstreamContentSource,
          SkillUpstreamContentSource.of({
            load: Effect.fn("SkillsLockPlanTest.partial.load")(() => Effect.die("unreachable")),
            listPathHistory: Effect.fn("SkillsLockPlanTest.partial.listPathHistory")(() => Effect.die("unreachable")),
          })
        )
      );

      expect(A.map(plan.rows, (row) => [row.skill, row.disposition, row.entry?._tag])).toEqual([
        ["broken", "unresolved", undefined],
        ["yeet", "local", "local"],
      ]);
      const broken = plan.rows[0];
      expect(broken?.disposition === "unresolved" ? broken.note : "").toContain("missing-target");
    })
  );

  it.effect("reports an unreadable upstream as unresolved for that skill only", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-upstream-" });
      yield* writeFixtureFile(
        repoRoot,
        "skills-lock.json",
        textEncoder.encode(
          '{"version": 1, "skills": {"shadcn": {"source": "shadcn-ui/ui", "sourceType": "github", "computedHash": "0"}, "yeet": {"source": "x", "sourceType": "local", "computedHash": "0"}}}\n'
        )
      );
      yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode("# shadcn\n"));
      yield* writeFixtureFile(repoRoot, ".claude/skills/yeet/SKILL.md", textEncoder.encode("# yeet\n"));
      yield* linkAgentsTarget(repoRoot);

      const plan = yield* planSkillsLockMigration(repoRoot).pipe(
        Effect.provideService(
          SkillUpstreamContentSource,
          SkillUpstreamContentSource.of({
            load: Effect.fn("SkillsLockPlanTest.moved.load")((resolution) =>
              Effect.fail(
                SkillUpstreamContentError.make({
                  skill: resolution.name,
                  reason: "path-absent",
                  message: "No files found at the tree path",
                })
              )
            ),
            listPathHistory: Effect.fn("SkillsLockPlanTest.moved.listPathHistory")(() => Effect.die("unreachable")),
          })
        )
      );

      expect(A.map(plan.rows, (row) => [row.skill, row.disposition, row.entry?._tag])).toEqual([
        ["shadcn", "unresolved", "local"],
        ["yeet", "local", "local"],
      ]);
      const shadcn = plan.rows[0];
      expect(shadcn?.disposition === "unresolved" ? shadcn.note : "").toContain("upstream-unavailable");
    })
  );

  it.effect("refuses a lock that is neither skills-lock/v1 nor skills-lock/v2", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-bad-" });
      yield* writeFixtureFile(repoRoot, "skills-lock.json", textEncoder.encode('{"version": 3, "skills": {}}\n'));
      const exit = yield* Effect.exit(
        planSkillsLockMigration(repoRoot).pipe(
          Effect.provideService(
            SkillUpstreamContentSource,
            SkillUpstreamContentSource.of({
              load: Effect.fn("SkillsLockPlanTest.unreachable.load")(() => Effect.die("unreachable")),
              listPathHistory: Effect.fn("SkillsLockPlanTest.unreachable.listPathHistory")(() =>
                Effect.die("unreachable")
              ),
            })
          )
        )
      );
      exit.pipe(Exit.isFailure, assertTrue);
      expect(String(exit)).toContain("is neither a skills-lock/v1 nor a skills-lock/v2 document");
    })
  );
});

const abbreviated = Str.slice(0, 12);

/** A repo whose shadcn install carries one repo-local line on top of the pinned tree. */
const installLocallyEditedRepo = Effect.fn("SkillsLockWriteTest.installLocallyEditedRepo")(function* (
  repoRoot: string
) {
  const texts = yield* fixtureTexts();
  const installed = { skill: `${texts.skill}\nRepo-local note.\n`, composition: texts.pinned.composition };
  yield* installFixtureRepo(repoRoot, installed);
  const { source } = yield* makeHistorySource({
    trees: [[PINNED_SHADCN_REVISION, texts.pinned]],
    history: [PINNED_SHADCN_REVISION],
    truncated: false,
  });
  return { source, texts, installed };
});

const refusalReason = (error: { readonly _tag: string }): string =>
  S.is(SkillsLockWriteRefusal)(error) ? error.reason : error._tag;

layer(TestLayer, { timeout: "60 seconds" })("skills lock write", (it) => {
  it.effect("renders separated unified-diff hunks with Git range syntax and the no-newline marker", () =>
    Effect.sync(() => {
      expect(renderUnifiedHunks("a\nb\nc\nd\ne\nf\ng\nh\ni\nj\n", "a\nB\nc\nd\ne\nf\ng\nh\ni\nJ")).toEqual([
        "@@ -1,5 +1,5 @@",
        " a",
        "-b",
        "+B",
        " c",
        " d",
        " e",
        "@@ -7,4 +7,4 @@",
        " g",
        " h",
        " i",
        "-j",
        "+J",
        "\\ No newline at end of file",
      ]);
      expect(renderUnifiedHunks("", "only\n")).toEqual(["@@ -0,0 +1 @@", "+only"]);
      expect(renderUnifiedHunks("same\n", "same\n")).toEqual([]);
    })
  );

  it.effect("resolves CODEOWNERS owners with last-match semantics", () =>
    Effect.sync(() => {
      const codeowners = A.join(
        [
          "# Single-operator laboratory.",
          "* @kriegcloud",
          "/.claude/skills/ @skills",
          "*.yaml @yaml-owner",
          "docs/** @docs",
          ".claude/skills/oracle/agents/",
          "/.agents/ @agents @kriegcloud # trailing comment",
          "",
        ],
        "\n"
      );
      const owner = (repoPath: string) => O.getOrNull(resolveCodeownersOwner(codeowners, repoPath));
      expect(owner(".claude/skills/oracle/SKILL.md")).toBe("@skills");
      expect(owner(".claude/skills/teach/notes.yaml")).toBe("@yaml-owner");
      // The last matching line names no owner, so the path is deliberately unowned.
      expect(owner(".claude/skills/oracle/agents/openai.yaml")).toBeNull();
      // `docs/**` has an inner slash, so it is anchored to the root.
      expect(owner("packages/docs/guide.md")).toBe("@kriegcloud");
      expect(owner("docs/guides/guide.md")).toBe("@docs");
      expect(owner(".agents/skill-patches/oracle/0001-skill-md.patch")).toBe("@agents @kriegcloud");
      expect(owner("README.md")).toBe("@kriegcloud");
    })
  );

  it.effect("refuses a missing or stale --expect and a conflicted plan, writing nothing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-write-refuse-" });
      const { source } = yield* installLocallyEditedRepo(repoRoot);
      const write = (expect: O.Option<string>) =>
        writeSkillsLockMigration(repoRoot, expect).pipe(
          Effect.provideService(SkillUpstreamContentSource, source),
          Effect.flip
        );

      expect(refusalReason(yield* write(O.none()))).toBe("missing-expect");
      expect(refusalReason(yield* write(O.some("0".repeat(64))))).toBe("digest-mismatch");

      // A license that moved makes the seeded row unresolved, which a write cannot settle.
      const texts = yield* fixtureTexts();
      const relicensed = yield* makeHistorySource({
        trees: [[PINNED_SHADCN_REVISION, texts.pinned]],
        history: [PINNED_SHADCN_REVISION],
        truncated: false,
        licenseText: "Relicensed.\n",
      });
      const conflicted = yield* planSkillsLockMigration(repoRoot).pipe(
        Effect.provideService(SkillUpstreamContentSource, relicensed.source)
      );
      const refusal = yield* writeSkillsLockMigration(repoRoot, O.some(conflicted.planDigest)).pipe(
        Effect.provideService(SkillUpstreamContentSource, relicensed.source),
        Effect.flip
      );
      expect(refusalReason(refusal)).toBe("conflicted-plan");
      expect(refusal.message).toContain("shadcn (provenance-unavailable");

      expect(yield* fs.readFileString(path.join(repoRoot, "skills-lock.json"))).toBe(SKILLS_LOCK_V1_FIXTURE);
      expect(yield* fs.exists(path.join(repoRoot, ".agents/skill-patches"))).toBe(false);
    })
  );

  it.effect("writes the v2 lock and the patch series, then reports a replay as already applied", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-write-" });
      const { source, texts, installed } = yield* installLocallyEditedRepo(repoRoot);
      const provide = Effect.provideService(SkillUpstreamContentSource, source);

      const reviewed = yield* planSkillsLockMigration(repoRoot).pipe(provide);
      const receipt = yield* writeSkillsLockMigration(repoRoot, O.some(reviewed.planDigest)).pipe(provide);

      expect(receipt.outcome).toBe("written");
      expect([receipt.vendored, receipt.local]).toEqual([1, 2]);
      const patchPath = ".agents/skill-patches/shadcn/0001-skill-md.patch";
      expect(A.map(receipt.patches, (patch) => patch.path)).toEqual([patchPath]);

      const lockText = yield* fs.readFileString(path.join(repoRoot, "skills-lock.json"));
      expect(receipt.lock.sha256).toBe(yield* hashBytes(textEncoder.encode(lockText)));
      const lock = yield* decodeSkillsLockDocumentJson(lockText);
      expect(A.map(R.toEntries(lock.skills), ([skill, entry]) => [skill, entry._tag])).toEqual([
        ["adhd", "local"],
        ["shadcn", "vendored"],
        ["yeet", "local"],
      ]);
      const shadcn = lock.skills.shadcn;
      expect(shadcn?._tag === "vendored" ? shadcn.patches.series : []).toEqual([
        {
          path: patchPath,
          sha256: receipt.patches[0]?.sha256,
          label: "temporary-drift",
          owner: "@kriegcloud",
          dropCondition: "Drop when upstream contains an equivalent change.",
        },
      ]);

      // Golden: one hunk with three lines of context, against the pristine snapshot.
      const upstreamSha = yield* hashBytes(textEncoder.encode(texts.skill));
      const installedSha = yield* hashBytes(textEncoder.encode(installed.skill));
      const patchText = yield* fs.readFileString(path.join(repoRoot, patchPath));
      expect(patchText).toBe(
        A.join(
          [
            "diff --git a/SKILL.md b/SKILL.md",
            `index ${abbreviated(upstreamSha)}..${abbreviated(installedSha)} 100644`,
            "--- a/SKILL.md",
            "+++ b/SKILL.md",
            "@@ -6,3 +6,5 @@",
            " # Shadcn fixture",
            " ",
            " Compose primitives before adding abstractions.",
            "+",
            "+Repo-local note.",
            "",
          ],
          "\n"
        )
      );
      expect(receipt.patches[0]?.sha256).toBe(yield* hashBytes(textEncoder.encode(patchText)));
      expect(A.sort(yield* fs.readDirectory(path.join(repoRoot, ".agents")), Str.Order)).toEqual([
        "skill-patches",
        "skills",
      ]);
      expect(A.filter(yield* fs.readDirectory(repoRoot), Str.startsWith("skills-lock.json."))).toEqual([]);

      // The lock moved, so the reviewed digest no longer matches; the replanned digest is a no-op.
      const replanned = yield* planSkillsLockMigration(repoRoot).pipe(provide);
      expect(replanned.planDigest).not.toBe(reviewed.planDigest);
      const stale = yield* writeSkillsLockMigration(repoRoot, O.some(reviewed.planDigest)).pipe(provide, Effect.flip);
      expect(refusalReason(stale)).toBe("digest-mismatch");
      const replay = yield* writeSkillsLockMigration(repoRoot, O.some(replanned.planDigest)).pipe(provide);
      expect(replay.outcome).toBe("already-applied");
      expect(replay.lock).toEqual(receipt.lock);
      expect(replay.patches).toEqual(receipt.patches);
      expect((yield* planSkillsLockMigration(repoRoot).pipe(provide)).planDigest).toBe(replanned.planDigest);
      expect(yield* fs.readFileString(path.join(repoRoot, "skills-lock.json"))).toBe(lockText);
    })
  );

  it.effect("leaves no partial file when the lock rename fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-write-atomic-" });
      const { source } = yield* installLocallyEditedRepo(repoRoot);
      // An earlier patch tree that the write swaps aside must come back on failure.
      yield* writeFixtureFile(repoRoot, ".agents/skill-patches/shadcn/0001-old.patch", textEncoder.encode("old\n"));
      const lockPath = path.join(repoRoot, "skills-lock.json");
      const failingRename: FileSystem.FileSystem = {
        ...fs,
        rename: (from, to) =>
          to === lockPath
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  module: "FileSystem",
                  method: "rename",
                  pathOrDescriptor: to,
                })
              )
            : fs.rename(from, to),
      };
      const provide = Effect.provideService(SkillUpstreamContentSource, source);
      const reviewed = yield* planSkillsLockMigration(repoRoot).pipe(provide);

      const error = yield* writeSkillsLockMigration(repoRoot, O.some(reviewed.planDigest)).pipe(
        provide,
        Effect.provideService(FileSystem.FileSystem, failingRename),
        Effect.flip
      );

      expect(error.message).toContain("Failed to publish skills-lock.json");
      expect(yield* fs.readFileString(lockPath)).toBe(SKILLS_LOCK_V1_FIXTURE);
      expect(yield* fs.readDirectory(path.join(repoRoot, ".agents/skill-patches/shadcn"))).toEqual(["0001-old.patch"]);
      expect(A.sort(yield* fs.readDirectory(path.join(repoRoot, ".agents")), Str.Order)).toEqual([
        "skill-patches",
        "skills",
      ]);
      expect(A.filter(yield* fs.readDirectory(repoRoot), Str.startsWith("skills-lock.json."))).toEqual([]);
    })
  );

  it.effect("removes a first-time patch tree when the lock rename fails", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-write-first-" });
      const { source } = yield* installLocallyEditedRepo(repoRoot);
      // No earlier patch tree: the newly published one must not outlive the failed lock rename.
      const lockPath = path.join(repoRoot, "skills-lock.json");
      const failingRename: FileSystem.FileSystem = {
        ...fs,
        rename: (from, to) =>
          to === lockPath
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "PermissionDenied",
                  module: "FileSystem",
                  method: "rename",
                  pathOrDescriptor: to,
                })
              )
            : fs.rename(from, to),
      };
      const provide = Effect.provideService(SkillUpstreamContentSource, source);
      const reviewed = yield* planSkillsLockMigration(repoRoot).pipe(provide);

      const error = yield* writeSkillsLockMigration(repoRoot, O.some(reviewed.planDigest)).pipe(
        provide,
        Effect.provideService(FileSystem.FileSystem, failingRename),
        Effect.flip
      );

      expect(error.message).toContain("Failed to publish skills-lock.json");
      expect(yield* fs.readFileString(lockPath)).toBe(SKILLS_LOCK_V1_FIXTURE);
      expect(yield* fs.exists(path.join(repoRoot, ".agents/skill-patches"))).toBe(false);
    })
  );

  it.effect("refuses a vendored lock key that is not a single safe path segment, staging nothing", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-write-unsafe-key-" });
      const { source } = yield* installLocallyEditedRepo(repoRoot);
      const provide = Effect.provideService(SkillUpstreamContentSource, source);
      const reviewed = yield* planSkillsLockMigration(repoRoot).pipe(provide);
      yield* writeSkillsLockMigration(repoRoot, O.some(reviewed.planDigest)).pipe(provide);
      // Hand-edit the v2 lock: the drifted vendored shadcn entry now sits under a climbing key,
      // and its install moves to where that key resolves, so planning reaches the patch builder.
      const unsafeKey = "../../outside";
      const lockPath = path.join(repoRoot, "skills-lock.json");
      const lock = yield* decodeSkillsLockDocumentJson(yield* fs.readFileString(lockPath));
      const shadcn = lock.skills.shadcn;
      assertTrue(shadcn !== undefined);
      const edited = SkillsLockDocument.make({
        version: 2,
        skills: R.set(R.remove(lock.skills, "shadcn"), unsafeKey, shadcn),
      });
      yield* fs.writeFileString(lockPath, `${yield* encodeSkillsLockDocumentJson(edited)}\n`);
      const escaped = path.join(repoRoot, ".claude/skills", unsafeKey);
      yield* fs.rename(path.join(repoRoot, ".claude/skills/shadcn"), escaped);
      const lockBefore = yield* fs.readFileString(lockPath);

      const plan = yield* planSkillsLockMigration(repoRoot).pipe(provide);
      const row = O.getOrThrow(A.findFirst(plan.rows, (candidate) => candidate.skill === unsafeKey));
      const refusal = yield* writeSkillsLockMigration(repoRoot, O.some(plan.planDigest)).pipe(provide, Effect.flip);

      expect(row).toMatchObject({
        disposition: "unresolved",
        cause: "provenance-unavailable",
        note: `provenance-unavailable: Skill key "${unsafeKey}" is not a single safe path segment; refusing to place its patches.`,
      });
      expect(refusalReason(refusal)).toBe("conflicted-plan");
      expect(yield* fs.readFileString(lockPath)).toBe(lockBefore);
      expect(yield* fs.readDirectory(path.join(repoRoot, ".agents/skill-patches"))).toEqual(["shadcn"]);
      expect(A.sort(yield* fs.readDirectory(escaped), Str.Order)).toEqual(["SKILL.md", "assets", "rules"]);
    })
  );

  it.effect("refuses to stage a patch path that resolves outside the patch root", () =>
    Effect.gen(function* () {
      const stage = "/repo/.agents/.skill-patches.staging-0123456789abcdef";

      const inside = yield* stagedPatchPath(stage, ".agents/skill-patches/shadcn/0001-skill-md.patch");
      const climbing = yield* stagedPatchPath(stage, ".agents/skill-patches/../../outside/0001.patch").pipe(
        Effect.flip
      );
      const sibling = yield* stagedPatchPath(stage, ".agents/other/0001.patch").pipe(Effect.flip);

      expect(inside).toBe(`${stage}/shadcn/0001-skill-md.patch`);
      expect(climbing.message).toBe(
        "Refusing to stage .agents/skill-patches/../../outside/0001.patch: it resolves outside .agents/skill-patches."
      );
      expect(sibling.message).toContain("it resolves outside .agents/skill-patches");
    })
  );

  it.effect("resolves provenance from a vendored lock entry instead of the seed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-write-provenance-" });
      const texts = yield* fixtureTexts();
      const pulled = { skill: `${texts.skill}\nUpstream revision 2.\n`, composition: texts.localComposition };
      const { source, loaded } = yield* makeHistorySource({
        trees: [
          [PINNED_SHADCN_REVISION, texts.pinned],
          [REVISION_2, pulled],
        ],
        history: [REVISION_2],
        truncated: false,
      });
      yield* installFixtureRepo(repoRoot, pulled);
      const provide = Effect.provideService(SkillUpstreamContentSource, source);
      const reviewed = yield* planSkillsLockMigration(repoRoot).pipe(provide);
      yield* writeSkillsLockMigration(repoRoot, O.some(reviewed.planDigest)).pipe(provide);
      loaded.length = 0;

      const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(provide);

      // The seed still pins PINNED_SHADCN_REVISION; the lock pins REVISION_2, and the lock wins.
      expect(loaded).toEqual([REVISION_2]);
      expect(report.entry.upstream.sourceRevision).toBe(REVISION_2);
      expect(report.driftPaths).toEqual([]);
    })
  );
});

layer(TestLayer, { timeout: "60 seconds" })("skills provenance service", (it) => {
  it.effect("detects text drift while proving the exact pin and unchanged binary asset", () =>
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
      expect(report.entry.patches.series[0]?.path).toBe(".agents/skill-patches/shadcn/0001-rules-composition-md.patch");
      expect(report.entry.patches.series[0]?.owner).toBe("@kriegcloud");
      expect(report.entry.effective.installedTargets).toEqual([".claude/skills/shadcn", ".agents/skills/shadcn"]);
      expect(report.entry.effective.installedTreeHash).toHaveLength(64);
      expect(report.entry.effective.treeHash).not.toBe(report.entry.snapshot.treeHash);
      expect(yield* fs.exists(path.join(repoRoot, "skills-lock.json"))).toBe(false);
      expect(yield* fs.exists(path.join(repoRoot, ".agents/skill-patches"))).toBe(false);
    })
  );

  it.effect("records symlinks as mode 120000 link text instead of following them", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-provenance-symlink-" });
        const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
        const compositionText = yield* readFixtureText("shadcn/upstream/rules/composition.md");
        const source = yield* makeStubSource([
          SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: textEncoder.encode(skillText) }),
          SkillUpstreamContentFile.make({ path: "entry.md", mode: "120000", bytes: textEncoder.encode("SKILL.md") }),
          SkillUpstreamContentFile.make({ path: "mirror", mode: "120000", bytes: textEncoder.encode("rules") }),
          SkillUpstreamContentFile.make({
            path: "rules/composition.md",
            mode: "100644",
            bytes: textEncoder.encode(compositionText),
          }),
        ]);

        yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(skillText));
        yield* writeFixtureFile(
          repoRoot,
          ".claude/skills/shadcn/rules/composition.md",
          textEncoder.encode(compositionText)
        );
        yield* fs.symlink("SKILL.md", path.join(repoRoot, ".claude/skills/shadcn/entry.md"));
        yield* fs.symlink("rules", path.join(repoRoot, ".claude/skills/shadcn/mirror"));
        yield* linkAgentsTarget(repoRoot);

        const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(
          Effect.provideService(SkillUpstreamContentSource, source)
        );

        // Following the file link would hash SKILL.md's bytes under mode 100644, and walking
        // the directory link would add `mirror/composition.md` while losing `mirror` itself;
        // either one shows up here as drift against the pinned tree.
        expect(report.driftPaths).toEqual([]);
        expect(report.entry.provenance.matchedFileCount).toBe(4);
        expect(report.entry.provenance.upstreamFileCount).toBe(4);
        expect(report.entry.effective.treeHash).toBe(report.entry.snapshot.treeHash);
        expect(report.entry.patches.required).toBe(false);
      })
    )
  );

  it.effect("renders header-only patch sections for empty added and deleted files", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-provenance-empty-" });
      const skillText = yield* readFixtureText("shadcn/upstream/SKILL.md");
      const source = yield* makeStubSource([
        SkillUpstreamContentFile.make({ path: "SKILL.md", mode: "100644", bytes: textEncoder.encode(skillText) }),
        SkillUpstreamContentFile.make({ path: "removed-empty.md", mode: "100644", bytes: new Uint8Array() }),
      ]);

      yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/SKILL.md", textEncoder.encode(skillText));
      yield* writeFixtureFile(repoRoot, ".claude/skills/shadcn/added-empty.md", new Uint8Array());
      yield* linkAgentsTarget(repoRoot);

      const report = yield* resolveSkillProvenance("shadcn", repoRoot).pipe(
        Effect.provideService(SkillUpstreamContentSource, source)
      );

      expect(report.driftPaths).toEqual(["added-empty.md", "removed-empty.md"]);
      // What `git diff` emits for a zero-byte add or delete: mode and index headers, no hunk.
      const addedPatch = A.join(
        [
          "diff --git a/added-empty.md b/added-empty.md",
          "new file mode 100644",
          `index 000000000000..${Str.slice(0, 12)(emptyDigest)}`,
          "",
        ],
        "\n"
      );
      const deletedPatch = A.join(
        [
          "diff --git a/removed-empty.md b/removed-empty.md",
          "deleted file mode 100644",
          `index ${Str.slice(0, 12)(emptyDigest)}..000000000000`,
          "",
        ],
        "\n"
      );

      expect(A.map(report.entry.patches.series, (patch) => patch.path)).toEqual([
        ".agents/skill-patches/shadcn/0001-added-empty-md.patch",
        ".agents/skill-patches/shadcn/0002-removed-empty-md.patch",
      ]);
      expect(report.entry.patches.series[0]?.sha256).toBe(yield* hashBytes(textEncoder.encode(addedPatch)));
      expect(report.entry.patches.series[1]?.sha256).toBe(yield* hashBytes(textEncoder.encode(deletedPatch)));
    })
  );

  it.effect("rejects a snapshot whose fileCount disagrees with its manifest length", () =>
    Effect.gen(function* () {
      const manifest = [{ path: "SKILL.md", mode: "100644", sha256: emptyDigest }];
      const snapshot = (fileCount: number) => ({
        algorithm: "sha256",
        treeHash: emptyDigest,
        fileCount,
        manifestHash: emptyDigest,
        manifest,
      });

      expect((yield* decodeSkillSnapshot(snapshot(1))).fileCount).toBe(1);
      (yield* Effect.exit(decodeSkillSnapshot(snapshot(0)))).pipe(Exit.isFailure, assertTrue);
      (yield* Effect.exit(decodeSkillSnapshot(snapshot(2)))).pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("keeps browser-triggered skill workflows behind host trust boundaries", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = yield* findRepoRoot();
      const impeccableRoute = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live/manual-edit-routes.mjs")
      );
      const githubRoute = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live/manual-edit-routes.mjs")
      );
      const copyAgent = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-copy-edit-agent.mjs")
      );
      const githubCopyAgent = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-copy-edit-agent.mjs")
      );
      const commitAgent = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-commit-manual-edits.mjs")
      );
      const githubCommitAgent = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-commit-manual-edits.mjs")
      );
      const liveInstructions = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live/instructions.mjs")
      );
      const githubLiveInstructions = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live/instructions.mjs")
      );
      const liveServer = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-server.mjs")
      );
      const githubLiveServer = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-server.mjs")
      );
      const trustedApplyClient = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-apply-manual-edits.mjs")
      );
      const githubTrustedApplyClient = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-apply-manual-edits.mjs")
      );
      const browserClient = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/impeccable/scripts/live-browser.js")
      );
      const githubBrowserClient = yield* fs.readFileString(
        path.join(repoRoot, ".github/skills/impeccable/scripts/live-browser.js")
      );
      const adapterRunner = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh")
      );
      const ontologySkill = yield* fs.readFileString(
        path.join(repoRoot, ".claude/skills/ontology-foundational-auditor/SKILL.md")
      );

      expect(impeccableRoute).toBe(githubRoute);
      expect(impeccableRoute).toContain("IMPECCABLE_LIVE_COMMIT_CAPABILITY");
      expect(impeccableRoute).toContain("x-impeccable-commit-capability");
      expect(impeccableRoute).toContain("delete copyAgentEnvironment.IMPECCABLE_LIVE_COMMIT_CAPABILITY");
      expect(trustedApplyClient).toBe(githubTrustedApplyClient);
      expect(trustedApplyClient).toContain('"x-impeccable-commit-capability": capability');
      expect(trustedApplyClient).toContain('args.includes("--rollback")');
      expect(trustedApplyClient).toContain('args.includes("--discard")');
      expect(trustedApplyClient).not.toContain("console.log(capability)");
      expect(browserClient).toBe(githubBrowserClient);
      expect(browserClient).not.toContain('"/manual-edit-commit?token="');
      expect(browserClient).not.toContain('"/manual-edit-repair-decision?token="');
      expect(browserClient).not.toContain('"/manual-edit-discard?token="');
      expect(browserClient).not.toContain("live-apply-manual-edits.mjs");
      expect(browserClient).not.toContain("trustedManualApplyCommand");
      expect(browserClient).not.toContain("Show the trusted operator repair command");
      expect(browserClient).toContain("Return to the trusted terminal to authorize repair");
      expect(copyAgent).toBe(githubCopyAgent);
      expect(commitAgent).toBe(githubCommitAgent);
      expect(liveInstructions).toBe(githubLiveInstructions);
      expect(liveServer).toBe(githubLiveServer);
      expect(copyAgent).not.toContain("impeccable:manual-edit-validate");
      expect(copyAgent).not.toContain("spawnSync(script");
      expect(adapterRunner).toContain("--unshare-all");
      expect(adapterRunner).toContain('--ro-bind "${repo}" /repo');
      expect(adapterRunner).toContain("--clearenv");
      expect(adapterRunner).toContain("adapter must live outside the audited repository");
      expect(adapterRunner).toContain("adapter file is writable by another user");
      expect(adapterRunner).toContain('realpath -ms -- "${target_input}"');
      expect(ontologySkill).toContain('TRUSTED_ADAPTER_SHA256=$(sha256sum "$TRUSTED_ADAPTER"');
      expect(ontologySkill).not.toContain("find $ONT/adapters -type f");
    })
  );

  it.effect("executes the adapter sandbox trust and output containment checks", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const fixtureRoot = yield* fs.makeTempDirectoryScoped({ prefix: "adapter-sandbox-" });
        const auditedRepo = path.join(fixtureRoot, "repo");
        const trustedDirectory = path.join(fixtureRoot, "trusted");
        const adapter = path.join(trustedDirectory, "adapter.py");
        const binDirectory = path.join(fixtureRoot, "bin");
        const capturePath = path.join(fixtureRoot, "bwrap.argv");
        const outsideDirectory = path.join(fixtureRoot, "outside");
        yield* Effect.forEach(
          [auditedRepo, trustedDirectory, binDirectory, outsideDirectory],
          (directory) => fs.makeDirectory(directory, { recursive: true, mode: 0o700 }),
          { discard: true }
        );
        yield* fs.writeFileString(adapter, "#!/usr/bin/env python3\n");
        yield* fs.chmod(adapter, 0o644);
        const writeExecutable = Effect.fnUntraced(function* (filePath: string, source: string) {
          yield* fs.writeFileString(filePath, source);
          yield* fs.chmod(filePath, 0o755);
        });
        yield* writeExecutable(
          path.join(binDirectory, "prlimit"),
          '#!/bin/sh\nwhile [ "$#" -gt 0 ] && [ "$1" != "--" ]; do shift; done\n[ "$#" -gt 0 ] || exit 64\nshift\nexec "$@"\n'
        );
        yield* writeExecutable(path.join(binDirectory, "bwrap"), '#!/bin/sh\nprintf "%s\\n" "$@" > "$BWRAP_CAPTURE"\n');
        const runner = path.join(
          repoRoot,
          ".claude/skills/ontology-foundational-auditor/scripts/run_adapter_sandbox.sh"
        );
        const run = (target: string) =>
          Bun.spawnSync([runner, adapter, auditedRepo, "observe", target], {
            cwd: auditedRepo,
            env: {
              ...Bun.env,
              BWRAP_CAPTURE: capturePath,
              PATH: `${binDirectory}:${Bun.env.PATH ?? ""}`,
            },
            stderr: "pipe",
            stdout: "pipe",
          });

        yield* fs.chmod(adapter, 0o666);
        expect(run(path.join(auditedRepo, "writable-adapter-output")).exitCode).toBe(65);
        yield* fs.chmod(adapter, 0o644);

        const outsideOutput = path.join(outsideDirectory, "must-not-be-created");
        expect(run(outsideOutput).exitCode).toBe(65);
        expect(yield* fs.exists(outsideOutput)).toBe(false);

        const linkedOutput = path.join(auditedRepo, "linked-output");
        yield* fs.symlink(outsideDirectory, linkedOutput);
        expect(run(linkedOutput).exitCode).toBe(65);

        const validOutput = path.join(auditedRepo, "observations");
        expect(run(validOutput).exitCode).toBe(0);
        expect(yield* fs.exists(validOutput)).toBe(true);
        const bwrapArguments = yield* fs.readFileString(capturePath);
        expect(bwrapArguments).toContain(`${validOutput}\n/out\n`);
        expect(bwrapArguments).toContain(`${auditedRepo}\n/repo\n`);
      })
    )
  );

  it.effect("enforces the manual-edit operator capability across host mutation routes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const repoRoot = yield* findRepoRoot();
        const probeRoot = yield* fs.makeTempDirectoryScoped({ prefix: "impeccable-provider-probe-" });
        const probeBin = path.join(probeRoot, "bin");
        const probeCapture = path.join(probeRoot, "probe.env");
        yield* fs.makeDirectory(probeBin, { recursive: true });
        const fakeCodex = path.join(probeBin, "codex");
        yield* fs.writeFileString(
          fakeCodex,
          '#!/bin/sh\nif [ -n "${IMPECCABLE_LIVE_COMMIT_CAPABILITY:-}" ]; then printf "leaked\\n" >> "$PROBE_CAPTURE"; exit 1; fi\nprintf "clean\\n" >> "$PROBE_CAPTURE"\nexit 0\n'
        );
        yield* fs.chmod(fakeCodex, 0o755);
        const routeModule = yield* Effect.promise(
          () =>
            import(
              pathToFileURL(path.join(repoRoot, ".claude/skills/impeccable/scripts/live/manual-edit-routes.mjs")).href
            )
        );
        const copyAgentModule = yield* Effect.promise(
          () =>
            import(
              pathToFileURL(path.join(repoRoot, ".claude/skills/impeccable/scripts/live-copy-edit-agent.mjs")).href
            )
        );
        const activities: Array<{ readonly payload: Record<string, unknown>; readonly type: string }> = [];
        let commitCalls = 0;
        let childEnvironment: Record<string, string | undefined> | undefined;
        const transactionCalls = { cancel: 0, clear: 0, count: 0, read: 0, rollback: 0, write: 0 };
        const manualApply = {
          cancelPendingEvents: () => {
            transactionCalls.cancel += 1;
            return [];
          },
          clearTransaction: () => {
            transactionCalls.clear += 1;
          },
          countOps: () => {
            transactionCalls.count += 1;
            return 0;
          },
          readTransaction: () => {
            transactionCalls.read += 1;
            return null;
          },
          rollbackTransaction: () => {
            transactionCalls.rollback += 1;
            return null;
          },
          writeTransaction: () => {
            transactionCalls.write += 1;
            return null;
          },
        };
        const invoke = Effect.fn("SkillsProvenanceTest.invokeManualEditRoute")(function* ({
          body,
          expectedCapability,
          providedCapability,
          route = "/manual-edit-commit?token=page-token",
        }: {
          readonly body?: string;
          readonly expectedCapability: string;
          readonly providedCapability?: string;
          readonly route?: string;
        }) {
          return yield* Effect.callback<{ readonly status: number }>((resume) => {
            let status = 0;
            const response = {
              end: () => {
                resume(Effect.succeed({ status }));
              },
              writeHead: (statusCode: number) => {
                status = statusCode;
              },
            };
            const request = {
              headers: providedCapability === undefined ? {} : { "x-impeccable-commit-capability": providedCapability },
              method: "POST",
              on: (event: string, listener: (chunk?: string) => void) => {
                if (event === "data" && body !== undefined) listener(body);
                if (event === "end") queueMicrotask(listener);
                return request;
              },
            };
            const handle = routeModule.createManualEditRoutes({
              chatAgentLikelyActive: () => false,
              commitManualEdits: ({ env }: { readonly env: Record<string, string | undefined> }) => {
                commitCalls += 1;
                childEnvironment = env;
                const firstSelection = copyAgentModule.chooseCopyEditAgent({ env: { ...env } });
                const cachedSelection = copyAgentModule.chooseCopyEditAgent({ env: { ...env } });
                expect(firstSelection).toBe("codex");
                expect(cachedSelection).toBe("codex");
                return Promise.resolve({
                  applied: [],
                  cleared: 0,
                  failed: [],
                  files: [],
                  reason: "no_pending_edits",
                  warnings: [],
                });
              },
              cwd: probeRoot,
              env: () => ({
                IMPECCABLE_LIVE_COMMIT_CAPABILITY: expectedCapability,
                IMPECCABLE_LIVE_COPY_AGENT: "auto",
                PATH: `${probeBin}:${Bun.env.PATH ?? ""}`,
                PROBE_CAPTURE: probeCapture,
                VISIBLE_VALUE: "kept",
              }),
              getManualEditStatus: () => ({ perPage: {}, totalCount: 0 }),
              getToken: () => "page-token",
              manualApply,
              recordManualEditActivity: (type: string, payload: Record<string, unknown>) => {
                activities.push({ payload, type });
              },
            });
            expect(handle(request, response, new URL(`http://127.0.0.1${route}`))).toBe(true);
          });
        });

        const rollbackBody = yield* encodeUnknownJson({ action: "rollback", token: "page-token" });

        expect((yield* invoke({ expectedCapability: "" })).status).toBe(403);
        expect((yield* invoke({ expectedCapability: "expected" })).status).toBe(403);
        expect((yield* invoke({ expectedCapability: "expected", providedCapability: "wrong" })).status).toBe(403);
        expect(
          (yield* invoke({
            body: rollbackBody,
            expectedCapability: "expected",
            route: "/manual-edit-repair-decision?token=page-token",
          })).status
        ).toBe(403);
        expect(
          (yield* invoke({ expectedCapability: "expected", route: "/manual-edit-discard?token=page-token" })).status
        ).toBe(403);
        expect(transactionCalls).toEqual({ cancel: 0, clear: 0, count: 0, read: 0, rollback: 0, write: 0 });
        const accepted = yield* invoke({ expectedCapability: "expected", providedCapability: "expected" });

        expect(accepted.status).toBe(200);
        expect(commitCalls).toBe(1);
        expect(childEnvironment?.IMPECCABLE_LIVE_COMMIT_CAPABILITY).toBeUndefined();
        expect(childEnvironment?.VISIBLE_VALUE).toBe("kept");
        expect(yield* fs.readFileString(probeCapture)).toBe("clean\n");
        const postCheckTarget = path.join(probeRoot, "post-check.js");
        yield* fs.writeFileString(postCheckTarget, "export {};\n");
        let postCheckEnvironment: Record<string, string | undefined> | undefined;
        const postChecks = copyAgentModule.runCopyEditPostApplyChecks({
          cwd: probeRoot,
          env: childEnvironment,
          files: ["post-check.js"],
          spawnSyncCommand: (
            _command: string,
            _args: ReadonlyArray<string>,
            options: { readonly env: Record<string, string | undefined> }
          ) => {
            postCheckEnvironment = options.env;
            return { status: 0 };
          },
        });
        expect(postChecks.ok).toBe(true);
        expect(postCheckEnvironment).toBe(childEnvironment);
        expect(postCheckEnvironment?.IMPECCABLE_LIVE_COMMIT_CAPABILITY).toBeUndefined();
        const rollbackCallsBeforeTrustedActions = transactionCalls.rollback;
        expect(
          (yield* invoke({
            body: rollbackBody,
            expectedCapability: "expected",
            providedCapability: "expected",
            route: "/manual-edit-repair-decision?token=page-token",
          })).status
        ).toBe(200);
        expect(transactionCalls.rollback).toBe(rollbackCallsBeforeTrustedActions + 1);
        expect(
          (yield* invoke({
            expectedCapability: "expected",
            providedCapability: "expected",
            route: "/manual-edit-discard?token=page-token",
          })).status
        ).toBe(200);
        expect(transactionCalls.rollback).toBe(rollbackCallsBeforeTrustedActions + 2);
        expect(transactionCalls.cancel).toBe(1);
        const denials = A.filter(activities, (activity) => activity.type === "manual_edit_commit_denied");
        expect(denials).toEqual([
          { payload: { reason: "operator_capability_unconfigured" }, type: "manual_edit_commit_denied" },
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_commit_denied" },
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_commit_denied" },
        ]);
        expect(A.filter(activities, (activity) => activity.type === "manual_edit_repair_rollback_denied")).toEqual([
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_repair_rollback_denied" },
        ]);
        expect(A.filter(activities, (activity) => activity.type === "manual_edit_discard_denied")).toEqual([
          { payload: { reason: "operator_capability_mismatch" }, type: "manual_edit_discard_denied" },
        ]);
        expect(yield* encodeUnknownJson(activities)).not.toContain("expected");
      })
    )
  );
});

describe("live pinned skill transport", () => {
  let historyText = `[{"sha":"${PINNED_SHADCN_REVISION}"}]`;
  let treeText =
    '{"tree":[{"path":"skills/shadcn/SKILL.md","mode":"100644","type":"blob","sha":"same-blob"},{"path":"skills/shadcn/rules/shared.md","mode":"100644","type":"blob","sha":"same-blob"},{"path":"LICENSE.md","mode":"100644","type":"blob","sha":"license-blob"}],"truncated":false}';
  const rawRequests = A.empty<string>();
  const client = HttpClient.make((request, url) =>
    Effect.sync(() => {
      const expectedAuthorization = url.hostname === "api.github.com" ? "Bearer synthetic-test-token" : undefined;
      expect(request.headers.authorization === expectedAuthorization).toBe(true);
      if (Str.endsWith("/commits")(url.pathname)) {
        expect(url.searchParams.get("path")).toBe("skills/shadcn");
        expect(url.searchParams.get("per_page")).toBe("100");
        return HttpClientResponse.fromWeb(
          request,
          new Response(historyText, { headers: { link: '<https://api.github.com/next>; rel="next"' } })
        );
      }
      if (Str.includes("/git/trees/")(url.pathname)) {
        expect(url.pathname).toContain(PINNED_SHADCN_REVISION);
        return HttpClientResponse.fromWeb(request, new Response(treeText));
      }
      rawRequests.push(url.pathname);
      expect(url.pathname).toContain(PINNED_SHADCN_REVISION);
      return HttpClientResponse.fromWeb(request, new Response("fixture bytes"));
    })
  );
  const TransportLayer = SkillUpstreamContentSourceLive.pipe(
    Layer.provide(Layer.succeed(HttpClient.HttpClient, client)),
    Layer.provide(
      Layer.succeed(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ GITHUB_TOKEN: "synthetic-test-token" }))
    ),
    Layer.provideMerge(TestLayer)
  );
  layer(TransportLayer)((it) => {
    it.effect("bounds path history, distinguishes absence from unavailability, and caches pinned blobs", () =>
      Effect.gen(function* () {
        const upstream = yield* SkillUpstreamContentSource;
        const resolution = (yield* findSkillResolutionSeed("shadcn")).pipe(O.getOrThrow);
        const history = yield* upstream.listPathHistory(resolution);
        expect(history.revisions).toEqual([PINNED_SHADCN_REVISION]);
        expect(history.truncated).toBe(true);
        const content = yield* upstream.load(resolution);
        expect(A.map(content.files, (file) => file.path)).toEqual(["SKILL.md", "rules/shared.md"]);
        const firstFetches = A.length(rawRequests);
        expect(firstFetches).toBeGreaterThan(0);
        yield* upstream.load(resolution);
        expect(A.length(rawRequests)).toBe(firstFetches);
        historyText = "[]";
        expect((yield* Effect.flip(upstream.listPathHistory(resolution))).reason).toBe("path-absent");
        historyText = "invalid-json";
        expect((yield* Effect.flip(upstream.listPathHistory(resolution))).reason).toBe("unavailable");
        treeText = '{"tree":[],"truncated":true}';
        expect((yield* Effect.flip(upstream.load(resolution))).reason).toBe("unavailable");
        treeText = '{"tree":[],"truncated":false}';
        expect((yield* Effect.flip(upstream.load(resolution))).reason).toBe("path-absent");
      })
    );
  });
});
