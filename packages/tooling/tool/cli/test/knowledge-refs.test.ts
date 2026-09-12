import {
  applyKnowledgeRefsCheck,
  classifyKnowledgeRef,
  encodeKnowledgeRefsReportJson,
  extractKnowledgeHostAnchors,
  isKnowledgeScopedPath,
  KnowledgeOperationalError,
  KnowledgeRefSurface,
  KnowledgeTrackedEntry,
  knowledgeRefsCheckFailure,
  knowledgeRefsLiveDebt,
  makeKnowledgeTreeOracle,
  scanKnowledgeRefsTree,
} from "@beep/repo-cli/commands/Knowledge";
import {
  EffectVitestFinding,
  EffectVitestInventoryDocument,
  EffectVitestReplacement,
  encodeEffectVitestFindingJson,
  encodeEffectVitestInventoryDocument,
} from "@beep/repo-cli/commands/Lint";
import { formatJsonc } from "@beep/repo-cli/test/Artifacts";
import { renderKnowledgeRefsCheckSection } from "@beep/repo-cli/test/Knowledge";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, Encoding, Exit, HashSet, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";
import type {
  KnowledgeRefClassificationInput,
  KnowledgeRefObservation,
  KnowledgeRefsReport,
  KnowledgeTreeOracle,
} from "@beep/repo-cli/commands/Knowledge";

const textEncoder = new TextEncoder();
const FIXTURE_COMMIT = "0123456789abcdef0123456789abcdef01234567";

/** The snapshot the clone-agnosticism inventory was published from. */
const BASELINE_COMMIT = "58318884957ae02237099cc40666d30e3c2d943d";
const BASELINE_TIMEOUT_MS = 600_000;

type FixtureOptions = {
  readonly modes?: Readonly<Record<string, string>>;
  readonly objectIds?: Readonly<Record<string, string>>;
  readonly bytes?: Readonly<Record<string, Uint8Array>>;
  readonly unreadable?: ReadonlyArray<string>;
  readonly order?: (paths: ReadonlyArray<string>) => ReadonlyArray<string>;
};

/**
 * A tree oracle built from plain fixture text.
 *
 * `unreadable` is how a fixture proves a blob was never opened: a path listed there fails on read,
 * so a run that still succeeds could not have touched it.
 */
const makeFixtureOracle = (
  files: Readonly<Record<string, string>>,
  options: FixtureOptions = {}
): KnowledgeTreeOracle => {
  const byteFiles = options.bytes ?? {};
  const unreadable = HashSet.fromIterable(options.unreadable ?? A.empty<string>());
  const paths = A.appendAll(R.keys(files), R.keys(byteFiles));
  const ordered = O.match(O.fromNullishOr(options.order), {
    onNone: () => paths,
    onSome: (reorder) => reorder(paths),
  });
  const entries = A.map(ordered, (path) =>
    KnowledgeTrackedEntry.make({
      path,
      mode: O.getOrElse(R.get(options.modes ?? {}, path), () => "100644"),
      objectId: O.getOrElse(R.get(options.objectIds ?? {}, path), () => `oid:${path}`),
    })
  );

  return {
    treeish: "fixture",
    commit: FIXTURE_COMMIT,
    trackedEntries: entries,
    readBytes: (repoPath) => {
      if (HashSet.has(unreadable, repoPath)) {
        return Effect.fail(
          KnowledgeOperationalError.make({ message: `Fixture blob "${repoPath}" must never be read.` })
        );
      }
      return O.match(R.get(byteFiles, repoPath), {
        onNone: () =>
          O.match(R.get(files, repoPath), {
            onNone: () =>
              Effect.fail(
                KnowledgeOperationalError.make({ message: `Fixture is missing tracked bytes for ${repoPath}.` })
              ),
            onSome: (text) => Effect.succeed(textEncoder.encode(text)),
          }),
        onSome: Effect.succeed,
      });
    },
  };
};

const census = (oracle: KnowledgeTreeOracle): Effect.Effect<KnowledgeRefsReport, KnowledgeOperationalError> =>
  scanKnowledgeRefsTree(oracle).pipe(provideScopedLayer(NodeCrypto.layer));

const scanFixture = (
  files: Readonly<Record<string, string>>,
  options: FixtureOptions = {}
): Effect.Effect<KnowledgeRefsReport, KnowledgeOperationalError> => census(makeFixtureOracle(files, options));

const inDocument = (report: KnowledgeRefsReport, path: string): ReadonlyArray<KnowledgeRefObservation> =>
  A.filter(report.observations, (observation) => observation.location.path === path);

/** The design doc's expected value for one fixture row: a classification and a resolution status. */
const verdicts = (observations: ReadonlyArray<KnowledgeRefObservation>): ReadonlyArray<string> =>
  A.map(observations, (observation) => `${observation.classification}/${observation.resolution.status}`);

const anchorsOf = (observations: ReadonlyArray<KnowledgeRefObservation>): ReadonlyArray<string> =>
  A.getSomes(
    A.map(observations, (observation) => {
      const ref = observation.ref;
      return ref.kind === "host-path" ? O.some(ref.anchor) : O.none<string>();
    })
  );

const displayPathOf = (observation: KnowledgeRefObservation): O.Option<string> => {
  const ref = observation.ref;
  return ref.kind === "goal-uri" ? O.fromNullishOr(ref.displayPath) : O.none<string>();
};

const goalManifestText = (id: string): string =>
  `{"initiative":{"id":"${id}","status":"active"},"completionGate":{"operator":"yeet","requiresPullRequest":true,"requiresMergeable":true,"statement":"Ship via yeet.","grandfathered":false}}`;

const independentDigestEffect = Effect.fn("KnowledgeRefsTest.independentDigest")(function* (text: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", textEncoder.encode(text));
  return Encoding.encodeHex(digest);
});

const independentDigest = (text: string): Effect.Effect<string> =>
  independentDigestEffect(text).pipe(provideScopedLayer(NodeCrypto.layer), Effect.orDie);

const lp = (value: string): string => {
  const normalized = Str.normalize("NFC")(value);
  return `${textEncoder.encode(normalized).byteLength}:${normalized}`;
};

const expectedRefId = Effect.fn("KnowledgeRefsTest.expectedRefId")(function* (
  kind: string,
  documentId: string,
  subject: string,
  occurrence = 0
) {
  const preimage = A.join(
    A.map(["knowledge-ref-normalization/v1", kind, documentId, subject, `${occurrence}`], lp),
    ""
  );
  return `knowledge-ref/v1:${yield* independentDigest(preimage)}`;
});

describe("knowledge reference scope", () => {
  it("excludes vendored Impeccable mirrors", () => {
    expect(isKnowledgeScopedPath(".claude/skills/impeccable/reference/hooks.md")).toBe(false);
    expect(isKnowledgeScopedPath(".github/skills/impeccable/reference/critique.md")).toBe(false);
    expect(isKnowledgeScopedPath(".claude/skills/effect-first-development/SKILL.md")).toBe(true);
  });
});

describe("knowledge refs golden fixture matrix", () => {
  it.effect("verified inline span", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "docs/guide.md": "See `docs/README.md` for the layout.\n",
        "docs/README.md": "ok\n",
      });
      expect(verdicts(inDocument(report, "docs/guide.md"))).toEqual(["verified/resolved"]);
    })
  );

  it.effect("missing target", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({ "docs/guide.md": "See `packages/missing/src/index.ts`.\n" });
      expect(verdicts(report.observations)).toEqual(["broken-target/missing"]);
    })
  );

  it.effect("document-relative inline span resolves from the containing directory", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example/README.md": "See `./PLAN.md` next.\n",
        "goals/example/PLAN.md": "ok\n",
      });
      const observations = inDocument(report, "goals/example/README.md");
      expect(verdicts(observations)).toEqual(["verified/resolved"]);
      expect(A.map(observations, (observation) => observation.resolution.status)).toEqual(["resolved"]);
    })
  );

  it.effect("root escape is ungoverned syntax", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({ "docs/guide.md": "Never cite `../../etc/passwd` here.\n" });
      expect(verdicts(report.observations)).toEqual(["ungoverned-syntax/not-applicable"]);
    })
  );

  it.effect("link destination resolves", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example/README.md": "[PLAN](./PLAN.md)\n",
        "goals/example/PLAN.md": "ok\n",
      });
      expect(verdicts(inDocument(report, "goals/example/README.md"))).toEqual(["verified/resolved"]);
    })
  );

  it.effect("producer target reports the regeneration command", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({ "docs/guide.md": "See `goals/INDEX.md`.\n" });
      expect(verdicts(report.observations)).toEqual(["producer-owned-target/producer-owned"]);
      expect(A.map(report.observations, (observation) => observation.remediation)).toEqual([
        "Run `bun run beep goals index --write` and commit the regenerated output.",
      ]);
    })
  );

  it.effect("live host path inside a beep checkout is actionable", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Run it from /home/example/checkouts/beep-effect now.\n",
      });
      expect(verdicts(report.observations)).toEqual(["actionable-host-path/not-applicable"]);
    })
  );

  it.effect("portable home convention is not a defect", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Memory lives under ~/.claude/memory today.\n",
      });
      expect(verdicts(report.observations)).toEqual(["portable-home-convention/not-applicable"]);
    })
  );

  it.effect("openclaw config dir is a portable home convention", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "The gateway reads ~/.openclaw/openclaw.json on boot.\n",
      });
      expect(verdicts(report.observations)).toEqual(["portable-home-convention/not-applicable"]);
    })
  );

  it.effect("the rewrite-pass convention batch classifies as portable", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md":
          "State sits in ~/.local/state/beep/ai-metrics and caches in ~/.cache/beep-p0-stage today.\n" +
          "Exports land under ~/Downloads and the CLI reads ~/.oracle/config.json plus ~/.portless-lan for LAN mode.\n",
      });
      expect(verdicts(report.observations)).toEqual([
        "portable-home-convention/not-applicable",
        "portable-home-convention/not-applicable",
        "portable-home-convention/not-applicable",
        "portable-home-convention/not-applicable",
        "portable-home-convention/not-applicable",
      ]);
    })
  );

  it.effect("a convention prefix is segment-aware, not a string prefix", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Never write to ~/.cachefoo/anything from guidance.\n",
      });
      expect(verdicts(report.observations)).toEqual(["external-mirror-reference/not-applicable"]);
    })
  );

  it.effect("a Downloads descendant is machine residue, only the exact mention is portable", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Exports land under ~/Downloads but never cite ~/Downloads/report.csv here.\n",
      });
      expect(verdicts(report.observations)).toEqual([
        "portable-home-convention/not-applicable",
        "external-mirror-reference/not-applicable",
      ]);
    })
  );

  it.effect("a trailing slash on the Downloads directory is still the exact mention", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Exports land under ~/Downloads/ but never cite ~/Downloads/report.csv here.\n",
      });
      expect(verdicts(report.observations)).toEqual([
        "portable-home-convention/not-applicable",
        "external-mirror-reference/not-applicable",
      ]);
    })
  );

  it.effect("a packet-owned data root is archival", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example/data/extract.jsonl": '{"blockText":"see /home/user/knowledge for the vault"}\n',
      });
      expect(verdicts(report.observations)).toEqual(["archival-provenance/not-applicable"]);
    })
  );

  it.effect("nested data directories under every live knowledge root remain gated", () =>
    Effect.gen(function* () {
      const liveDataPaths: ReadonlyArray<string> = [
        "goals/example/guidance/data/README.md",
        "explorations/example/data/NOTES.md",
        "docs/data/GUIDE.md",
        ".claude/skills/data/SKILL.md",
        ".agents/skills/data/SKILL.md",
        ".codex/rules/data/README.md",
        "standards/data/RULE.md",
        ".github/guidance/data/README.md",
      ];
      const report = yield* scanFixture({
        "goals/example/guidance/data/README.md": "Run it from /home/example/checkouts/beep-effect.\n",
        "explorations/example/data/NOTES.md": "Run it from /home/example/checkouts/beep-effect.\n",
        "docs/data/GUIDE.md": "Run it from /home/example/checkouts/beep-effect.\n",
        ".claude/skills/data/SKILL.md": "Run it from /home/example/checkouts/beep-effect.\n",
        ".agents/skills/data/SKILL.md": "Run it from /home/example/checkouts/beep-effect.\n",
        ".codex/rules/data/README.md": "Run it from /home/example/checkouts/beep-effect.\n",
        "standards/data/RULE.md": "Run it from /home/example/checkouts/beep-effect.\n",
        ".github/guidance/data/README.md": "Run it from /home/example/checkouts/beep-effect.\n",
      });

      for (const path of liveDataPaths) {
        expect(verdicts(inDocument(report, path))).toEqual(["actionable-host-path/not-applicable"]);
      }
      expect(A.length(knowledgeRefsLiveDebt(report))).toBe(A.length(liveDataPaths));
    })
  );

  it.effect("documented temp convention is not a defect", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "The proxy serves /tmp/portless sockets.\n",
      });
      expect(verdicts(report.observations)).toEqual(["documented-temp-convention/not-applicable"]);
    })
  );

  it.effect("the same absolute path under an archival segment is provenance", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example/research/notes.md": "Run it from /home/example/checkouts/beep-effect now.\n",
      });
      expect(verdicts(report.observations)).toEqual(["archival-provenance/not-applicable"]);
    })
  );

  it.effect("an anchor quoted as pattern data is an audit literal", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "standards/git-worktrees.md": 'The audit runs rg -n "/home/" over the tree.\n',
      });
      expect(verdicts(report.observations)).toEqual(["audit-pattern-literal/not-applicable"]);
    })
  );

  it.effect("fences do not exempt host anchors", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Setup:\n\n```bash\ncd /home/example/checkouts/beep-effect\n```\n",
      });
      expect(verdicts(report.observations)).toEqual(["actionable-host-path/not-applicable"]);
      expect(A.map(report.observations, (observation) => observation.location.line)).toEqual([4]);
    })
  );

  it.effect("a fenced repository path is a decoy and yields no observation", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "docs/guide.md": "Plan:\n\n```\nSee `packages/missing/src/index.ts`.\n```\n",
      });
      expect(report.observations).toEqual([]);
    })
  );

  it.effect("goal URI whose manifest id matches is verified", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "docs/guide.md": "Tracks repo://goal/example-packet today.\n",
        "goals/example-packet/ops/manifest.json": goalManifestText("example-packet"),
      });
      expect(verdicts(inDocument(report, "docs/guide.md"))).toEqual(["verified/resolved"]);
    })
  );

  it.effect("goal URI whose manifest declares another id is an identity mismatch", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "docs/guide.md": "Tracks repo://goal/example-packet today.\n",
        "goals/example-packet/ops/manifest.json": goalManifestText("another-packet"),
      });
      const observations = inDocument(report, "docs/guide.md");
      expect(verdicts(observations)).toEqual(["identity-mismatch/identity-mismatch"]);
      expect(
        A.map(observations, (observation) =>
          observation.resolution.status === "identity-mismatch" ? observation.resolution.declaredId : "unexpected"
        )
      ).toEqual(["another-packet"]);
    })
  );

  it.effect("goal URI with no tracked manifest is a broken target", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({ "docs/guide.md": "Tracks repo://goal/example-packet today.\n" });
      expect(verdicts(report.observations)).toEqual(["broken-target/missing"]);
    })
  );

  it.effect("a beep:ref paired with one same-line display path records that path", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example-packet/ops/NOTES.md": "[PLAN](../PLAN.md) <!-- beep:ref goal/example-packet -->\n",
        "goals/example-packet/PLAN.md": "ok\n",
        "goals/example-packet/ops/manifest.json": goalManifestText("example-packet"),
      });
      const observations = inDocument(report, "goals/example-packet/ops/NOTES.md");
      expect(verdicts(observations)).toEqual(["verified/resolved", "verified/resolved"]);
      expect(A.getSomes(A.map(observations, displayPathOf))).toEqual(["goals/example-packet/PLAN.md"]);
    })
  );

  it.effect("a beep:ref alone under a heading takes heading scope", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example-packet/README.md": "## Scope\n\n<!-- beep:ref goal/example-packet -->\n",
        "goals/example-packet/ops/manifest.json": goalManifestText("example-packet"),
      });
      const observations = inDocument(report, "goals/example-packet/README.md");
      expect(verdicts(observations)).toEqual(["verified/resolved"]);
      expect(A.getSomes(A.map(observations, displayPathOf))).toEqual([]);
    })
  );

  it.effect("two beep:refs on one line make every reference on it ambiguous", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example-packet/README.md": "<!-- beep:ref goal/example-packet --> <!-- beep:ref goal/other-packet -->\n",
        "goals/example-packet/ops/manifest.json": goalManifestText("example-packet"),
      });
      expect(verdicts(inDocument(report, "goals/example-packet/README.md"))).toEqual([
        "ambiguous-ref-pairing/not-applicable",
        "ambiguous-ref-pairing/not-applicable",
      ]);
    })
  );

  it.effect("an orphan beep:ref is ambiguous", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example-packet/README.md": "Some prose paragraph.\n\n<!-- beep:ref goal/example-packet -->\n",
        "goals/example-packet/ops/manifest.json": goalManifestText("example-packet"),
      });
      expect(verdicts(inDocument(report, "goals/example-packet/README.md"))).toEqual([
        "ambiguous-ref-pairing/not-applicable",
      ]);
    })
  );

  it.effect("duplicate spans take ordinals 0 and 1 with distinct identities", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "docs/guide.md": "First `docs/missing.md` then `docs/missing.md` again.\n",
      });
      const observations = inDocument(report, "docs/guide.md");
      expect(verdicts(observations)).toEqual(["broken-target/missing", "broken-target/missing"]);
      expect(A.map(observations, (observation) => observation.occurrence)).toEqual([0, 1]);
      expect(A.map(observations, (observation) => observation.refId)).toEqual([
        yield* expectedRefId("repo-path", "docs/guide.md", "repo-path:docs/missing.md", 0),
        yield* expectedRefId("repo-path", "docs/guide.md", "repo-path:docs/missing.md", 1),
      ]);
    })
  );

  it.effect("a binary blob on an elected extension is skipped and the run succeeds", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture(
        { "docs/guide.md": "See `docs/README.md`.\n", "docs/README.md": "ok\n" },
        {
          bytes: {
            "goals/example/ops/data.json": new Uint8Array([0xff, 0xfe, 0x00, 0x01]),
            "docs/diagram.png": new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
          },
          // A non-elected extension is out of corpus, so a run that succeeds never opened it.
          unreadable: ["docs/diagram.png"],
        }
      );
      expect(A.map(report.skipped, (blob) => `${blob.reason} ${blob.path}`)).toEqual([
        "malformed-utf8 goals/example/ops/data.json",
      ]);
      expect(verdicts(report.observations)).toEqual(["verified/resolved"]);
    })
  );
});

describe("knowledge refs check gate", () => {
  it.effect("a live gated observation fails the check with its count", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md":
          "Run it from /home/example/checkouts/beep-effect and sync the mirror at ~/mirrors/firecrawl.\n",
      });
      expect(A.length(knowledgeRefsLiveDebt(report))).toBe(2);
      expect(O.map(knowledgeRefsCheckFailure(report), (error) => error.liveDebtCount)).toEqual(O.some(2));
      const section = renderKnowledgeRefsCheckSection(report);
      expect(Str.startsWith("check: 2 live gated observation(s)")(section)).toBe(true);
      expect(section).toContain("actionable-host-path");
      expect(section).toContain("external-mirror-reference");
    })
  );

  it.effect("conventions, pattern literals, and archival provenance never gate", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Memory lives under ~/.claude/memory today.\n",
        "standards/git-worktrees.md": 'The audit runs rg -n "/home/" over the tree.\n',
        "goals/example/research/notes.md": "Captured from /home/example/checkouts/beep-effect once.\n",
        "goals/example/data/extract.jsonl": '{"blockText":"see /home/user/knowledge for the vault"}\n',
      });
      expect(A.length(knowledgeRefsLiveDebt(report))).toBe(0);
      expect(O.isNone(knowledgeRefsCheckFailure(report))).toBe(true);
      expect(renderKnowledgeRefsCheckSection(report)).toBe("check: 0 live gated observation(s)");
    })
  );

  it.effect("the check applicator logs the section and fails on live debt", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md":
          "Run it from /home/example/checkouts/beep-effect and sync the mirror at ~/mirrors/firecrawl.\n",
      });
      const exit = yield* Effect.exit(applyKnowledgeRefsCheck(report, { json: false }));
      expect(Exit.isFailure(exit)).toBe(true);
      const logs = yield* TestConsole.logLines;
      expect(A.some(logs, (line) => Str.startsWith("check: 2 live gated observation(s)")(Str.trim(String(line))))).toBe(
        true
      );
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("the check applicator skips the section under json when the census is debt-free", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Memory lives under ~/.claude/memory today.\n",
      });
      yield* applyKnowledgeRefsCheck(report, { json: true });
      expect(yield* TestConsole.logLines).toEqual([]);
    }).pipe(provideScopedLayer(TestConsole.layer))
  );

  it.effect("a Downloads descendant is live debt in the check section", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Exports land under ~/Downloads but never cite ~/Downloads/report.csv here.\n",
      });
      expect(A.length(knowledgeRefsLiveDebt(report))).toBe(1);
      const section = renderKnowledgeRefsCheckSection(report);
      expect(Str.startsWith("check: 1 live gated observation(s)")(section)).toBe(true);
      expect(section).toContain("external-mirror-reference");
      expect(section).toContain("~/Downloads/report.csv");
    })
  );
});

describe("knowledge refs negative controls", () => {
  const permutationFiles = {
    "docs/guide.md": "See `docs/README.md` and `packages/missing/src/index.ts`.\n",
    "docs/README.md": "ok\n",
    ".claude/skills/demo/SKILL.md": "Memory lives under ~/.claude/memory today.\n",
    "goals/example/research/notes.md": "Captured from /home/example/checkouts/beep-effect once.\n",
    "goals/example/ops/manifest.json": goalManifestText("example"),
    "goals/example/README.md": "Tracks repo://goal/example today.\n",
  };

  it.effect("permuting tracked entries yields byte-identical JSON", () =>
    Effect.gen(function* () {
      const forward = yield* scanFixture(permutationFiles);
      const reversed = yield* scanFixture(permutationFiles, { order: A.reverse });
      const encode = (report: KnowledgeRefsReport) => encodeKnowledgeRefsReportJson(report).pipe(Effect.orDie);
      expect(yield* encode(reversed)).toEqual(yield* encode(forward));
    })
  );

  it.effect("a tracked symlink is skipped and never followed", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture(
        { "CLAUDE.md": "Guidance citing /home/example/checkouts/beep-effect.\n" },
        { modes: { "CLAUDE.md": "120000" }, unreadable: ["CLAUDE.md"] }
      );
      expect(A.map(report.skipped, (blob) => `${blob.reason} ${blob.path}`)).toEqual(["symlink CLAUDE.md"]);
      expect(report.observations).toEqual([]);
    })
  );

  it.effect("a goal manifest tracked as a symlink is skipped, not followed, and does not resolve", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture(
        {
          "docs/guide.md": "Tracks repo://goal/example-packet today.\n",
          "goals/example-packet/ops/manifest.json": goalManifestText("example-packet"),
        },
        {
          modes: { "goals/example-packet/ops/manifest.json": "120000" },
          // The archive drops link entries, so a run that succeeds never tried to read it.
          unreadable: ["goals/example-packet/ops/manifest.json"],
        }
      );
      expect(A.map(report.skipped, (blob) => `${blob.reason} ${blob.path}`)).toEqual([
        "symlink goals/example-packet/ops/manifest.json",
      ]);
      expect(verdicts(inDocument(report, "docs/guide.md"))).toEqual(["broken-target/missing"]);
    })
  );

  it.effect("a gitlink is skipped", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture(
        { "docs/vendored.md": "ignored\n" },
        { modes: { "docs/vendored.md": "160000" }, unreadable: ["docs/vendored.md"] }
      );
      expect(A.map(report.skipped, (blob) => `${blob.reason} ${blob.path}`)).toEqual(["gitlink docs/vendored.md"]);
    })
  );

  it.effect("renaming a document changes documentId and identity but not classification", () =>
    Effect.gen(function* () {
      const text = "See `packages/missing/src/index.ts`.\n";
      const before = yield* scanFixture({ "docs/guide.md": text });
      const after = yield* scanFixture({ "docs/renamed.md": text });
      expect(verdicts(after.observations)).toEqual(verdicts(before.observations));
      expect(A.map(before.observations, (observation) => observation.documentId)).toEqual(["docs/guide.md"]);
      expect(A.map(after.observations, (observation) => observation.documentId)).toEqual(["docs/renamed.md"]);
      expect(A.map(after.observations, (observation) => observation.refId)).not.toEqual(
        A.map(before.observations, (observation) => observation.refId)
      );
    })
  );

  it.effect("a live home path outside any beep checkout is an external mirror", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Mirror lives at /home/example/src/other-project today.\n",
      });
      expect(verdicts(report.observations)).toEqual(["external-mirror-reference/not-applicable"]);
    })
  );

  it.effect("an encoded session literal and a bare tree name take different anchors", () =>
    Effect.gen(function* () {
      const encoded = extractKnowledgeHostAnchors(
        "Scratch lives at /tmp/claude-1000/-home-user-YeeBois-projects-demo/scratchpad now."
      );
      expect(A.map(encoded, (match) => match.anchor)).toEqual(["temp", "encoded-home"]);

      const bare = extractKnowledgeHostAnchors("The YeeBois tree holds every checkout.");
      expect(A.map(bare, (match) => match.anchor)).toEqual(["bare-tree-name"]);
      expect(A.map(bare, (match) => match.token)).toEqual(["YeeBois"]);
    })
  );

  it("a tree name immediately preceded by a slash is not a second anchor", () => {
    const matches = extractKnowledgeHostAnchors("Checkout is /home/example/YeeBois/projects/beep-effect here.");
    expect(A.map(matches, (match) => match.anchor)).toEqual(["home-absolute"]);
  });

  const archivalHostInput = (patternContext: boolean): KnowledgeRefClassificationInput => ({
    kind: "host-path",
    surface: "archival",
    resolutionStatus: "not-applicable",
    anchor: O.some("home-absolute"),
    token: O.some("/home/example/checkouts/beep-effect"),
    patternContext,
    pairingAmbiguous: false,
    ungoverned: false,
  });

  const grammarFailureInput = (
    kind: KnowledgeRefClassificationInput["kind"],
    failure: { readonly pairingAmbiguous: boolean; readonly ungoverned: boolean }
  ): KnowledgeRefClassificationInput => ({
    kind,
    surface: "live",
    resolutionStatus: "not-applicable",
    anchor: O.none(),
    token: O.none(),
    patternContext: false,
    pairingAmbiguous: failure.pairingAmbiguous,
    ungoverned: failure.ungoverned,
  });

  it("pattern-literal context outranks archival provenance", () => {
    expect(classifyKnowledgeRef(archivalHostInput(true))).toBe("audit-pattern-literal");
    expect(classifyKnowledgeRef(archivalHostInput(false))).toBe("archival-provenance");
  });

  it("pairing ambiguity and ungoverned syntax outrank every resolution outcome", () => {
    expect(classifyKnowledgeRef(grammarFailureInput("goal-uri", { pairingAmbiguous: true, ungoverned: false }))).toBe(
      "ambiguous-ref-pairing"
    );
    expect(classifyKnowledgeRef(grammarFailureInput("repo-path", { pairingAmbiguous: false, ungoverned: true }))).toBe(
      "ungoverned-syntax"
    );
  });

  it.effect("an undecodable goal manifest fails the run closed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        scanFixture({
          "docs/guide.md": "Tracks repo://goal/example-packet today.\n",
          "goals/example-packet/ops/manifest.json": '{"initiative":{"id":"example-packet","status":"active"}}',
        })
      );
      expect(error.message).toContain("goals/example-packet/ops/manifest.json");
      expect(error.message).toContain("does not decode");
    })
  );

  it.effect("an unparseable goal manifest fails the run closed", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        scanFixture({
          "docs/guide.md": "Tracks repo://goal/example-packet today.\n",
          "goals/example-packet/ops/manifest.json": "not json at all",
        })
      );
      expect(error.message).toContain("does not parse as JSON");
    })
  );
});

/**
 * Independent anchor recount, written against the published inventory method rather than against the
 * census implementation: every scoped regular blob at any extension, binary blobs skipped on a NUL
 * byte, lossy UTF-8 decoding, and substring counts for the five baseline anchors.
 */
const BASELINE_SCOPE_ROOT_FILES = HashSet.make("AGENTS.md", "CLAUDE.md");
const BASELINE_SCOPE_PREFIXES: ReadonlyArray<string> = [
  "goals/",
  "explorations/",
  "docs/",
  ".claude/",
  ".agents/",
  ".codex/",
  "standards/",
  ".github/",
];
const BASELINE_EXCLUDED_PREFIXES: ReadonlyArray<string> = ["docs/generated/", "docs/_internal/"];
const BASELINE_ARCHIVAL_SEGMENTS = HashSet.make(
  "history",
  "research",
  "reviews",
  "synthesis",
  "findings",
  "outputs",
  "reflections",
  "logs",
  ".proofs"
);
const BASELINE_ELECTED_EXTENSIONS: ReadonlyArray<string> = [
  ".md",
  ".json",
  ".jsonc",
  ".jsonl",
  ".toml",
  ".yml",
  ".yaml",
];

const baselineInScope = (path: string): boolean =>
  HashSet.has(BASELINE_SCOPE_ROOT_FILES, path) ||
  (A.some(BASELINE_SCOPE_PREFIXES, (prefix) => Str.startsWith(prefix)(path)) &&
    !A.some(BASELINE_EXCLUDED_PREFIXES, (prefix) => Str.startsWith(prefix)(path)));

const baselineIsArchival = (path: string): boolean =>
  A.some(Str.split("/")(path), (segment) => HashSet.has(BASELINE_ARCHIVAL_SEGMENTS, segment));

const baselineIsElected = (path: string): boolean =>
  A.some(BASELINE_ELECTED_EXTENSIONS, (extension) => Str.endsWith(extension)(path));

const lossyDecoder = new TextDecoder("utf-8");

const countOccurrences = (text: string, pattern: RegExp): number =>
  O.match(Str.match(pattern)(text), { onNone: () => 0, onSome: A.length });

type AnchorTally = {
  readonly homeAbsolute: number;
  readonly homeRelative: number;
  readonly temp: number;
  readonly runMedia: number;
  readonly bareTree: number;
};

const emptyTally: AnchorTally = { homeAbsolute: 0, homeRelative: 0, temp: 0, runMedia: 0, bareTree: 0 };

const tallyText = (text: string): AnchorTally => ({
  homeAbsolute: countOccurrences(text, /\/home\//gu),
  homeRelative: countOccurrences(text, /~\//gu),
  temp: countOccurrences(text, /\/tmp\//gu),
  runMedia: countOccurrences(text, /\/run\/media\//gu),
  bareTree: countOccurrences(text, /(?<!\/)YeeBois/gu),
});

const tallyTotal = (tally: AnchorTally): number =>
  tally.homeAbsolute + tally.homeRelative + tally.temp + tally.runMedia + tally.bareTree;

const addTally = (left: AnchorTally, right: AnchorTally): AnchorTally => ({
  homeAbsolute: left.homeAbsolute + right.homeAbsolute,
  homeRelative: left.homeRelative + right.homeRelative,
  temp: left.temp + right.temp,
  runMedia: left.runMedia + right.runMedia,
  bareTree: left.bareTree + right.bareTree,
});

type AnchorCensus = {
  readonly tally: AnchorTally;
  readonly occurrences: number;
  readonly files: number;
  readonly live: number;
  readonly archival: number;
};

const emptyCensus: AnchorCensus = { tally: emptyTally, occurrences: 0, files: 0, live: 0, archival: 0 };

const addFile = (census_: AnchorCensus, path: string, tally: AnchorTally): AnchorCensus => {
  const total = tallyTotal(tally);
  if (total === 0) {
    return census_;
  }
  const archival = baselineIsArchival(path);
  return {
    tally: addTally(census_.tally, tally),
    occurrences: census_.occurrences + total,
    files: census_.files + 1,
    live: archival ? census_.live : census_.live + total,
    archival: archival ? census_.archival + total : census_.archival,
  };
};

const countIndependently = Effect.fn("KnowledgeRefsTest.countIndependently")(function* (oracle: KnowledgeTreeOracle) {
  const scoped = A.filter(
    oracle.trackedEntries,
    (entry) => baselineInScope(entry.path) && (entry.mode === "100644" || entry.mode === "100755")
  );
  let all = emptyCensus;
  let elected = emptyCensus;
  for (const entry of scoped) {
    const bytes = yield* oracle.readBytes(entry.path);
    if (bytes.includes(0)) {
      continue;
    }
    const tally = tallyText(lossyDecoder.decode(bytes));
    all = addFile(all, entry.path, tally);
    if (baselineIsElected(entry.path)) {
      elected = addFile(elected, entry.path, tally);
    }
  }
  return { all, elected, population: A.length(scoped) };
});

const hostObservations = (report: KnowledgeRefsReport): ReadonlyArray<KnowledgeRefObservation> =>
  A.filter(report.observations, (observation) => observation.ref.kind === "host-path");

const anchorCount = (observations: ReadonlyArray<KnowledgeRefObservation>, anchor: string): number =>
  A.length(A.filter(anchorsOf(observations), (value) => value === anchor));

const baselineLayer = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer);

describe("knowledge refs baseline agreement", () => {
  it.effect(
    "the census reconciles with the published clone-agnosticism inventory",
    () =>
      Effect.gen(function* () {
        const oracle = yield* makeKnowledgeTreeOracle(BASELINE_COMMIT);
        const independent = yield* countIndependently(oracle);
        const report = yield* scanKnowledgeRefsTree(oracle);

        // Side one: the independent counter must reproduce every published inventory number.
        expect(independent.population).toBe(3805 - 4);
        expect({
          occurrences: independent.all.occurrences,
          files: independent.all.files,
          live: independent.all.live,
          archival: independent.all.archival,
        }).toEqual({ occurrences: 1741, files: 406, live: 298, archival: 1443 });
        expect(independent.all.tally).toEqual({
          homeAbsolute: 1060,
          homeRelative: 401,
          temp: 195,
          runMedia: 0,
          bareTree: 85,
        });

        // Side two: the census must equal that counter restricted to the elected extensions.
        const host = hostObservations(report);
        const hostFiles = HashSet.size(HashSet.fromIterable(A.map(host, (observation) => observation.documentId)));
        const hostLive = A.length(A.filter(host, (observation) => KnowledgeRefSurface.is.live(observation.surface)));
        const observed = {
          occurrences: A.length(host),
          files: hostFiles,
          live: hostLive,
          archival: A.length(host) - hostLive,
        };
        expect(observed).toEqual({
          occurrences: independent.elected.occurrences,
          files: independent.elected.files,
          live: independent.elected.live,
          archival: independent.elected.archival,
        });
        expect(observed).toEqual({ occurrences: 1158, files: 291, live: 287, archival: 871 });
        expect({
          homeAbsolute: anchorCount(host, "home-absolute"),
          homeRelative: anchorCount(host, "home-relative"),
          temp: anchorCount(host, "temp"),
          bareTree: anchorCount(host, "encoded-home") + anchorCount(host, "bare-tree-name"),
        }).toEqual({
          homeAbsolute: independent.elected.tally.homeAbsolute,
          homeRelative: independent.elected.tally.homeRelative,
          temp: independent.elected.tally.temp,
          bareTree: independent.elected.tally.bareTree,
        });
        expect({
          homeAbsolute: anchorCount(host, "home-absolute"),
          homeRelative: anchorCount(host, "home-relative"),
          temp: anchorCount(host, "temp"),
          bareTree: anchorCount(host, "encoded-home") + anchorCount(host, "bare-tree-name"),
        }).toEqual({ homeAbsolute: 630, homeRelative: 382, temp: 122, bareTree: 24 });

        // No elected-extension blob fails strict UTF-8 at this snapshot, so only links are skipped.
        expect(
          A.map(
            A.filter(report.skipped, (blob) => blob.reason === "malformed-utf8"),
            (blob) => blob.path
          )
        ).toEqual([]);
      }).pipe(Effect.scoped, provideScopedLayer(baselineLayer)),
    BASELINE_TIMEOUT_MS
  );
});

const sourceBoundExamples = [
  {
    source:
      '    const encodedSsh = Effect.runSync(\n      encodeUnknownAIMetricsRemoteSshConfig(\n        AIMetricsRemoteSshConfig.make({\n          agentSocketPath: O.some("/tmp/agent.sock"),\n        })\n      )\n    );',
    evidence:
      'Effect.runSync( encodeUnknownAIMetricsRemoteSshConfig( AIMetricsRemoteSshConfig.make({ agentSocketPath: O.some("/tmp/agent.sock"), }) ) )',
  },
  {
    source:
      '      yield* withObs(\n        {\n          StopRecord: (_, publish) =>\n            publish(\n              ObsRecordStateChangedEvent.make({\n                outputActive: false,\n                outputPath: O.some("/tmp/beep-qa-video/from-event.mkv"),\n                outputState: "OBS_WEBSOCKET_OUTPUT_STOPPED",\n              })\n            ).pipe(Effect.as(O.some({ outputPath: "/tmp/beep-qa-video/capture.mkv" }))),\n        },\n        Effect.fnUntraced(function* (obs) {\n          const result = yield* obs.stopRecording();\n          expect(result.outputPath).toBe("/tmp/beep-qa-video/capture.mkv");\n        })\n      );',
    evidence:
      'withObs( { StopRecord: (_, publish) => publish( ObsRecordStateChangedEvent.make({ outputActive: false, outputPath: O.some("/tmp/beep-qa-video/from-event.mkv"), outputState: "OBS_WEBSOCKET_OUTPUT_STOP\u0050',
  },
  {
    source:
      '    Effect.scoped(\n      Effect.gen(function* () {\n        const harness = yield* makeProbeHarness(\n          "resolved\\tgoals\\tdoctor\\nextra",\n          "\\u001B[31mwarning\\u001B[0m at /home/operator/private/runtime.ts\\u0001"\n        );\n        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));\n\n        assert.strictEqual(error._tag, "KnowledgeOperationalError");\n        assert.include(error.message, "expected 1 line(s), received 2");\n        assert.include(error.message, "stdout:");\n        assert.include(error.message, "stderr:");\n        assert.include(error.message, "warning at <absolute-path>");\n        assert.notInclude(error.message, "/home/operator");\n        assert.notInclude(error.message, "\\u001B");\n        assert.notInclude(error.message, "\\u0001");\n      })\n    ).pipe(provideScopedLayer(testLayer))',
    evidence:
      'Effect.scoped( Effect.gen(function* () { const harness = yield* makeProbeHarness( "resolved\\tgoals\\tdoctor\\nextra", "\\u001B[31mwarning\\u001B[0m at /home/operator/private/runtime.ts\\u0001" ); const err',
  },
  {
    source:
      '    Effect.scoped(\n      Effect.gen(function* () {\n        const harness = yield* makeProbeHarness(\n          "unsafe stdout from /home/operator/private/stdout.ts",\n          "\\u001B[31mSyntaxError\\u001B[0m in /home/operator/private/stderr.ts\\u0001\\r\\nsecond\\rspoof at /secret and C:\\\\secret and /home/üser/prójects/tökens.ts:3:7 plus /données/été near /var/💼client-secret/config.ts:3:7 (see https://example.com/keep-this-path)",\n          1\n        );\n        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));\n\n        assert.strictEqual(error._tag, "KnowledgeProbeBootError");\n        assert.include(error.message, "Current-checkout command probe against archive data failed with exit 1");\n        assert.include(error.message, "stdout:");\n        assert.include(error.message, "stderr:");\n        assert.notInclude(error.message, harness.currentCheckoutRoot);\n        assert.notInclude(error.message, harness.archiveRoot);\n        assert.notInclude(error.message, harness.scratchRoot);\n        assert.notInclude(error.message, "/home/operator");\n        assert.notInclude(error.message, "/secret");\n        assert.notInclude(error.message, "C:\\\\secret");\n        // Non-ASCII, emoji, and punctuation segments must be swallowed by the same redaction, tail\n        // and line:col included — an enumerated segment class used to stop at the first character\n        // outside it and leak `üser/prójects/tökens.ts:3:7` or `💼client-secret/config.ts`.\n        assert.notInclude(error.message, "üser");\n        assert.notInclude(error.message, "prójects");\n        assert.notInclude(error.message, "tökens");\n        assert.notInclude(error.message, "3:7");\n        assert.notInclude(error.message, "données");\n        assert.notInclude(error.message, "été");\n        assert.notInclude(error.message, "💼");\n        assert.notInclude(error.message, "client-secret");\n        // URLs are not filesystem paths: the redaction must leave them legible.\n        assert.include(error.message, "https://example.com/keep-this-path");\n        assert.include(error.message, "secondspoof");\n        assert.notInclude(error.message, "\\r");\n        assert.notInclude(error.message, "\\u001B");\n        assert.notInclude(error.message, "\\u0001");\n      })\n    ).pipe(provideScopedLayer(testLayer))',
    evidence:
      'Effect.scoped( Effect.gen(function* () { const harness = yield* makeProbeHarness( "unsafe stdout from /home/operator/private/stdout.ts", "\\u001B[31mSyntaxError\\u001B[0m in /home/operator/private/stder',
  },
  {
    source:
      '  expect(\n    Result.isFailure(\n      decodeDerivedStorageWriteResult({\n        archiveObjectCount: 0,\n        duckDbPath: "/tmp/metrics/derived/ai-metrics.duckdb",\n        ingestRunId: "ingest-1",\n        parquetExportMode: "snapshot",\n        parquetTables: ["not_a_derived_table"],\n        sourceFileCount: 0,\n        turnCount: 0,\n      })\n    )\n  ).toBe(true);',
    evidence:
      'expect( Result.isFailure( decodeDerivedStorageWriteResult({ archiveObjectCount: 0, duckDbPath: "/tmp/metrics/derived/ai-metrics.duckdb", ingestRunId: "ingest-1", parquetExportMode: "snapshot", parquet',
  },
  {
    source:
      '  expect(() =>\n    AiMetricsRetentionSelector.make({\n      dataRoot: "/tmp/metrics",\n      sinceEpochMillis: O.some(20),\n      untilEpochMillis: O.some(10),\n    })\n  ).toThrow();',
    evidence:
      'expect(() => AiMetricsRetentionSelector.make({ dataRoot: "/tmp/metrics", sinceEpochMillis: O.some(20), untilEpochMillis: O.some(10), }) ).toThrow()',
  },
  {
    source:
      '  layer(\n    mockSpawnerLayer((command) => {\n      assert.strictEqual(command.command, "kdialog");\n      assert.deepStrictEqual(command.args, [\n        "--title",\n        "Select workspace vault",\n        "--getexistingdirectory",\n        "/home/user",\n      ]);\n      assert.strictEqual(command.options.stdin, "ignore");\n      assert.strictEqual(command.options.stdout, "pipe");\n      assert.strictEqual(command.options.stderr, "ignore");\n      return { stdout: "/home/user/vault1\\n" };\n    })\n  )("with a kdialog selection", (it) => {',
    evidence:
      'layer( mockSpawnerLayer((command) => { assert.strictEqual(command.command, "kdialog"); assert.deepStrictEqual(command.args, [ "--title", "Select workspace vault", "--getexistingdirectory", "/home/user',
  },
  {
    source:
      '  layer(mockSpawnerLayer((command) => (command.command === "kdialog" ? "missing" : { stdout: "/home/user/vault2\\n" })))(',
    evidence:
      'layer(mockSpawnerLayer((command) => (command.command === "kdialog" ? "missing" : { stdout: "/home/user/vault2\\n" })))',
  },
];

const generatedSourcePath = "packages/example/test/generated.test.ts";
const generatedJsonlPath = "goals/effect-vitest-canon/ops/inventory/detector/beep_example.jsonl";
const generatedInventoryPath = "standards/effect-vitest.inventory.jsonc";
const generatedFinding = (source: string, evidence: string): EffectVitestFinding =>
  EffectVitestFinding.make({
    id: "EV001:fixture#1",
    lens: "detector",
    ruleId: "EV001",
    package: "@beep/example",
    file: generatedSourcePath,
    line: 1,
    endLine: O.some(Str.split("\n")(source).length),
    symbol: O.some("fixture"),
    class: "runtime-boundary-in-test",
    evidence,
    replacement: EffectVitestReplacement.make({ primitive: "it.effect", sketch: "Return the Effect." }),
    severity: "major",
    confidence: 0.95,
    mechanization: "detector",
    status: "open",
  });
const generatedDocuments = Effect.fnUntraced(function* (finding: EffectVitestFinding) {
  const row = yield* encodeEffectVitestFindingJson(finding);
  const inventory = yield* encodeEffectVitestInventoryDocument(
    EffectVitestInventoryDocument.make({
      schemaVersion: "effect-vitest-inventory/v1",
      effectVitestVersion: "4.0.0-rc.115",
      scope: [],
      findings: [finding],
    })
  );
  return {
    [generatedJsonlPath]: row,
    [generatedInventoryPath]: `// Generated inventory\n${yield* formatJsonc(inventory)}`,
  };
});

describe("knowledge refs source-bound generated evidence", () => {
  it.effect(
    "retains all eight temp and ten home observations as verified data, including two truncated anchors",
    Effect.fnUntraced(function* () {
      let temp = 0;
      let home = 0;
      for (const { source, evidence } of sourceBoundExamples) {
        const docs = yield* generatedDocuments(generatedFinding(source, evidence));
        const reads = A.empty<string>();
        const oracle = makeFixtureOracle({ ...docs, [generatedSourcePath]: source });
        const report = yield* census({
          ...oracle,
          readBytes: (file) => {
            reads.push(file);
            return oracle.readBytes(file);
          },
        });
        expect(A.filter(reads, (file) => file === generatedSourcePath).length).toBe(1);
        const hosts = hostObservations(report);
        expect(
          A.map(hosts, (row) => [row.documentId, row.classification]),
          evidence
        ).toEqual(A.map(hosts, (row) => [row.documentId, "audit-pattern-literal"]));
        temp += anchorCount(hosts, "temp");
        home += anchorCount(hosts, "home-absolute");
        const unverified = hostObservations(yield* scanFixture(docs));
        expect(A.map(hosts, ({ classification, remediation, ...identity }) => identity)).toEqual(
          A.map(unverified, ({ classification, remediation, ...identity }) => identity)
        );
        expect(knowledgeRefsLiveDebt(report).length).toBe(0);
        expect(A.every(unverified, (row) => row.classification !== "audit-pattern-literal")).toBe(true);
      }
      expect(temp).toBe(8);
      expect(home).toBe(10);
    })
  );

  it.effect(
    "keeps adjacent reason and command anchors gated through escaped JSON and CRLF",
    Effect.fnUntraced(function* () {
      const source = 'consume("quoted \\"name\\" /tmp/data");';
      const evidence = 'consume("quoted \\"name\\" /tmp/data")';
      const finding = EffectVitestFinding.make({
        ...generatedFinding(source, evidence),
        reason: O.some("/home/operator/guidance"),
      });
      const docs = yield* generatedDocuments(finding);
      const row = `${Str.slice(0, -1)(docs[generatedJsonlPath])},"command":"/tmp/real-work"}`;
      const report = yield* scanFixture({
        [generatedJsonlPath]: row,
        [generatedInventoryPath]: Str.replaceAll("\n", "\r\n")(docs[generatedInventoryPath]),
        [generatedSourcePath]: source,
      });
      const hosts = hostObservations(report);
      expect(A.filter(hosts, (row) => row.classification === "audit-pattern-literal").length).toBe(2);
      expect(knowledgeRefsLiveDebt(report).length).toBe(3);
      expect(A.every(knowledgeRefsLiveDebt(report), (row) => row.ref.kind === "host-path")).toBe(true);
    })
  );

  it.effect(
    "fails closed on missing, nonregular, stale, malformed and forged provenance",
    Effect.fnUntraced(function* () {
      const source = 'consume("/tmp/data")';
      const finding = generatedFinding(source, source);
      const docs = yield* generatedDocuments(finding);
      for (const options of [
        { modes: { [generatedSourcePath]: "120000" } },
        { modes: { [generatedSourcePath]: "160000" } },
        { unreadable: [generatedSourcePath] },
      ]) {
        const report = yield* scanFixture({ ...docs, [generatedSourcePath]: source }, options);
        expect(knowledgeRefsLiveDebt(report).length).toBe(2);
      }
      for (const modified of [
        EffectVitestFinding.make({ ...finding, line: 2, endLine: O.some(2) }),
        EffectVitestFinding.make({ ...finding, evidence: 'consume("/tmp/forged")' }),
        EffectVitestFinding.make({ ...finding, endLine: O.none() }),
        EffectVitestFinding.make({ ...finding, file: "packages/missing/test/source.test.ts" }),
      ]) {
        const report = yield* scanFixture({ ...(yield* generatedDocuments(modified)), [generatedSourcePath]: source });
        expect(knowledgeRefsLiveDebt(report).length).toBe(2);
      }
      const row = docs[generatedJsonlPath];
      for (const content of [
        `${row} malformed`,
        Str.replace('"detector"', '"forged-producer"')(row),
        `${Str.slice(0, -1)(row)},"evidence":"consume(\\"/tmp/data\\")"}`,
        '{"evidence":"consume(\\"/tmp/data\\")"}',
      ]) {
        const report = yield* scanFixture({ [generatedJsonlPath]: content, [generatedSourcePath]: source });
        expect(A.every(hostObservations(report), (row) => row.classification !== "audit-pattern-literal")).toBe(true);
      }
      for (const content of [source, '/* consume("/tmp/data") */', 'consume("/tmp/stale")', 'consume("/tmp/data)']) {
        const report = yield* scanFixture({
          "docs/quoted.jsonl": row,
          "docs/guide.md": "`/tmp/guidance`",
          [generatedSourcePath]: content,
        });
        expect(knowledgeRefsLiveDebt(report).length).toBe(2);
      }
      const wrongSchema = Str.replace('"effect-vitest-inventory/v1"', '"other/v1"')(docs[generatedInventoryPath]);
      expect(
        knowledgeRefsLiveDebt(
          yield* scanFixture({ [generatedInventoryPath]: wrongSchema, [generatedSourcePath]: source })
        ).length
      ).toBe(1);
      const comment = '/* consume("/tmp/data") */';
      const commentDocs = yield* generatedDocuments(generatedFinding(comment, comment));
      expect(knowledgeRefsLiveDebt(yield* scanFixture({ ...commentDocs, [generatedSourcePath]: comment })).length).toBe(
        2
      );
    })
  );
});

it.effect(
  "knowledge refs source-bound generated evidence requires the full closed source for a truncated prefix",
  Effect.fnUntraced(function* () {
    const source = `consume("${"x".repeat(180)}/tmp/closed-path")`;
    const evidence = Str.slice(0, 200)(source);
    const docs = yield* generatedDocuments(generatedFinding(source, evidence));
    expect(
      A.every(
        hostObservations(yield* scanFixture({ ...docs, [generatedSourcePath]: source })),
        (row) => row.classification === "audit-pattern-literal"
      )
    ).toBe(true);
    for (const invalid of [evidence, `/* ${source} */`, Str.replace("closed-path", "different-path")(source)]) {
      expect(knowledgeRefsLiveDebt(yield* scanFixture({ ...docs, [generatedSourcePath]: invalid })).length).toBe(2);
    }
  })
);

it.effect(
  "rejects malformed canonical inventory before authorizing source evidence",
  Effect.fnUntraced(function* () {
    const source = 'consume("prefix /tmp/data suffix")';
    const docs = yield* generatedDocuments(generatedFinding(source, source));
    const valid = yield* scanFixture({
      [generatedInventoryPath]: docs[generatedInventoryPath],
      [generatedSourcePath]: source,
    });
    expect(A.map(hostObservations(valid), (row) => row.classification)).toEqual(["audit-pattern-literal"]);
    expect(knowledgeRefsLiveDebt(valid).length).toBe(0);
    const malformed = yield* scanFixture({
      [generatedInventoryPath]: `${docs[generatedInventoryPath]} malformed`,
      [generatedSourcePath]: source,
    });
    const hosts = hostObservations(malformed);
    expect(hosts.length).toBe(1);
    expect(A.map(hosts, (row) => (row.ref.kind === "host-path" ? row.ref.raw : ""))).toEqual(["/tmp/data"]);
    expect(A.filter(hosts, (row) => row.classification === "audit-pattern-literal")).toEqual([]);
    expect(knowledgeRefsLiveDebt(malformed).length).toBe(1);
  })
);

it.effect(
  "maps serialized Unicode escapes before evidence anchors without authorizing reasons or rereading source",
  Effect.fnUntraced(function* () {
    const source = 'consume("x /tmp/data suffix")';
    const finding = EffectVitestFinding.make({
      ...generatedFinding(source, source),
      reason: O.some("note /home/operator/guidance end"),
    });
    const docs = yield* generatedDocuments(finding);
    const escaped = R.map(docs, Str.replace("x /tmp/data", "\\u0078 /tmp/data"));
    const reads = A.empty<string>();
    const oracle = makeFixtureOracle({ ...escaped, [generatedSourcePath]: source });
    const report = yield* census({
      ...oracle,
      readBytes: (file) => {
        reads.push(file);
        return oracle.readBytes(file);
      },
    });
    const hosts = hostObservations(report);
    expect(hosts.length).toBe(4);
    expect(
      A.map(
        A.filter(hosts, (row) => row.classification === "audit-pattern-literal"),
        (row) => (row.ref.kind === "host-path" ? row.ref.raw : "")
      )
    ).toEqual(["/tmp/data", "/tmp/data"]);
    expect(A.map(knowledgeRefsLiveDebt(report), (row) => (row.ref.kind === "host-path" ? row.ref.raw : ""))).toEqual([
      "/home/operator/guidance",
      "/home/operator/guidance",
    ]);
    expect(A.filter(reads, (file) => file === generatedSourcePath).length).toBe(1);
    const unescaped = yield* scanFixture({ ...docs, [generatedSourcePath]: source });
    expect(A.map(hostObservations(unescaped), (row) => [row.documentId, row.classification])).toEqual(
      A.map(hosts, (row) => [row.documentId, row.classification])
    );
    expect(
      A.map(
        hosts,
        (row) =>
          (row.location.column ?? 0) -
          A.findFirst(
            hostObservations(unescaped),
            (other) => other.documentId === row.documentId && other.ref.raw === row.ref.raw
          ).pipe(
            O.map((other) => other.location.column ?? 0),
            O.getOrElse(() => 0)
          )
      )
    ).toEqual([5, 5, 5, 0]);
  })
);
