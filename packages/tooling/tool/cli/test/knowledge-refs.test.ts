import {
  applyKnowledgeRefsCheck,
  classifyKnowledgeRef,
  encodeKnowledgeRefsReportJson,
  extractKnowledgeHostAnchors,
  KnowledgeOperationalError,
  KnowledgeRefSurface,
  KnowledgeTrackedEntry,
  knowledgeRefsCheckFailure,
  knowledgeRefsLiveDebt,
  makeKnowledgeTreeOracle,
  scanKnowledgeRefsTree,
} from "@beep/repo-cli/commands/Knowledge";
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

  it.effect("a packet data directory is an archival segment", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        "goals/example/data/extract.jsonl": '{"blockText":"see /home/user/knowledge for the vault"}\n',
      });
      expect(verdicts(report.observations)).toEqual(["archival-provenance/not-applicable"]);
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
    }).pipe(Effect.provide(TestConsole.layer))
  );

  it.effect("the check applicator skips the section under json when the census is debt-free", () =>
    Effect.gen(function* () {
      const report = yield* scanFixture({
        ".claude/skills/demo/SKILL.md": "Memory lives under ~/.claude/memory today.\n",
      });
      yield* applyKnowledgeRefsCheck(report, { json: true });
      expect(yield* TestConsole.logLines).toEqual([]);
    }).pipe(Effect.provide(TestConsole.layer))
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
