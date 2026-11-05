/** Portable source Unicode evidence; target ownership remains unproved. */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $LawPracticeUseCasesId.create("citation-parity/UnicodeSourceEvidence");
const Reason = LiteralKit(["invalid-source-evidence", "read-failed"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed source-evidence failures without captured text." })
);
class UnicodeEvidenceFailure extends S.TaggedError<UnicodeEvidenceFailure, { readonly brand: unique symbol }>(
  $I`UnicodeEvidenceFailure`
)(
  "UnicodeEvidenceFailure",
  { reason: Reason },
  $I.annoteError<UnicodeEvidenceFailure>("UnicodeEvidenceFailure", {
    description: "Captured Unicode source evidence is missing or changed.",
  })
) {}
class CapturedUnicodeValue extends S.Opaque<CapturedUnicodeValue, { readonly brand: unique symbol }>()(
  S.Struct({
    codepoints: S.Array(S.Natural.check(S.isLessThanOrEqualTo(0x10ffff))),
    width: S.Literals([1, 2, 4]),
    nativeHex: S.String,
    pythonLength: S.Natural,
    utf16Units: S.Natural,
    hash: S.BigIntFromString,
    javascriptRoundtrip: S.Boolean,
  }).pipe(
    $I.annoteSchema("CapturedUnicodeValue", {
      description: "Full source code points and actual CPython native storage, with no lossy string projection.",
    })
  )
) {}
const Corpus = S.Struct({
  schemaVersion: S.tag("citation-cleaner-unicode/v1"),
  scope: S.tag("source Unicode composition and storage-sensitive HTML; registry protocols remain open"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
  python: S.tag("3.11.15"),
  pythonHashSeed: S.tag("0"),
  lxml: S.tag("5.1.0"),
  libxml: S.tag("2.12.3"),
  cleanSourceSha256: S.tag("b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db"),
  oracleLicenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
  runtimeUnicodeHeaderSha256: S.tag("9183d40b4aec778c4f59d2091b4374722f635116a33ae6fc66c16e0b5fa700b5"),
  nativeLayoutVerification: S.tag("direct retained compact-string storage; little-endian CPython 3.11 x86-64"),
  producerSha256: S.String,
  cases: S.Array(
    S.Struct({
      name: S.String,
      steps: S.Array(S.Literals(["html", "inline_whitespace", "all_whitespace", "underscores", "xml"])),
      events: S.Array(S.Struct({ value: CapturedUnicodeValue, sameAs: S.Array(S.Natural) })),
      failure: S.NullOr(S.Literals(["ParserError"])),
    })
  ),
}).pipe($I.annoteSchema("Corpus", { description: "Pinned source-only cleaner Unicode histories and provenance." }));
const CorpusJson = S.fromJsonString(Corpus);
const sha = (value: string) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const require = Effect.fn("Citation.requireUnicodeEvidence")(
  (condition: boolean): Effect.Effect<void, UnicodeEvidenceFailure> =>
    condition ? Effect.void : Effect.fail(UnicodeEvidenceFailure.make({ reason: "invalid-source-evidence" }))
);
const read = Effect.fn("Citation.readUnicodeEvidence")((path: string | URL) =>
  Effect.tryPromise({
    try: () => Bun.file(path).text(),
    catch: () => UnicodeEvidenceFailure.make({ reason: "read-failed" }),
  })
);
const program = Effect.gen(function* () {
  yield* require(process.argv.length <= 3);
  const raw = yield* read(
    O.getOrElse(
      O.fromUndefinedOr(process.argv[2]),
      () =>
        new URL("../../../packages/law-practice/use-cases/test/fixtures/eyecite/cleaner-unicode.json", import.meta.url)
    )
  );
  yield* require(sha(raw) === "0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0");
  const report = yield* S.decodeEffect(CorpusJson)(raw);
  yield* require(report.producerSha256 === sha(yield* read(new URL("./probe-cleaner-unicode.py", import.meta.url))));
  yield* require(report.cases.length === 2016);
  yield* require(A.filter(report.cases, (row) => Str.startsWith("composition-")(row.name)).length === 1872);
  yield* require(A.filter(report.cases, (row) => Str.startsWith("width-")(row.name)).length === 144);
  yield* require(A.filter(report.cases, (row) => row.failure === "ParserError").length === 482);
  const sameValue = S.toEquivalence(CapturedUnicodeValue);
  let snapshots = 0;
  let nonroundtrip = 0;
  for (const row of report.cases) {
    yield* require(row.events.length >= 1 && row.events.length <= row.steps.length + 1);
    yield* require((row.failure !== null) === row.events.length < row.steps.length + 1);
    for (let index = 0; index < row.events.length; index++) {
      const event = yield* A.get(row.events, index).pipe(
        O.match({
          onNone: () => Effect.fail(UnicodeEvidenceFailure.make({ reason: "invalid-source-evidence" })),
          onSome: Effect.succeed,
        })
      );
      yield* require(event.value.pythonLength === event.value.codepoints.length);
      yield* require(Str.length(event.value.nativeHex) === event.value.width * event.value.pythonLength * 2);
      for (const prior of event.sameAs) {
        const old = A.get(row.events, prior);
        yield* require(prior < index && O.isSome(old) && sameValue(old.value.value, event.value));
      }
      snapshots++;
      if (!event.value.javascriptRoundtrip) nonroundtrip++;
    }
  }
  yield* require(snapshots === 6412 && nonroundtrip === 1208);
  yield* Console.log("Unicode source evidence valid: 2016 histories / 6412 snapshots; target ownership remains open.");
});
Effect.runPromise(
  program.pipe(
    Effect.catch(() =>
      Effect.gen(function* () {
        yield* Console.error("Unicode source evidence validation failed.");
        process.exitCode = 1;
      })
    )
  )
);
