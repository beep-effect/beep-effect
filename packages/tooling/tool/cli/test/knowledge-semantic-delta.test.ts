import {
  encodeKnowledgeSemanticDeltaReportJson,
  KNOWLEDGE_PROBE_DEPENDENT_KINDS,
  KnowledgeCommandResolved,
  KnowledgeCommandUnknown,
  KnowledgeIndexBytes,
  KnowledgeOperationalError,
  KnowledgeProbeBootError,
  KnowledgeRename,
  KnowledgeService,
  KnowledgeServiceLive,
  KnowledgeTrackedEntry,
  knowledgeSemanticDeltaFailure,
  resolveKnowledgeProbePolicy,
} from "@beep/repo-cli/commands/Knowledge";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, Encoding, Exit, FileSystem, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type {
  KnowledgeArchiveOracle,
  KnowledgeFinding,
  KnowledgeFindingKind,
  KnowledgePairedOracleInput,
  KnowledgeProbePolicy,
  KnowledgeSemanticDeltaReport,
} from "@beep/repo-cli/commands/Knowledge";

const textEncoder = new TextEncoder();
const DEFAULT_INDEX = "# Goals Index\n";
const testLayer = KnowledgeServiceLive.pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(NodeCrypto.layer)
);

type OracleOptions = {
  readonly indexExpected?: string;
  readonly indexArchived?: string;
  readonly modes?: Readonly<Record<string, string>>;
  readonly objectIds?: Readonly<Record<string, string>>;
};

const resolvedCommand = (canonicalPath: ReadonlyArray<string>) => KnowledgeCommandResolved.make({ canonicalPath });

const probeCommand = (words: ReadonlyArray<string>) => {
  const first = A.head(words);
  if (O.isNone(first)) {
    return resolvedCommand([]);
  }
  if (first.value !== "goals") {
    return KnowledgeCommandUnknown.make({ canonicalPath: [first.value] });
  }
  const second = A.get(words, 1);
  if (O.isNone(second) || Str.startsWith("-")(second.value)) {
    return resolvedCommand(["goals"]);
  }
  return second.value === "doctor"
    ? resolvedCommand(["goals", "doctor"])
    : KnowledgeCommandUnknown.make({ canonicalPath: ["goals", second.value] });
};

const makeOracle = (
  sourceFiles: Readonly<Record<string, string>>,
  options: OracleOptions = {}
): KnowledgeArchiveOracle => {
  const files = R.set(sourceFiles, "goals/INDEX.md", options.indexArchived ?? DEFAULT_INDEX);
  const entries = A.map(R.toEntries(files), ([path]) =>
    KnowledgeTrackedEntry.make({
      path,
      mode: pipeOption(R.get(options.modes ?? {}, path), "100644"),
      objectId: pipeOption(R.get(options.objectIds ?? {}, path), `oid:${path}`),
    })
  );
  return {
    trackedEntries: entries,
    readBytes: (repoPath) =>
      O.match(R.get(files, repoPath), {
        onNone: () =>
          Effect.fail(KnowledgeOperationalError.make({ message: `Fixture is missing tracked bytes for ${repoPath}.` })),
        onSome: (text) => Effect.succeed(textEncoder.encode(text)),
      }),
    probeCommands: (commands) => Effect.succeed(A.map(commands, probeCommand)),
    indexBytes: Effect.succeed(
      KnowledgeIndexBytes.make({
        expected: textEncoder.encode(options.indexExpected ?? DEFAULT_INDEX),
        archived: textEncoder.encode(options.indexArchived ?? DEFAULT_INDEX),
      })
    ),
  };
};

const pipeOption = <A>(option: O.Option<A>, fallback: A): A => O.getOrElse(option, () => fallback);

const scan = (
  input: KnowledgePairedOracleInput
): Effect.Effect<KnowledgeSemanticDeltaReport, KnowledgeOperationalError> =>
  Effect.gen(function* () {
    const service = yield* KnowledgeService;
    return yield* service.scanPair(input);
  }).pipe(provideScopedLayer(testLayer));

const fixture = (
  baseFiles: Readonly<Record<string, string>>,
  headFiles: Readonly<Record<string, string>>,
  options: {
    readonly base?: OracleOptions;
    readonly head?: OracleOptions;
    readonly probePolicy?: KnowledgeProbePolicy;
    readonly renames?: ReadonlyArray<KnowledgeRename>;
  } = {}
): KnowledgePairedOracleInput => ({
  base: makeOracle(baseFiles, options.base),
  head: makeOracle(headFiles, options.head),
  probePolicy: options.probePolicy ?? "enabled",
  renames: options.renames ?? [],
});

/**
 * An oracle whose probes fail if they are ever reached.
 *
 * A skipped comparison must decline to execute, not execute and discard: filtering probe results
 * after the fact would still have run a fork's code on the runner.
 */
const explodingProbeOracle = (
  sourceFiles: Readonly<Record<string, string>>,
  options: OracleOptions = {}
): KnowledgeArchiveOracle => {
  const unreachable = KnowledgeOperationalError.make({
    message: "Archive-local probe executed under a skipped probe policy.",
  });
  return {
    ...makeOracle(sourceFiles, options),
    probeCommands: () => Effect.fail(unreachable),
    indexBytes: Effect.fail(unreachable),
  };
};

/**
 * A real archive boot failure, reproduced verbatim from the branch that deleted a barrel export the
 * merge-base CLI still imported. The blank line is part of Bun's own output, so the excerpt carried
 * into the report is exercised against the shape it actually has to survive.
 */
const BOOT_FAILURE = KnowledgeProbeBootError.make({
  message: A.join(
    [
      'Archive-local probe "/tmp/beep-knowledge-semantic-delta-8YSRkf/base-scratch/command-probe.ts" failed with exit 1.',
      "SyntaxError: Export named 'DEFAULT_AI_METRICS_DATA_ROOT' not found in module '/repo/packages/tooling/library/ai-metrics/src/index.ts'.",
      "",
      "Bun v1.3.14 (Linux x64)",
    ],
    "\n"
  ),
});

/** An oracle whose archive cannot start either probe, the way an unbootable revision cannot. */
const unbootableProbeOracle = (
  sourceFiles: Readonly<Record<string, string>>,
  options: OracleOptions = {}
): KnowledgeArchiveOracle => ({
  ...makeOracle(sourceFiles, options),
  probeCommands: () => Effect.fail(BOOT_FAILURE),
  indexBytes: Effect.fail(BOOT_FAILURE),
});

const independentDigestEffect = Effect.fn("KnowledgeTest.independentDigest")(function* (text: string) {
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

const expectedId = Effect.fn("KnowledgeTest.expectedId")(function* (
  kind: KnowledgeFindingKind,
  documentId: string,
  subject: string,
  occurrence = 0
) {
  const preimage = A.join(A.map(["knowledge-normalization/v1", kind, documentId, subject, `${occurrence}`], lp), "");
  return `knowledge-finding/v1:${yield* independentDigest(preimage)}`;
});

const introducedIds = (report: KnowledgeSemanticDeltaReport): ReadonlyArray<string> =>
  A.map(report.introduced, (finding) => finding.findingId);

const unchangedIds = (report: KnowledgeSemanticDeltaReport): ReadonlyArray<string> =>
  A.map(report.unchanged, (finding) => finding.findingId);

const sortedKinds = (findings: ReadonlyArray<KnowledgeFinding>): ReadonlyArray<KnowledgeFindingKind> =>
  A.sort(
    A.map(findings, (finding) => finding.kind),
    Order.String
  );

describe("knowledge semantic-delta golden paired fixtures", () => {
  it.effect("content edit introduces only the new broken tracked path", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "Use `docs/existing.md`.\n", "docs/existing.md": "ok\n" },
          { "docs/guide.md": "Use `docs/missing.md`.\n", "docs/existing.md": "ok\n" }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md"),
      ]);
    })
  );

  it.effect("pure reflow preserves the inherited finding id", () =>
    Effect.gen(function* () {
      const input = fixture(
        { "docs/guide.md": "First line.\nUse `docs/missing.md` here.\n" },
        { "docs/guide.md": "\n\nRewrapped prose now uses `docs/missing.md` here.\n" }
      );
      const report = yield* scan(input);
      const inherited = yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md");
      expect(introducedIds(report)).toEqual([]);
      expect(unchangedIds(report)).toEqual([inherited]);
    })
  );

  it.effect("rename-only preserves the base document lineage", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/old.md": "Use `docs/missing.md`.\n" },
          { "docs/new.md": "Use `docs/missing.md`.\n" },
          {
            renames: [
              KnowledgeRename.make({
                sourcePath: "docs/old.md",
                targetPath: "docs/new.md",
                score: NonNegativeInt.make(100),
              }),
            ],
          }
        )
      );
      const inherited = yield* expectedId("broken-tracked-path", "base:docs/old.md", "repo-path:docs/missing.md");
      expect(introducedIds(report)).toEqual([]);
      expect(unchangedIds(report)).toEqual([inherited]);
    })
  );

  it.effect("rename plus edit introduces only the added broken path", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/old.md": "Use `docs/missing.md`.\n" },
          { "docs/new.md": "Use `docs/missing.md` and `packages/missing/src/index.ts`.\n" },
          {
            renames: [
              KnowledgeRename.make({
                sourcePath: "docs/old.md",
                targetPath: "docs/new.md",
                score: NonNegativeInt.make(80),
              }),
            ],
          }
        )
      );
      const inherited = yield* expectedId("broken-tracked-path", "base:docs/old.md", "repo-path:docs/missing.md");
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/old.md", "repo-path:packages/missing/src/index.ts"),
      ]);
      expect(unchangedIds(report)).toEqual([inherited]);
    })
  );

  it.effect("command added with an option tail remains valid", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No command.\n" },
          { "docs/guide.md": "Run `bun run beep goals doctor --write-baseline`.\n" }
        )
      );
      expect(introducedIds(report)).toEqual([]);
    })
  );

  it.effect("command child typo introduces the canonical unknown command finding", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "Run `bun run beep goals doctor`.\n" },
          { "docs/guide.md": "Run `bun run beep goals doctro --write`.\n" }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("unknown-beep-command", "base:docs/guide.md", "beep-command:goals doctro"),
      ]);
    })
  );

  it.effect("failing path assertion emits failed-assertion only", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No assertion.\n" },
          { "docs/guide.md": "<!-- beep:assert path-exists docs/missing.md -->\n" }
        )
      );
      expect(A.map(report.introduced, (finding) => finding.kind)).toEqual(["failed-assertion"]);
      expect(introducedIds(report)).toEqual([
        yield* expectedId("failed-assertion", "base:docs/guide.md", "path-exists:docs/missing.md"),
      ]);
    })
  );

  it.effect("every fenced example is a Stage-1 decoy", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No fence.\n" },
          {
            "docs/guide.md": [
              "```bash beep:exec",
              "`docs/missing.md`",
              "`bun run beep goals doctro`",
              "<!-- beep:assert path-exists docs/missing.md -->",
              "```",
              "",
            ].join("\n"),
          }
        )
      );
      expect(introducedIds(report)).toEqual([]);
    })
  );

  it.effect("fence inside a blockquote hides its decoys and still closes", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No fence.\n" },
          {
            "docs/guide.md": [
              "> Quoted note:",
              "> ```bash beep:exec",
              "> `docs/decoy.md`",
              "> `bun run beep goals doctro`",
              "> <!-- beep:assert path-exists docs/decoy.md -->",
              "> ```",
              "",
              "Back in prose, `docs/missing.md` is real.",
              "",
            ].join("\n"),
          }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md"),
      ]);
    })
  );

  it.effect("fence inside a nested list item hides its decoys and still closes", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No fence.\n" },
          {
            "docs/guide.md": [
              "- outer item",
              "    - inner item",
              "        ```bash",
              "        `docs/decoy.md`",
              "        `bun run beep goals doctro`",
              "        ```",
              "",
              "Back in prose, `docs/missing.md` is real.",
              "",
            ].join("\n"),
          }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md"),
      ]);
    })
  );

  it.effect("double-backtick inline span yields the same broken tracked path", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "Use ``docs/existing.md``.\n", "docs/existing.md": "ok\n" },
          { "docs/guide.md": "Use ``docs/missing.md``.\n", "docs/existing.md": "ok\n" }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md"),
      ]);
    })
  );

  it.effect("padded triple-backtick inline span still probes the beep command", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "Run ``` bun run beep goals doctor ``` today.\n" },
          { "docs/guide.md": "Run ``` bun run beep goals doctro ``` today.\n" }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("unknown-beep-command", "base:docs/guide.md", "beep-command:goals doctro"),
      ]);
    })
  );

  it.effect("alternate path spelling preserves the normalized finding id", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture({ "docs/guide.md": "Use `./missing.md`.\n" }, { "docs/guide.md": "Use `docs/./missing.md`.\n" })
      );
      const inherited = yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md");
      expect(introducedIds(report)).toEqual([]);
      expect(unchangedIds(report)).toEqual([inherited]);
    })
  );

  it.effect("whole-file index drift uses the expected and archived byte digests", () =>
    Effect.gen(function* () {
      const expected = "# Goals Index\nnew projection\n";
      const archived = "# Goals Index\nold projection\n";
      const report = yield* scan(fixture({}, {}, { head: { indexExpected: expected, indexArchived: archived } }));
      const expectedHash = yield* independentDigest(expected);
      const archivedHash = yield* independentDigest(archived);
      expect(introducedIds(report)).toEqual([
        yield* expectedId(
          "index-drift",
          "base:goals/INDEX.md",
          `producer://goals/index:${expectedHash}:${archivedHash}`
        ),
      ]);
    })
  );
});

describe("knowledge semantic-delta negative controls", () => {
  it.effect("adding a duplicate occurrence introduces ordinal one only", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "Use `docs/missing.md`.\n" },
          { "docs/guide.md": "Use `docs/missing.md`, then `docs/missing.md` again.\n" }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/missing.md", 1),
      ]);
    })
  );

  it.effect("rename-away plus recreate gives the recreated document a blob-disambiguated lineage", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/old.md": "Use `docs/missing.md`.\n" },
          {
            "docs/new.md": "Use `docs/missing.md`.\n",
            "docs/old.md": "Use `docs/missing.md`.\n",
          },
          {
            head: { objectIds: { "docs/old.md": "recreated-blob-oid" } },
            renames: [
              KnowledgeRename.make({
                sourcePath: "docs/old.md",
                targetPath: "docs/new.md",
                score: NonNegativeInt.make(100),
              }),
            ],
          }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId(
          "broken-tracked-path",
          "head-new:docs/old.md:recreated-blob-oid",
          "repo-path:docs/missing.md"
        ),
      ]);
    })
  );

  it.effect("sub-50-percent rename is delete plus add with new lineage", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture({ "docs/old.md": "Use `docs/missing.md`.\n" }, { "docs/new.md": "Use `docs/missing.md`.\n" })
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "head-new:docs/new.md", "repo-path:docs/missing.md"),
      ]);
    })
  );

  it.effect("tracked symlink escape cannot manufacture descendants in the tracked-tree oracle", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No path.\n", "docs/link": "../../outside" },
          { "docs/guide.md": "Use `docs/link/secret.md`.\n", "docs/link": "../../outside" },
          {
            base: { modes: { "docs/link": "120000" } },
            head: { modes: { "docs/link": "120000" } },
          }
        )
      );
      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:docs/link/secret.md"),
      ]);
    })
  );

  it.effect("malformed assertion is ignored instead of partially parsed", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No assertion.\n" },
          { "docs/guide.md": "<!-- beep:assert path-exists docs/missing.md unexpected -->\n" }
        )
      );
      expect(introducedIds(report)).toEqual([]);
    })
  );
});

describe("knowledge semantic-delta gate semantics", () => {
  it.effect("a finding this branch introduced gates the lane", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture({ "docs/guide.md": "Nothing cited.\n" }, { "docs/guide.md": "Use `docs/missing.md`.\n" })
      );
      const failure = knowledgeSemanticDeltaFailure(report);

      expect(A.length(report.introduced)).toBe(1);
      expect(O.map(failure, (error) => error.introducedCount)).toEqual(O.some(1));
    })
  );

  it.effect("a finding inherited from the merge-base never gates the lane", () =>
    Effect.gen(function* () {
      const document = "Use `docs/missing.md`.\n";
      const report = yield* scan(fixture({ "docs/guide.md": document }, { "docs/guide.md": document }));

      expect(A.length(report.unchanged)).toBe(1);
      expect(report.introduced).toEqual([]);
      expect(O.isNone(knowledgeSemanticDeltaFailure(report))).toBe(true);
    })
  );

  it.effect("a finding this branch resolved never gates the lane", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture({ "docs/guide.md": "Use `docs/missing.md`.\n" }, { "docs/guide.md": "Nothing cited.\n" })
      );

      expect(A.length(report.resolved)).toBe(1);
      expect(O.isNone(knowledgeSemanticDeltaFailure(report))).toBe(true);
    })
  );
});

describe("knowledge semantic-delta probe policy", () => {
  const SAME_REPO = "YeeBois/beep-effect";

  // Written as raw payload bytes rather than encoded from a record: the point of the fixture is that
  // the decoder tolerates a real event payload's many unmodelled keys.
  const forkPayload = (headRepository: string): string => `{
    "action": "synchronize",
    "number": 7,
    "pull_request": {
      "id": 11,
      "head": { "ref": "topic", "repo": { "id": 12, "full_name": "${headRepository}" } }
    },
    "repository": { "full_name": "${SAME_REPO}" }
  }`;

  const NULL_HEAD_REPO_PAYLOAD = `{ "pull_request": { "head": { "repo": null } } }`;

  /** Resolves the policy for an env whose `GITHUB_EVENT_PATH` points at `payload`, when given. */
  const policyFor = (
    env: Readonly<Record<string, string | undefined>>,
    payload?: string
  ): Effect.Effect<KnowledgeProbePolicy> =>
    Effect.scoped(
      Effect.gen(function* () {
        if (payload === undefined) {
          return yield* resolveKnowledgeProbePolicy(env);
        }
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-probe-policy-" });
        const eventPath = path.join(directory, "event.json");
        yield* fs.writeFileString(eventPath, payload);
        return yield* resolveKnowledgeProbePolicy({ ...env, GITHUB_EVENT_PATH: eventPath });
      })
    ).pipe(provideScopedLayer(testLayer), Effect.orDie);

  it.effect("a push build probes, because the revision is already ours", () =>
    Effect.gen(function* () {
      expect(yield* policyFor({ GITHUB_EVENT_NAME: "push", GITHUB_REPOSITORY: SAME_REPO })).toBe("enabled");
    })
  );

  it.effect("a local run with no GitHub context probes", () =>
    Effect.gen(function* () {
      expect(yield* policyFor({})).toBe("enabled");
    })
  );

  it.effect("a same-repository pull request probes", () =>
    Effect.gen(function* () {
      const policy = yield* policyFor(
        { GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: SAME_REPO },
        forkPayload(SAME_REPO)
      );

      expect(policy).toBe("enabled");
    })
  );

  it.effect("repository names compare case-insensitively", () =>
    Effect.gen(function* () {
      const policy = yield* policyFor(
        { GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: "YeeBois/Beep-Effect" },
        forkPayload("yeebois/beep-effect")
      );

      expect(policy).toBe("enabled");
    })
  );

  it.effect("a fork pull request skips probes", () =>
    Effect.gen(function* () {
      const policy = yield* policyFor(
        { GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: SAME_REPO },
        forkPayload("contributor/beep-effect")
      );

      expect(policy).toBe("skipped-untrusted-context");
    })
  );

  it.effect("a fork pull_request_target run skips probes", () =>
    Effect.gen(function* () {
      const policy = yield* policyFor(
        { GITHUB_EVENT_NAME: "pull_request_target", GITHUB_REPOSITORY: SAME_REPO },
        forkPayload("contributor/beep-effect")
      );

      expect(policy).toBe("skipped-untrusted-context");
    })
  );

  it.effect("an undeterminable head repository skips probes rather than buying execution", () =>
    Effect.gen(function* () {
      const env = { GITHUB_EVENT_NAME: "pull_request", GITHUB_REPOSITORY: SAME_REPO };

      expect(yield* policyFor(env)).toBe("skipped-untrusted-context");
      expect(yield* policyFor({ ...env, GITHUB_EVENT_PATH: "/nonexistent/event.json" })).toBe(
        "skipped-untrusted-context"
      );
      expect(yield* policyFor(env, "{not json")).toBe("skipped-untrusted-context");
      expect(yield* policyFor(env, NULL_HEAD_REPO_PAYLOAD)).toBe("skipped-untrusted-context");
      expect(yield* policyFor({ GITHUB_EVENT_NAME: "pull_request" }, forkPayload(SAME_REPO))).toBe(
        "skipped-untrusted-context"
      );
    })
  );

  it.effect("a skipped comparison declines to run archive-local probes at all", () =>
    Effect.gen(function* () {
      const service = yield* KnowledgeService;
      const input = (probePolicy: KnowledgeProbePolicy): KnowledgePairedOracleInput => ({
        base: explodingProbeOracle({ "docs/guide.md": "Nothing cited.\n" }),
        head: explodingProbeOracle({ "docs/guide.md": "Run `bun run beep goals doctro`.\n" }),
        probePolicy,
        renames: [],
      });
      const skipped = yield* service.scanPair(input("skipped-untrusted-context"));
      // Counterfactual: the same oracles under `enabled` do reach the probe, so the pass above is a
      // guard doing its job and not a fixture that had nothing to execute.
      const probed = yield* Effect.exit(service.scanPair(input("enabled")));

      expect(skipped.probePolicy).toBe("skipped-untrusted-context");
      expect(skipped.introduced).toEqual([]);
      expect(Exit.isFailure(probed)).toBe(true);
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("a skipped comparison drops the probe-dependent classes and keeps the rest", () =>
    Effect.gen(function* () {
      const baseFiles = { "docs/guide.md": "Nothing cited.\n" };
      const headFiles = { "docs/guide.md": "Run `bun run beep goals doctro`, see `docs/missing.md`.\n" };
      const drift = { head: { indexExpected: "# Regenerated Goals Index\n" } };
      const probed = yield* scan(fixture(baseFiles, headFiles, drift));
      const skipped = yield* scan(
        fixture(baseFiles, headFiles, { ...drift, probePolicy: "skipped-untrusted-context" })
      );
      const kinds = (report: KnowledgeSemanticDeltaReport): ReadonlyArray<KnowledgeFindingKind> =>
        A.sort(
          A.map(report.introduced, (finding) => finding.kind),
          Order.String
        );

      expect(kinds(probed)).toEqual(A.sort(["broken-tracked-path", ...KNOWLEDGE_PROBE_DEPENDENT_KINDS], Order.String));
      expect(kinds(skipped)).toEqual(["broken-tracked-path"]);
    })
  );
});

describe("knowledge semantic-delta base probe boot failure", () => {
  const CLEAN_BASE = { "docs/guide.md": "Nothing cited.\n" };
  const DIRTY_HEAD = { "docs/guide.md": "Run `bun run beep goals doctro`, see `docs/missing.md`.\n" };
  const HEAD_DRIFT: OracleOptions = { indexExpected: "# Regenerated Goals Index\n" };

  const withUnbootableBase = (
    baseFiles: Readonly<Record<string, string>>,
    headFiles: Readonly<Record<string, string>>,
    headOptions: OracleOptions = {}
  ): KnowledgePairedOracleInput => ({
    base: unbootableProbeOracle(baseFiles),
    head: makeOracle(headFiles, headOptions),
    probePolicy: "enabled",
    renames: [],
  });

  it.effect("an unbootable base degrades probe coverage instead of failing the comparison", () =>
    Effect.gen(function* () {
      const report = yield* scan(withUnbootableBase(CLEAN_BASE, DIRTY_HEAD, HEAD_DRIFT));
      const detail = O.getOrElse(report.probeSkipDetail, () => "");

      expect(report.probePolicy).toBe("skipped-base-boot-failure");
      expect(detail).toContain("failed with exit 1");
      expect(detail).toContain("DEFAULT_AI_METRICS_DATA_ROOT");
      // Blank output lines are dropped, so the excerpt is three lines of evidence rather than four.
      expect(A.length(Str.split("\n")(detail))).toBe(3);
      // The tracked-tree classes still work; only the probe-dependent ones went missing.
      expect(sortedKinds(report.introduced)).toEqual(["broken-tracked-path"]);
    })
  );

  it.effect("a degraded comparison with nothing else introduced does not gate the lane", () =>
    Effect.gen(function* () {
      const degraded = yield* scan(withUnbootableBase(CLEAN_BASE, CLEAN_BASE, HEAD_DRIFT));
      // Counterfactual: the same HEAD drift under a bootable base does introduce a finding and does
      // gate, so the pass above is degradation doing its job and not an empty fixture.
      const probed = yield* scan(fixture(CLEAN_BASE, CLEAN_BASE, { head: HEAD_DRIFT }));

      expect(degraded.probePolicy).toBe("skipped-base-boot-failure");
      expect(degraded.introduced).toEqual([]);
      expect(O.isNone(knowledgeSemanticDeltaFailure(degraded))).toBe(true);
      expect(sortedKinds(probed.introduced)).toEqual(["index-drift"]);
      expect(O.isSome(knowledgeSemanticDeltaFailure(probed))).toBe(true);
    })
  );

  it.effect("a base boot failure discards the probe results collected before it", () =>
    Effect.gen(function* () {
      const baseFiles = { "docs/guide.md": "Run `bun run beep goals doctro`.\n" };
      // Only the index probe dies, after the command probe has already resolved an unknown command.
      const degraded = yield* scan({
        base: { ...makeOracle(baseFiles), indexBytes: Effect.fail(BOOT_FAILURE) },
        head: makeOracle(CLEAN_BASE),
        probePolicy: "enabled",
        renames: [],
      });
      // Counterfactual: a bootable base does report that command finding as resolved, so keeping the
      // half-probed base would have compared it against an unprobed HEAD.
      const probed = yield* scan(fixture(baseFiles, CLEAN_BASE));

      expect(degraded.probePolicy).toBe("skipped-base-boot-failure");
      expect(degraded.introduced).toEqual([]);
      expect(degraded.resolved).toEqual([]);
      expect(degraded.unchanged).toEqual([]);
      expect(sortedKinds(probed.resolved)).toEqual(["unknown-beep-command"]);
    })
  );

  it.effect("an unbootable HEAD is still an operational failure, because HEAD is the branch's own tree", () =>
    Effect.gen(function* () {
      const service = yield* KnowledgeService;
      const error = yield* Effect.flip(
        service.scanPair({
          base: makeOracle(CLEAN_BASE),
          head: unbootableProbeOracle(DIRTY_HEAD),
          probePolicy: "enabled",
          renames: [],
        })
      );

      expect(error._tag).toBe("KnowledgeOperationalError");
      expect(error.message).toContain("DEFAULT_AI_METRICS_DATA_ROOT");
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("the JSON report carries the degraded policy and its evidence, and omits both when clean", () =>
    Effect.gen(function* () {
      const degraded = yield* encodeKnowledgeSemanticDeltaReportJson(
        yield* scan(withUnbootableBase(CLEAN_BASE, CLEAN_BASE))
      );
      const clean = yield* encodeKnowledgeSemanticDeltaReportJson(yield* scan(fixture(CLEAN_BASE, CLEAN_BASE)));

      expect(degraded).toContain(`"probePolicy":"skipped-base-boot-failure"`);
      expect(degraded).toContain("DEFAULT_AI_METRICS_DATA_ROOT");
      expect(clean).toContain(`"probePolicy":"enabled"`);
      expect(clean).not.toContain("probeSkipDetail");
    })
  );
});
