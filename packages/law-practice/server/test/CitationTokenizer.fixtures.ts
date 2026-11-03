/** Shared pinned-source tokenizer composition and real process setup.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationOperationAdmission,
  makeCitationOperationAdmission,
} from "@beep/law-practice-server/internal/Citation/Admission";
import { CitationExtractorOrderingBinding } from "@beep/law-practice-server/internal/Citation/ExtractorOrdering";
import { makeCitationRegexInput } from "@beep/law-practice-server/internal/Citation/RegexInput";
import {
  CitationTokenizerExtractor,
  makeCitationTokenizer,
} from "@beep/law-practice-server/internal/Citation/Tokenizer";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import * as BunChildProcessSpawner from "@effect/platform-bun/BunChildProcessSpawner";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Digest from "effect/crypto/Digest";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import {
  makeCitationNativeManualClock,
  makeCitationNodeTestRuntime,
  makeCitationObservedSpawner,
} from "./CitationNativeSpawner.fixtures.ts";
import { CitationTokenSeedHex } from "./CitationTokenSeed.fixtures.ts";

const $I = $LawPracticeServerId.create("test/CitationTokenizer");
const Native = S.Struct({ width: S.Literals([1, 2, 4]), bytes: S.Uint8ArrayFromHex });
const Extractor = S.Struct({
  ...CitationTokenizerExtractor.fields,
  pattern: Native,
  ordering: S.Struct({
    ...CitationExtractorOrderingBinding.fields,
    hash: S.BigIntFromString,
    strings: S.Array(Native),
  }),
});
const Item = S.Union([
  S.Struct({ kind: S.tag("Text"), data: Native }),
  S.Struct({ kind: S.tag("Token"), id: S.Natural }),
]);
const ItemType = S.toType(Item);
const Overrides = S.Record(S.String, S.Unknown);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-tokenizer-composition/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
    python: S.tag("3.11.15"),
    hashSeed: S.tag("0"),
    producerSha256: S.tag("a80fb747b64ec2b4835e61742c82e2323dd51524acf8620ff0382e236bc417d1"),
    configuration: S.Struct({
      extractors: S.Array(Extractor).check(S.isBetweenLength(7, 7)),
      editions: S.Array(S.Never).check(S.isMaxLength(0)),
    }),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: Native,
        selected: S.Array(S.Natural),
        candidates: S.Natural,
        items: S.Array(Item),
        citations: S.Array(S.Tuple([S.Natural, S.Natural])),
        tokens: S.Array(S.Struct({ id: S.Natural, seed: CitationTokenSeedHex })),
      })
    ).check(S.isBetweenLength(20, 20)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual source selection/construction/assembly across seven controlled built-in extractors.",
  })
);
const dependencies = Layer.merge(BunFileSystem.layer, Path.layer);
/** Only filesystem, path, spawner and digest; no ambient runtime bundle.
 * @internal @category testing @since 0.0.0
 */
export const citationTokenizerTestLayer = Layer.mergeAll(
  dependencies,
  BunChildProcessSpawner.layer.pipe(Layer.provide(dependencies)),
  BunCrypto.layerDigest
);
/** @internal @category testing @since 0.0.0 */
export const loadCitationTokenizerControls = Effect.fn("TokenizerTest.load")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const bytes = yield* fs.readFile(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/tokenizer-composition.json", import.meta.url))
  );
  const hash = yield* digest.digestHex(Digest.sha256, bytes);
  expect(hash).toBe("35cdbf03cfccfd839f2119d658ac42c237f9cf720a02961ade8a2fb27c1163bf");
  return yield* S.decodeEffect(Corpus)(new TextDecoder().decode(bytes));
});
/** @internal @category testing @since 0.0.0 */
export const setupCitationTokenizer = Effect.fn("TokenizerTest.setup")(function* (
  kind: "bun" | "node",
  configuration: unknown,
  overrides: unknown = {}
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = {
    ...base,
    regexDeadline: Duration.millis(997),
    extractDeadline: Duration.seconds(30),
    operationDeadline: Duration.seconds(60),
    ...(yield* S.decodeUnknownEffect(Overrides)(overrides)),
  };
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-tokenizer-" });
  const runtime =
    kind === "node"
      ? yield* makeCitationNodeTestRuntime(
          NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.node.entry.ts", import.meta.url)),
          cwd
        )
      : {
          kind: "bun",
          executable: process.execPath,
          cwd,
          workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/RegexWorker.entry.ts", import.meta.url)),
        };
  const admission = yield* makeCitationOperationAdmission(limits);
  const observed = yield* makeCitationObservedSpawner();
  const timer = yield* makeCitationNativeManualClock(limits.regexDeadline);
  const tokenizer = yield* makeCitationTokenizer(limits, runtime, configuration).pipe(
    Effect.provideService(CitationOperationAdmission, admission),
    Effect.provideService(Clock.Clock, timer.clock),
    Effect.provideService(ChildProcessSpawner, observed.spawner)
  );
  return { tokenizer, admission, observed, limits };
});
/** @internal @category testing @since 0.0.0 */
export const assertCitationTokenizerCase = Effect.fn("TokenizerTest.case")(function* (
  setup: Effect.Success<ReturnType<typeof setupCitationTokenizer>>,
  row: (typeof Corpus.Type.cases)[number]
) {
  const output = yield* setup.tokenizer.run(row.source);
  const prepare = yield* makeCitationRegexInput(setup.limits);
  const source = yield* prepare.prepareUnicode(output.source, () => Effect.void);
  const items = yield* Effect.forEach(
    output.assembly.items,
    (item) =>
      item._tag === "Token"
        ? S.decodeEffect(ItemType)({ kind: "Token", id: item.id })
        : source
            .slice(item, () => Effect.void)
            .pipe(Effect.flatMap((data) => S.decodeEffect(ItemType)({ kind: "Text", data }))),
    { concurrency: 1 }
  );
  expect(items, `case ${row.id}`).toEqual(row.items);
  expect(output.assembly.citations, `case ${row.id}`).toEqual(row.citations);
  expect(output.tokens, `case ${row.id}`).toEqual(row.tokens);
  const snapshot = yield* setup.admission.snapshot;
  expect(snapshot).toMatchObject({ active: 0, queued: 0 });
});
