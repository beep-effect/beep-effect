import {
  KnowledgeCommandResolved,
  KnowledgeCommandUnknown,
  KnowledgeIndexBytes,
  KnowledgeOperationalError,
  KnowledgeRename,
  KnowledgeService,
  KnowledgeServiceLive,
  KnowledgeTrackedEntry,
} from "@beep/repo-cli/commands/Knowledge";
import { NonNegativeInt } from "@beep/schema";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Crypto, Effect, Encoding, Layer } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import type {
  KnowledgeArchiveOracle,
  KnowledgeFindingKind,
  KnowledgePairedOracleInput,
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
    readonly renames?: ReadonlyArray<KnowledgeRename>;
  } = {}
): KnowledgePairedOracleInput => ({
  base: makeOracle(baseFiles, options.base),
  head: makeOracle(headFiles, options.head),
  renames: options.renames ?? [],
});

const independentDigestEffect = Effect.fn("KnowledgeTest.independentDigest")(function* (text: string) {
  const crypto = yield* Crypto.Crypto;
  const digest = yield* crypto.digest("SHA-256", textEncoder.encode(text));
  return Encoding.encodeHex(digest);
});

const independentDigest = (text: string): Effect.Effect<string> =>
  independentDigestEffect(text).pipe(provideScopedLayer(NodeCrypto.layer));

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
