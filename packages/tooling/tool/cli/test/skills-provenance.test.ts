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
  resolveSkillProvenance,
  SkillDriftRow,
  SkillGitRevision,
  SkillPathHistory,
  SkillPathHistoryWindow,
  SkillPinProposal,
  SkillUpstreamContent,
  SkillUpstreamContentError,
  SkillUpstreamContentFile,
  SkillUpstreamContentSource,
  skillResolutionSeeds,
  VendoredSkillLockEntry,
} from "@beep/repo-cli/commands/Skills";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { Sha256HexFromBytes } from "@beep/schema";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SkillMigrationRow, VendoredMigrationRow } from "@beep/repo-cli/commands/Skills";

const PINNED_SHADCN_REVISION = "91f21dfe1328585670275781b4525fff2507f917";

const fixtureRoot = new URL("./fixtures/skills-provenance", import.meta.url).pathname;
const textEncoder = new TextEncoder();
const emptyDigest = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const hashBytes = S.decodeUnknownEffect(Sha256HexFromBytes);
const encodeUnknownJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const TestLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

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

      expect(plan.schemaVersion).toBe("skills-lock-migration-plan/v2");
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
      // The walk stops at the first pristine revision: REVISION_1 is never loaded.
      expect(loaded).toEqual([PINNED_SHADCN_REVISION, REVISION_3, REVISION_2]);
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
      expect(summary).toContain("no pristine revision; keeps seed pin 91f21dfe13");
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

  it.effect("refuses a lock that is not skills-lock/v1", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: "skills-lock-plan-bad-" });
      yield* writeFixtureFile(repoRoot, "skills-lock.json", textEncoder.encode('{"version": 2, "skills": {}}\n'));
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
      expect(String(exit)).toContain("is not a skills-lock/v1 document");
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
    Effect.scoped(
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
        const expectedPatch = A.join(
          [
            "diff --git a/added-empty.md b/added-empty.md",
            "new file mode 100644",
            `index 000000000000..${Str.slice(0, 12)(emptyDigest)}`,
            "diff --git a/removed-empty.md b/removed-empty.md",
            "deleted file mode 100644",
            `index ${Str.slice(0, 12)(emptyDigest)}..000000000000`,
            "",
          ],
          "\n"
        );

        expect(report.entry.patches.series[0]?.sha256).toBe(yield* hashBytes(textEncoder.encode(expectedPatch)));
      })
    )
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
