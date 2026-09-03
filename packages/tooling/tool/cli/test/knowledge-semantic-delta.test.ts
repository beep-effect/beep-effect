import {
  decodeKnowledgeUtf8,
  encodeKnowledgeSemanticDeltaReportJson,
  guardKnowledgeCloneAttributes,
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
import {
  KnowledgeCommandSurface,
  makeKnowledgeArchiveOracle,
  renderKnowledgeSemanticDeltaHumanReport,
} from "@beep/repo-cli/test/Knowledge";
import { findRepoRoot } from "@beep/repo-utils";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, Encoding, Exit, FileSystem, HashSet, Layer, Order, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ChildProcess, ChildProcessSpawner } from "effect/unstable/process";
import type {
  KnowledgeArchiveOracle,
  KnowledgeFinding,
  KnowledgeFindingKind,
  KnowledgePairedOracleInput,
  KnowledgeProbePolicy,
  KnowledgeSemanticDeltaReport,
} from "@beep/repo-cli/commands/Knowledge";

const textEncoder = new TextEncoder();
const encodeJsonString = S.encodeUnknownEffect(S.fromJsonString(S.String));
const DEFAULT_INDEX = "# Goals Index\n";
const DEFAULT_COMMAND_TREE = JSON.stringify({
  name: "beep-cli",
  alias: null,
  children: [
    {
      name: "goals",
      alias: null,
      children: [{ name: "doctor", alias: null, children: [] }],
    },
  ],
});
const COMMAND_TREE_WITHOUT_DOCTOR = JSON.stringify({
  name: "beep-cli",
  alias: null,
  children: [{ name: "goals", alias: null, children: [] }],
});
const NO_GIT_REFS = HashSet.empty<string>();
const testLayer = KnowledgeServiceLive.pipe(
  Layer.provideMerge(NodeServices.layer),
  Layer.provideMerge(NodeCrypto.layer)
);

type OracleOptions = {
  readonly commandTree?: string;
  readonly commandProbe?: typeof probeCommand;
  readonly currentCommandTree?: string;
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

const probeCommandWithoutDoctor = (words: ReadonlyArray<string>) => {
  const second = A.get(words, 1);
  return O.isSome(second) && Str.Equivalence(second.value, "doctor")
    ? KnowledgeCommandUnknown.make({ canonicalPath: ["goals", "doctor"] })
    : probeCommand(words);
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
    commandTree: KnowledgeCommandSurface.decodeCurrentCommandTree(options.commandTree ?? DEFAULT_COMMAND_TREE),
    currentCommandTree: KnowledgeCommandSurface.decodeCurrentCommandTree(
      options.currentCommandTree ?? DEFAULT_COMMAND_TREE
    ),
    trackedEntries: entries,
    readBytes: (repoPath) =>
      O.match(R.get(files, repoPath), {
        onNone: () =>
          Effect.fail(KnowledgeOperationalError.make({ message: `Fixture is missing tracked bytes for ${repoPath}.` })),
        onSome: (text) => Effect.succeed(textEncoder.encode(text)),
      }),
    probeCommands: (commands) => Effect.succeed(A.map(commands, options.commandProbe ?? probeCommand)),
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
    readonly gitRefNames?: ReadonlyArray<string>;
    readonly head?: OracleOptions;
    readonly probePolicy?: KnowledgeProbePolicy;
    readonly renames?: ReadonlyArray<KnowledgeRename>;
  } = {}
): KnowledgePairedOracleInput => ({
  base: makeOracle(baseFiles, options.base),
  gitRefNames: HashSet.fromIterable(options.gitRefNames ?? []),
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
    message: "Current-checkout probe executed against archive data under a skipped probe policy.",
  });
  return {
    ...makeOracle(sourceFiles, options),
    probeCommands: () => Effect.fail(unreachable),
    indexBytes: Effect.fail(unreachable),
  };
};

/**
 * A representative current-checkout probe boot failure. The blank line is part of Bun's own output,
 * so the excerpt carried into the report is exercised against the shape it actually has to survive.
 */
const BOOT_FAILURE = KnowledgeProbeBootError.make({
  message: A.join(
    [
      '\u001B[31mCurrent-checkout probe against archive data "/tmp/beep-knowledge-semantic-delta-8YSRkf/base-scratch/command-probe.ts" failed with exit 1.\u001B[0m',
      "SyntaxError:\u0001 Export named 'DEFAULT_AI_METRICS_DATA_ROOT' not found in module '/repo/packages/tooling/library/ai-metrics/src/index.ts'.",
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
  it.effect("treats retired deterministic projections as virtual targets and skips index drift", () =>
    Effect.gen(function* () {
      const files = {
        "docs/guide.md": "Use `goals/INDEX.md` and `explorations/ATLAS.md`.\n",
      };
      const head = makeOracle(files, {
        indexExpected: "# Goals Index\nnew projection\n",
        indexArchived: "# Goals Index\nold projection\n",
      });
      const report = yield* scan({
        base: makeOracle(files),
        gitRefNames: NO_GIT_REFS,
        head: {
          ...head,
          trackedEntries: A.filter(head.trackedEntries, (entry) => entry.path !== "goals/INDEX.md"),
          indexBytes: Effect.die("an untracked projection must not be probed for drift"),
        },
        probePolicy: "enabled",
        renames: [],
      });

      expect(report.introduced).toEqual([]);
      expect(report.resolved).toEqual([]);
      expect(report.unchanged).toEqual([]);
    })
  );

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

  it.effect("an unchanged documented command removed from the current surface is introduced", () =>
    Effect.gen(function* () {
      const guide = { "docs/guide.md": "Run `bun run beep goals doctor`.\n" };
      const report = yield* scan(
        fixture(guide, guide, {
          head: {
            commandTree: COMMAND_TREE_WITHOUT_DOCTOR,
            currentCommandTree: COMMAND_TREE_WITHOUT_DOCTOR,
            commandProbe: probeCommandWithoutDoctor,
          },
        })
      );

      assert.deepEqual(introducedIds(report), [
        yield* expectedId("unknown-beep-command", "base:docs/guide.md", "beep-command:goals doctor"),
      ]);
      assert.deepEqual(report.resolved, []);
      assert.deepEqual(report.unchanged, []);
    })
  );

  it.effect("a pre-existing documented typo remains unchanged when a real command is removed", () =>
    Effect.gen(function* () {
      const guide = { "docs/guide.md": "Run `bun run beep goals doctro`.\n" };
      const report = yield* scan(
        fixture(guide, guide, {
          head: {
            commandTree: COMMAND_TREE_WITHOUT_DOCTOR,
            currentCommandTree: COMMAND_TREE_WITHOUT_DOCTOR,
            commandProbe: probeCommandWithoutDoctor,
          },
        })
      );

      assert.deepEqual(report.introduced, []);
      assert.deepEqual(unchangedIds(report), [
        yield* expectedId("unknown-beep-command", "base:docs/guide.md", "beep-command:goals doctro"),
      ]);
    })
  );

  it.effect("coordinated command and documentation retirement does not invent a HEAD finding", () =>
    Effect.gen(function* () {
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "Run `bun run beep goals doctor`.\n" },
          { "docs/guide.md": "The retired command is no longer documented.\n" },
          {
            head: {
              commandTree: COMMAND_TREE_WITHOUT_DOCTOR,
              currentCommandTree: COMMAND_TREE_WITHOUT_DOCTOR,
              commandProbe: probeCommandWithoutDoctor,
            },
          }
        )
      );

      assert.deepEqual(report.introduced, []);
      assert.deepEqual(report.resolved, []);
      assert.deepEqual(report.unchanged, []);
    })
  );

  it.effect("fails operationally when the HEAD static tree diverges from the current live tree", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        scan(
          fixture(
            { "docs/guide.md": "Nothing cited.\n" },
            { "docs/guide.md": "Nothing cited.\n" },
            { head: { commandTree: COMMAND_TREE_WITHOUT_DOCTOR } }
          )
        )
      );

      assert.strictEqual(error._tag, "KnowledgeOperationalError");
      assert.strictEqual(
        error.message,
        "Static command surface provenance does not match the current-checkout command tree."
      );
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

  it.effect("a real Git ref span is exempt while a genuinely missing path remains", () =>
    Effect.gen(function* () {
      const branchName = "goals/time-to-certainty-kickoff";
      const report = yield* scan(
        fixture(
          { "docs/guide.md": "No references.\n" },
          {
            "docs/guide.md": `Continue branch \`${branchName}\`; repair \`goals/genuinely-missing.md\`.\n`,
          },
          { gitRefNames: [branchName] }
        )
      );

      expect(introducedIds(report)).toEqual([
        yield* expectedId("broken-tracked-path", "base:docs/guide.md", "repo-path:goals/genuinely-missing.md"),
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

  it.effect("sanitizes archive-derived public fields without changing their raw identity preimage", () =>
    Effect.gen(function* () {
      const hostilePath = "docs/\u001B[31mguide.md";
      const hostileCommand = "\u001B[31mevil\u202E";
      const report = yield* scan(
        fixture({ [hostilePath]: "No command.\n" }, { [hostilePath]: `Run \`bun run beep ${hostileCommand}\`.\n` })
      );
      const introduced = A.head(report.introduced);
      assert.isTrue(O.isSome(introduced));
      if (O.isSome(introduced)) {
        const finding = introduced.value;
        assert.strictEqual(
          finding.findingId,
          yield* expectedId("unknown-beep-command", `base:${hostilePath}`, `beep-command:${hostileCommand}`)
        );
        assert.strictEqual(finding.documentId, "base:docs/guide.md");
        assert.strictEqual(finding.subject, "beep-command:evil");
        assert.strictEqual(finding.location.path, "docs/guide.md");
        assert.strictEqual(finding.message, "Unknown beep command path: evil.");
      }

      const json = yield* encodeKnowledgeSemanticDeltaReportJson(report);
      const human = renderKnowledgeSemanticDeltaHumanReport(report);
      assert.notInclude(json, "\\u001b");
      assert.notInclude(json, "\\u202e");
      assert.notInclude(json, "\u202E");
      assert.notInclude(human, "\u001B");
      assert.notInclude(human, "\u202E");
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

  it.effect("a skipped comparison declines to run current-checkout probes against archive data", () =>
    Effect.gen(function* () {
      const service = yield* KnowledgeService;
      const input = (probePolicy: KnowledgeProbePolicy): KnowledgePairedOracleInput => ({
        base: explodingProbeOracle({ "docs/guide.md": "Nothing cited.\n" }),
        gitRefNames: NO_GIT_REFS,
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

describe("knowledge semantic-delta current-checkout probes", () => {
  const ROOT_MODULE_PATH = "packages/tooling/tool/cli/src/commands/Root.ts";
  const PORTFOLIO_MODULE_PATH = "packages/tooling/tool/cli/src/commands/Goals/PortfolioIndex.ts";
  const ROOT_MARKER = "archive-root-module-executed";
  const PORTFOLIO_MARKER = "archive-portfolio-module-executed";
  const POSIX_PATH_PUNCTUATION_DELIMITERS: ReadonlyArray<readonly [string, string]> = [
    ["!", "bang"],
    ['"', "double-quote"],
    ["#", "hash"],
    ["$", "dollar"],
    ["%", "percent"],
    ["&", "ampersand"],
    ["'", "single-quote"],
    ["(", "left-paren"],
    [")", "right-paren"],
    ["*", "asterisk"],
    ["+", "plus"],
    [",", "comma"],
    ["-", "hyphen"],
    [".", "period"],
    [":", "colon"],
    [";", "semicolon"],
    ["<", "left-angle"],
    ["=", "equals"],
    [">", "right-angle"],
    ["?", "question"],
    ["@", "at"],
    ["[", "left-bracket"],
    ["\\", "backslash"],
    ["]", "right-bracket"],
    ["^", "caret"],
    ["`", "backtick"],
    ["{", "left-brace"],
    ["|", "pipe"],
    ["}", "right-brace"],
    ["~", "tilde"],
  ];

  const makeProbeRuntime = Effect.fn("KnowledgeTest.makeProbeRuntime")(function* (
    root: string,
    stdout: string,
    stderr: string,
    exitCode = 0
  ) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const runtimePath = path.join(root, "probe-runtime.sh");
    const stdoutPath = path.join(root, "probe-stdout");
    const stderrPath = path.join(root, "probe-stderr");
    yield* fs.writeFileString(stdoutPath, stdout);
    yield* fs.writeFileString(stderrPath, stderr);
    yield* fs.writeFileString(
      runtimePath,
      A.join(
        ["#!/bin/sh", `/usr/bin/cat "${stdoutPath}"`, `/usr/bin/cat "${stderrPath}" >&2`, `exit ${exitCode}`, ""],
        "\n"
      )
    );
    yield* fs.chmod(runtimePath, 0o755);
    return runtimePath;
  });

  const makeProbeHarness = Effect.fn("KnowledgeTest.makeProbeHarness")(function* (
    runtimeStdout: string,
    runtimeStderr: string,
    runtimeExitCode = 0
  ) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-probe-diagnostic-" });
    const currentCheckoutRoot = path.join(tempRoot, "current-checkout");
    const archiveRoot = path.join(tempRoot, "archive-data");
    const scratchRoot = path.join(tempRoot, "scratch");
    yield* fs.makeDirectory(path.join(currentCheckoutRoot, "node_modules"), { recursive: true });
    yield* fs.makeDirectory(archiveRoot, { recursive: true });
    const runtimeExecutable = yield* makeProbeRuntime(tempRoot, runtimeStdout, runtimeStderr, runtimeExitCode);
    const oracle = yield* makeKnowledgeArchiveOracle(
      currentCheckoutRoot,
      archiveRoot,
      scratchRoot,
      [],
      runtimeExecutable
    );
    return { archiveRoot, currentCheckoutRoot, oracle, scratchRoot } as const;
  });

  it.effect("derives the current command surface statically with exact live structural parity", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const processSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const currentCheckoutRoot = yield* findRepoRoot();
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-command-surface-" });
        const scratchRoot = path.join(tempRoot, "scratch");
        const bunExecutable = yield* processSpawner
          .string(ChildProcess.make("which", ["bun"], { extendEnv: true }))
          .pipe(Effect.map(Str.trim));
        const oracle = yield* makeKnowledgeArchiveOracle(
          currentCheckoutRoot,
          currentCheckoutRoot,
          scratchRoot,
          [],
          bunExecutable
        );
        const [staticTree, liveTree] = yield* Effect.all([oracle.commandTree, oracle.currentCommandTree]);

        assert.isTrue(KnowledgeCommandSurface.staticCommandNodeEquivalent(staticTree, liveTree));
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("fails closed without leaking hostile archive source through parser diagnostics", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-hostile-surface-" });
        const rootModule = path.join(tempRoot, ROOT_MODULE_PATH);
        const markerPath = path.join(tempRoot, "archive-surface-module-executed");
        const encodedMarkerPath = yield* encodeJsonString(markerPath);
        yield* fs.makeDirectory(path.dirname(rootModule), { recursive: true });
        yield* fs.writeFileString(
          rootModule,
          [
            'import { Command } from "effect/unstable/cli"',
            `await Bun.write(${encodedMarkerPath}, "executed")`,
            "const chooseArchiveCode = true",
            'export const rootCommand = chooseArchiveCode ? Command.make("safe") : Command.make("evil\\u001B[31m\\u202E")',
            "",
          ].join("\n")
        );

        const error = yield* Effect.flip(KnowledgeCommandSurface.buildStaticCommandTree(tempRoot));

        assert.strictEqual(error._tag, "KnowledgeOperationalError");
        assert.include(error.message, "Failed to statically derive command surface provenance");
        assert.notInclude(error.message, tempRoot);
        assert.notInclude(error.message, "\u001B");
        assert.notInclude(error.message, "\u202E");
        assert.isFalse(yield* fs.exists(markerPath));
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("preserves ordered list expansion and last-wins aliases across trusted import forms", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-ordered-surface-" });
        const rootModule = path.join(tempRoot, ROOT_MODULE_PATH);
        yield* fs.makeDirectory(path.dirname(rootModule), { recursive: true });
        yield* fs.writeFileString(
          rootModule,
          [
            'import { A } from "@beep/utils"',
            'import * as Command from "effect/unstable/cli"',
            'const first = Command.make("first").pipe(Command.withAlias("f"), Command.withAlias("final"))',
            'const second = Command.make("second")',
            "const leading = [first]",
            "const trailing = A.make(second)",
            'export const rootCommand = Command.make("beep-cli").pipe(',
            "  Command.withSubcommands([...leading, ...trailing]),",
            ")",
            "",
          ].join("\n")
        );

        const tree = yield* KnowledgeCommandSurface.buildStaticCommandTree(tempRoot);

        assert.deepEqual(KnowledgeCommandSurface.resolveStaticCommand(tree, ["final"]), ["resolved", ["first"]]);
        assert.deepEqual(KnowledgeCommandSurface.resolveStaticCommand(tree, ["f"]), ["unknown", ["f"]]);
        assert.deepEqual(KnowledgeCommandSurface.resolveStaticCommand(tree, ["second"]), ["resolved", ["second"]]);
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("fails closed for hostile command-surface syntax and ambiguous sibling spellings", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-hostile-surface-table-" });
        const cases = [
          {
            name: "shadowed-command",
            source: [
              "const Command = { make: (name: string) => ({ name }) }",
              'export const rootCommand = Command.make("beep-cli")',
            ],
          },
          {
            name: "shadowed-array",
            source: [
              'import { Command } from "effect/unstable/cli"',
              "const A = { make: (...values: unknown[]) => values }",
              'const child = Command.make("child")',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands(A.make(child)))',
            ],
          },
          {
            name: "unknown-transform",
            source: [
              'import { Command } from "effect/unstable/cli"',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSharedFlags([]))',
            ],
          },
          {
            name: "omitted-list",
            source: [
              'import { Command } from "effect/unstable/cli"',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([,]))',
            ],
          },
          {
            name: "dynamic-list",
            source: [
              'import { Command } from "effect/unstable/cli"',
              'const commands = true ? [Command.make("first")] : [Command.make("second")]',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands(commands))',
            ],
          },
          {
            name: "name-alias-collision",
            source: [
              'import { Command } from "effect/unstable/cli"',
              'const first = Command.make("first").pipe(Command.withAlias("shared"))',
              'const second = Command.make("shared")',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([first, second]))',
            ],
          },
          {
            name: "duplicate-alias",
            source: [
              'import { Command } from "effect/unstable/cli"',
              'const first = Command.make("first").pipe(Command.withAlias("shared"))',
              'const second = Command.make("second").pipe(Command.withAlias("shared"))',
              'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([first, second]))',
            ],
          },
          {
            name: "multiple-return-factory",
            source: [
              'import { Command } from "effect/unstable/cli"',
              'const makeCommand = (name: string) => { if (name) return Command.make(name); return Command.make("other") }',
              'export const rootCommand = makeCommand("beep-cli")',
            ],
          },
        ];
        for (const fixture of cases) {
          const fixtureRoot = path.join(tempRoot, fixture.name);
          const rootModule = path.join(fixtureRoot, ROOT_MODULE_PATH);
          yield* fs.makeDirectory(path.dirname(rootModule), { recursive: true });
          yield* fs.writeFileString(rootModule, [...fixture.source, ""].join("\n"));

          const error = yield* Effect.flip(KnowledgeCommandSurface.buildStaticCommandTree(fixtureRoot));
          assert.strictEqual(error._tag, "KnowledgeOperationalError", fixture.name);
          assert.include(error.message, "Failed to statically derive command surface provenance", fixture.name);
        }
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("fails promptly on recursive command factories and recursive command lists", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-recursive-surface-" });
        const factoryRoot = path.join(tempRoot, "factory", ROOT_MODULE_PATH);
        const listRoot = path.join(tempRoot, "list", ROOT_MODULE_PATH);
        yield* fs.makeDirectory(path.dirname(factoryRoot), { recursive: true });
        yield* fs.makeDirectory(path.dirname(listRoot), { recursive: true });
        yield* fs.writeFileString(
          factoryRoot,
          [
            'import { Command } from "effect/unstable/cli"',
            "const recursive = (name: string) => recursive(name)",
            'export const rootCommand = recursive("beep-cli")',
            "",
          ].join("\n")
        );
        yield* fs.writeFileString(
          listRoot,
          [
            'import { Command } from "effect/unstable/cli"',
            "const commands = [...commands]",
            'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands(commands))',
            "",
          ].join("\n")
        );

        const [factoryError, listError] = yield* Effect.all([
          Effect.flip(KnowledgeCommandSurface.buildStaticCommandTree(path.join(tempRoot, "factory"))),
          Effect.flip(KnowledgeCommandSurface.buildStaticCommandTree(path.join(tempRoot, "list"))),
        ]);

        assert.strictEqual(factoryError._tag, "KnowledgeOperationalError");
        assert.include(factoryError.message, "factory declarations contain a cycle");
        assert.strictEqual(listError._tag, "KnowledgeOperationalError");
        assert.include(listError.message, "list declarations contain a cycle");
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("uses a scratch-owned empty env file instead of an archive-local dotenv file", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const processSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const repoRoot = yield* findRepoRoot();
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-hostile-dotenv-" });
        const currentCheckoutRoot = path.join(tempRoot, "current-checkout");
        const archiveRoot = path.join(tempRoot, "archive-data");
        const scratchRoot = path.join(tempRoot, "scratch");
        const rootModule = path.join(currentCheckoutRoot, ROOT_MODULE_PATH);
        const markerPath = path.join(tempRoot, "archive-dotenv-executed");
        const encodedMarkerPath = yield* encodeJsonString(markerPath);
        yield* fs.makeDirectory(path.dirname(rootModule), { recursive: true });
        yield* fs.makeDirectory(archiveRoot, { recursive: true });
        yield* fs.symlink(path.join(repoRoot, "node_modules"), path.join(currentCheckoutRoot, "node_modules"));
        yield* fs.writeFileString(
          rootModule,
          [
            'import { Command } from "effect/unstable/cli"',
            `if (process.env.ARCHIVE_DOTENV_SENTINEL === "loaded") await Bun.write(${encodedMarkerPath}, "executed")`,
            'const doctor = Command.make("doctor")',
            'const goals = Command.make("goals").pipe(Command.withSubcommands([doctor]))',
            'export const rootCommand = Command.make("beep-cli").pipe(Command.withSubcommands([goals]))',
            "",
          ].join("\n")
        );
        yield* fs.writeFileString(path.join(archiveRoot, ".env"), "ARCHIVE_DOTENV_SENTINEL=loaded\n");
        const bunExecutable = yield* processSpawner
          .string(ChildProcess.make("which", ["bun"], { extendEnv: true }))
          .pipe(Effect.map(Str.trim));
        const oracle = yield* makeKnowledgeArchiveOracle(
          currentCheckoutRoot,
          archiveRoot,
          scratchRoot,
          [],
          bunExecutable
        );

        const tree = yield* oracle.currentCommandTree;
        assert.deepEqual(KnowledgeCommandSurface.resolveStaticCommand(tree, ["goals", "doctor"]), [
          "resolved",
          ["goals", "doctor"],
        ]);
        assert.strictEqual(yield* fs.readFileString(path.join(scratchRoot, "empty.env")), "");
        assert.isFalse(yield* fs.exists(markerPath));
        assert.isFalse(yield* fs.exists(path.join(archiveRoot, "command-tree-probe.ts")));
        assert.isFalse(yield* fs.exists(path.join(archiveRoot, "empty.env")));
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("treats archived command modules and runtime configuration as data, never code", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-current-probe-" });
        const currentCheckoutRoot = yield* findRepoRoot();
        const processSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const bunExecutable = yield* processSpawner
          .string(ChildProcess.make("which", ["bun"], { extendEnv: true }))
          .pipe(Effect.map(Str.trim));
        const archiveRoot = path.join(tempRoot, "archive");
        const scratchRoot = path.join(tempRoot, "scratch");
        const rootModule = path.join(archiveRoot, ROOT_MODULE_PATH);
        const portfolioModule = path.join(archiveRoot, PORTFOLIO_MODULE_PATH);
        const indexPath = path.join(archiveRoot, "goals", "INDEX.md");

        yield* fs.makeDirectory(path.dirname(rootModule), { recursive: true });
        yield* fs.makeDirectory(path.dirname(portfolioModule), { recursive: true });
        yield* fs.makeDirectory(path.dirname(indexPath), { recursive: true });
        yield* fs.writeFileString(
          rootModule,
          `await Bun.write("${ROOT_MARKER}", "executed")\nexport const rootCommand = undefined\n`
        );
        yield* fs.writeFileString(
          portfolioModule,
          `await Bun.write("${PORTFOLIO_MARKER}", "executed")\nexport const buildPortfolioIndexContent = undefined\n`
        );
        yield* fs.writeFileString(
          path.join(archiveRoot, "bunfig.toml"),
          `[run]\npreload = ["./${ROOT_MODULE_PATH}", "./${PORTFOLIO_MODULE_PATH}"]\n`
        );
        yield* fs.writeFileString(indexPath, DEFAULT_INDEX);

        const oracle = yield* makeKnowledgeArchiveOracle(
          currentCheckoutRoot,
          archiveRoot,
          scratchRoot,
          [
            KnowledgeTrackedEntry.make({
              path: "goals/INDEX.md",
              mode: "100644",
              objectId: "fixture:index",
            }),
          ],
          bunExecutable
        );
        const rootOnlyCommand = yield* oracle.probeCommands([[]]);
        const commands = yield* oracle.probeCommands([[], ["goals", "doctor"], ["goals", "doctro"]]);
        const index = yield* oracle.indexBytes;
        const expectedIndex = yield* decodeKnowledgeUtf8(
          index.expected,
          "Current-checkout index probe emitted malformed UTF-8."
        );
        const archivedIndex = yield* decodeKnowledgeUtf8(
          index.archived,
          "Archived index fixture emitted malformed UTF-8."
        );

        assert.deepEqual(rootOnlyCommand, [resolvedCommand([])]);
        assert.deepEqual(commands, [
          resolvedCommand([]),
          resolvedCommand(["goals", "doctor"]),
          KnowledgeCommandUnknown.make({ canonicalPath: ["goals", "doctro"] }),
        ]);
        assert.include(expectedIndex, "# Goals Index");
        assert.strictEqual(archivedIndex, DEFAULT_INDEX);
        assert.isFalse(yield* fs.exists(path.join(archiveRoot, ROOT_MARKER)));
        assert.isFalse(yield* fs.exists(path.join(archiveRoot, PORTFOLIO_MARKER)));
        assert.isFalse(yield* fs.exists(path.join(archiveRoot, "node_modules")));
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("reports malformed command output with labeled sanitized stderr and expected counts", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* makeProbeHarness(
          "resolved\tgoals\tdoctor\nextra",
          "\u001B[31mwarning\u001B[0m at /home/operator/private/runtime.ts\u0001"
        );
        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));

        assert.strictEqual(error._tag, "KnowledgeOperationalError");
        assert.include(error.message, "expected 1 line(s), received 2");
        assert.include(error.message, "stdout:");
        assert.include(error.message, "stderr:");
        assert.include(error.message, "warning at <absolute-path>");
        assert.notInclude(error.message, "/home/operator");
        assert.notInclude(error.message, "\u001B");
        assert.notInclude(error.message, "\u0001");
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("reports unknown command statuses with bounded labeled stderr", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* makeProbeHarness("unsupported\tgoals\tdoctor", Str.repeat(3_000)("x"));
        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));

        assert.strictEqual(error._tag, "KnowledgeOperationalError");
        assert.include(error.message, "unknown status");
        assert.include(error.message, "expected 1 recognized line(s), received 1");
        assert.include(error.message, "stderr:");
        assert.isAtMost(Str.length(error.message), 2_500);
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("rejects truncated command and index output even when the probe exits zero", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* makeProbeHarness(Str.repeat(1_100_000)("x"), "");
        const commandError = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));
        const indexError = yield* Effect.flip(harness.oracle.indexBytes);

        assert.strictEqual(commandError._tag, "KnowledgeOperationalError");
        assert.include(commandError.message, "command probe emitted more than 1048576 characters");
        assert.include(commandError.message, "refusing to parse truncated structured output");
        assert.include(commandError.message, "capture: truncated");
        assert.strictEqual(indexError._tag, "KnowledgeOperationalError");
        assert.include(indexError.message, "index probe emitted more than 1048576 characters");
        assert.include(indexError.message, "refusing to parse truncated structured output");
        assert.include(indexError.message, "capture: truncated");
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("redacts checkout archive scratch and arbitrary absolute paths from boot failures", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const harness = yield* makeProbeHarness(
          "unsafe stdout from /home/operator/private/stdout.ts",
          "\u001B[31mSyntaxError\u001B[0m in /home/operator/private/stderr.ts\u0001\r\nsecond\rspoof at /secret and C:\\secret and /home/üser/prójects/tökens.ts:3:7 plus /données/été near /var/💼client-secret/config.ts:3:7 (see https://example.com/keep-this-path)",
          1
        );
        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));

        assert.strictEqual(error._tag, "KnowledgeProbeBootError");
        assert.include(error.message, "Current-checkout command probe against archive data failed with exit 1");
        assert.include(error.message, "stdout:");
        assert.include(error.message, "stderr:");
        assert.notInclude(error.message, harness.currentCheckoutRoot);
        assert.notInclude(error.message, harness.archiveRoot);
        assert.notInclude(error.message, harness.scratchRoot);
        assert.notInclude(error.message, "/home/operator");
        assert.notInclude(error.message, "/secret");
        assert.notInclude(error.message, "C:\\secret");
        // Non-ASCII, emoji, and punctuation segments must be swallowed by the same redaction, tail
        // and line:col included — an enumerated segment class used to stop at the first character
        // outside it and leak `üser/prójects/tökens.ts:3:7` or `💼client-secret/config.ts`.
        assert.notInclude(error.message, "üser");
        assert.notInclude(error.message, "prójects");
        assert.notInclude(error.message, "tökens");
        assert.notInclude(error.message, "3:7");
        assert.notInclude(error.message, "données");
        assert.notInclude(error.message, "été");
        assert.notInclude(error.message, "💼");
        assert.notInclude(error.message, "client-secret");
        // URLs are not filesystem paths: the redaction must leave them legible.
        assert.include(error.message, "https://example.com/keep-this-path");
        assert.include(error.message, "secondspoof");
        assert.notInclude(error.message, "\r");
        assert.notInclude(error.message, "\u001B");
        assert.notInclude(error.message, "\u0001");
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("redacts absolute POSIX paths after the punctuation delimiter table", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const stderr = A.join(
          A.map(
            POSIX_PATH_PUNCTUATION_DELIMITERS,
            ([delimiter, label]) => `${delimiter}/private/${label}/secret.ts:3:7`
          ),
          "\n"
        );
        const harness = yield* makeProbeHarness("", stderr, 1);
        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));

        for (const [delimiter, label] of POSIX_PATH_PUNCTUATION_DELIMITERS) {
          assert.include(error.message, `${delimiter}<absolute-path>`, label);
          assert.notInclude(error.message, `/private/${label}`, label);
        }
      })
    ).pipe(provideScopedLayer(testLayer))
  );

  it.effect("preserves URLs and word-adjacent slash fragments", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const preserved = [
          "https://example.com/private/source.ts",
          "http://localhost:3000/private/source.ts",
          "word/private/source.ts",
          "naïve/private/source.ts",
          "字/private/source.ts",
          "7/private/source.ts",
          "under_score/private/source.ts",
        ];
        const harness = yield* makeProbeHarness("", A.join(preserved, "\n"), 1);
        const error = yield* Effect.flip(harness.oracle.probeCommands([["goals", "doctor"]]));

        for (const value of preserved) {
          assert.include(error.message, value);
        }
      })
    ).pipe(provideScopedLayer(testLayer))
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
    gitRefNames: NO_GIT_REFS,
    head: makeOracle(headFiles, headOptions),
    probePolicy: "enabled",
    renames: [],
  });

  it.effect("an unbootable base degrades probe coverage instead of failing the comparison", () =>
    Effect.gen(function* () {
      const report = yield* scan(withUnbootableBase(CLEAN_BASE, DIRTY_HEAD, HEAD_DRIFT));
      const detail = O.getOrElse(report.probeSkipDetail, () => "");

      assert.strictEqual(report.probePolicy, "skipped-base-boot-failure");
      assert.include(detail, "failed with exit 1");
      assert.include(detail, "DEFAULT_AI_METRICS_DATA_ROOT");
      assert.include(detail, "<absolute-path>");
      assert.notInclude(detail, "/tmp/beep-knowledge-semantic-delta");
      assert.notInclude(detail, "/repo/packages");
      assert.notInclude(detail, "\u001B");
      assert.notInclude(detail, "\u0001");
      // Blank output lines are dropped, so the excerpt is three lines of evidence rather than four.
      assert.strictEqual(A.length(Str.split("\n")(detail)), 3);
      // The tracked-tree classes still work; only the probe-dependent ones went missing.
      assert.deepEqual(sortedKinds(report.introduced), ["broken-tracked-path"]);
    })
  );

  it.effect("a degraded comparison with nothing else introduced does not gate the lane", () =>
    Effect.gen(function* () {
      const degraded = yield* scan(withUnbootableBase(CLEAN_BASE, CLEAN_BASE, HEAD_DRIFT));
      // Counterfactual: the same HEAD drift under a bootable base does introduce a finding and does
      // gate, so the pass above is degradation doing its job and not an empty fixture.
      const probed = yield* scan(fixture(CLEAN_BASE, CLEAN_BASE, { head: HEAD_DRIFT }));

      assert.strictEqual(degraded.probePolicy, "skipped-base-boot-failure");
      assert.deepEqual(degraded.introduced, []);
      assert.isTrue(O.isNone(knowledgeSemanticDeltaFailure(degraded)));
      assert.deepEqual(sortedKinds(probed.introduced), ["index-drift"]);
      assert.isTrue(O.isSome(knowledgeSemanticDeltaFailure(probed)));
    })
  );

  it.effect("a base boot failure discards the probe results collected before it", () =>
    Effect.gen(function* () {
      const baseFiles = { "docs/guide.md": "Run `bun run beep goals doctro`.\n" };
      // Only the index probe dies, after the command probe has already resolved an unknown command.
      const degraded = yield* scan({
        base: { ...makeOracle(baseFiles), indexBytes: Effect.fail(BOOT_FAILURE) },
        gitRefNames: NO_GIT_REFS,
        head: makeOracle(CLEAN_BASE),
        probePolicy: "enabled",
        renames: [],
      });
      // Counterfactual: a bootable base does report that command finding as resolved, so keeping the
      // half-probed base would have compared it against an unprobed HEAD.
      const probed = yield* scan(fixture(baseFiles, CLEAN_BASE));

      assert.strictEqual(degraded.probePolicy, "skipped-base-boot-failure");
      assert.deepEqual(degraded.introduced, []);
      assert.deepEqual(degraded.resolved, []);
      assert.deepEqual(degraded.unchanged, []);
      assert.deepEqual(sortedKinds(probed.resolved), ["unknown-beep-command"]);
    })
  );

  it.effect("an unbootable HEAD is still an operational failure, because HEAD is the branch's own tree", () =>
    Effect.gen(function* () {
      const service = yield* KnowledgeService;
      const error = yield* Effect.flip(
        service.scanPair({
          base: makeOracle(CLEAN_BASE),
          gitRefNames: NO_GIT_REFS,
          head: unbootableProbeOracle(DIRTY_HEAD),
          probePolicy: "enabled",
          renames: [],
        })
      );

      assert.strictEqual(error._tag, "KnowledgeOperationalError");
      assert.include(error.message, "DEFAULT_AI_METRICS_DATA_ROOT");
      assert.notInclude(error.message, "/tmp/beep-knowledge-semantic-delta");
      assert.notInclude(error.message, "/repo/packages");
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("a shared current-checkout boot failure fails operationally even when HEAD has no command spans", () =>
    Effect.gen(function* () {
      const service = yield* KnowledgeService;
      const error = yield* Effect.flip(
        service.scanPair({
          base: unbootableProbeOracle(CLEAN_BASE),
          gitRefNames: NO_GIT_REFS,
          head: unbootableProbeOracle(CLEAN_BASE),
          probePolicy: "enabled",
          renames: [],
        })
      );

      assert.strictEqual(error._tag, "KnowledgeOperationalError");
      assert.include(error.message, "DEFAULT_AI_METRICS_DATA_ROOT");
      assert.notInclude(error.message, "/tmp/beep-knowledge-semantic-delta");
      assert.notInclude(error.message, "/repo/packages");
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("a current-code failure for a base-only command fails during the HEAD preflight", () =>
    Effect.gen(function* () {
      const baseFiles = { "docs/guide.md": "Run `bun run beep legacy command`.\n" };
      const preflightFailure = KnowledgeProbeBootError.make({
        message: "Current-checkout command handler failed for the base-only legacy command.",
      });
      const head = {
        ...makeOracle(CLEAN_BASE),
        probeCommands: (commands: ReadonlyArray<ReadonlyArray<string>>) =>
          A.some(commands, (words) => A.contains(words, "legacy"))
            ? Effect.fail(preflightFailure)
            : Effect.succeed(A.map(commands, probeCommand)),
      };
      const error = yield* Effect.flip(
        scan({
          base: makeOracle(baseFiles),
          gitRefNames: NO_GIT_REFS,
          head,
          probePolicy: "enabled",
          renames: [],
        })
      );

      assert.strictEqual(error._tag, "KnowledgeOperationalError");
      assert.include(error.message, "base-only legacy command");
    })
  );

  it.effect("a failure proved specific to merge-base data still degrades after the HEAD union preflight", () =>
    Effect.gen(function* () {
      const baseFiles = { "docs/guide.md": "Run `bun run beep legacy command`.\n" };
      const report = yield* scan({
        base: unbootableProbeOracle(baseFiles),
        gitRefNames: NO_GIT_REFS,
        head: makeOracle(CLEAN_BASE),
        probePolicy: "enabled",
        renames: [],
      });

      assert.strictEqual(report.probePolicy, "skipped-base-boot-failure");
      assert.deepEqual(report.introduced, []);
    })
  );

  it.effect("an unsupported base command surface fails closed before runtime boot degradation", () =>
    Effect.gen(function* () {
      const base = {
        ...unbootableProbeOracle(CLEAN_BASE),
        commandTree: KnowledgeCommandSurface.decodeCurrentCommandTree("not-json"),
      };
      const error = yield* Effect.flip(
        scan({ base, gitRefNames: NO_GIT_REFS, head: makeOracle(CLEAN_BASE), probePolicy: "enabled", renames: [] })
      );

      assert.strictEqual(error._tag, "KnowledgeOperationalError");
      assert.include(error.message, "malformed output");
      assert.notInclude(error.message, "DEFAULT_AI_METRICS_DATA_ROOT");
    })
  );

  it.effect("the JSON report carries the degraded policy and its evidence, and omits both when clean", () =>
    Effect.gen(function* () {
      const degradedReport = yield* scan(withUnbootableBase(CLEAN_BASE, CLEAN_BASE));
      const degraded = yield* encodeKnowledgeSemanticDeltaReportJson(degradedReport);
      const human = renderKnowledgeSemanticDeltaHumanReport(degradedReport);
      const clean = yield* encodeKnowledgeSemanticDeltaReportJson(yield* scan(fixture(CLEAN_BASE, CLEAN_BASE)));

      assert.include(degraded, `"probePolicy":"skipped-base-boot-failure"`);
      assert.include(degraded, "DEFAULT_AI_METRICS_DATA_ROOT");
      assert.include(degraded, "<absolute-path>");
      assert.notInclude(degraded, "/tmp/beep-knowledge-semantic-delta");
      assert.notInclude(degraded, "/repo/packages");
      assert.notInclude(degraded, "\\u001b");
      assert.notInclude(degraded, "\\u0001");
      assert.include(human, "DEFAULT_AI_METRICS_DATA_ROOT");
      assert.include(human, "<absolute-path>");
      assert.notInclude(human, "/tmp/beep-knowledge-semantic-delta");
      assert.notInclude(human, "/repo/packages");
      assert.notInclude(human, "\u001B");
      assert.notInclude(human, "\u0001");
      assert.include(clean, `"probePolicy":"enabled"`);
      assert.notInclude(clean, "probeSkipDetail");
    })
  );

  it.effect("the degraded public detail removes bare CR and short absolute paths", () =>
    Effect.gen(function* () {
      const unsafeFailure = KnowledgeProbeBootError.make({
        message: "failure at /secret\r\nthen C:\\secret\rOVERWRITE\u202Ehidden",
      });
      const base = {
        ...makeOracle(CLEAN_BASE),
        probeCommands: () => Effect.fail(unsafeFailure),
        indexBytes: Effect.fail(unsafeFailure),
      };
      const report = yield* scan({
        base,
        gitRefNames: NO_GIT_REFS,
        head: makeOracle(CLEAN_BASE),
        probePolicy: "enabled",
        renames: [],
      });
      const json = yield* encodeKnowledgeSemanticDeltaReportJson(report);
      const human = renderKnowledgeSemanticDeltaHumanReport(report);

      assert.strictEqual(report.probePolicy, "skipped-base-boot-failure");
      assert.notInclude(json, "/secret");
      assert.notInclude(json, "C:\\\\secret");
      assert.notInclude(json, "\\r");
      assert.notInclude(json, "\u202E");
      assert.include(json, "<absolute-path>");
      assert.notInclude(human, "/secret");
      assert.notInclude(human, "C:\\secret");
      assert.notInclude(human, "\r");
      assert.notInclude(human, "\u202E");
      assert.include(human, "<absolute-path>");
    })
  );
});

// The clone-local info/attributes file is the one attribute layer no git invocation can disable
// (research/p3-hermetic-lane-decisions.md "Measured residual"). The GitExec primitive's states are
// pinned in step-git-exec.test.ts; this block pins the service wiring — the typed errors both
// tree-materializing entry points surface through guardKnowledgeCloneAttributes.
describe("knowledge clone-local attributes guard", () => {
  const runGit = (cwd: string, args: ReadonlyArray<string>, env: Record<string, string>): void => {
    const result = Bun.spawnSync(["git", ...args], { cwd, env, stderr: "pipe", stdout: "pipe" });
    if (result.exitCode !== 0) {
      throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
    }
  };

  it.effect("passes while the clone-local attributes file is absent or empty and fails closed once non-empty", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const tempRoot = yield* fs.makeTempDirectoryScoped({ prefix: "knowledge-clone-attributes-" });
      const repoDir = path.join(tempRoot, "repo");
      const home = path.join(tempRoot, "home");
      yield* fs.makeDirectory(repoDir, { recursive: true });
      yield* fs.makeDirectory(home, { recursive: true });
      const env = {
        PATH: Bun.env.PATH ?? "",
        HOME: home,
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_NOSYSTEM: "1",
      };
      yield* Effect.sync(() => runGit(repoDir, ["init", "-b", "main"], env));

      yield* guardKnowledgeCloneAttributes(repoDir);
      const attributesPath = path.join(repoDir, ".git", "info", "attributes");
      yield* fs.writeFileString(attributesPath, "");
      yield* guardKnowledgeCloneAttributes(repoDir);

      yield* fs.writeFileString(attributesPath, "*.md eol=crlf\n");
      const failure = yield* Effect.flip(guardKnowledgeCloneAttributes(repoDir));
      assert.strictEqual(failure._tag, "KnowledgeCloneAttributesError");
      if (failure._tag === "KnowledgeCloneAttributesError") {
        assert.strictEqual(failure.attributesPath, attributesPath);
        assert.include(failure.message, attributesPath);
      }
    }).pipe(provideScopedLayer(testLayer))
  );

  it.effect("runs the guard on the live semantic-delta path before failing typed on an unresolvable base ref", () =>
    Effect.gen(function* () {
      const knowledge = yield* KnowledgeService;
      const failure = yield* Effect.flip(knowledge.semanticDelta("refs/beep/definitely-missing-base"));
      assert.strictEqual(failure._tag, "KnowledgeOperationalError");
      assert.include(failure.message, "fetch-depth: 0");
    }).pipe(provideScopedLayer(testLayer))
  );
});
