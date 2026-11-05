/** Portable source-only cleaner corpus checks; no target completion claim. */
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const expected = "814406f61958dfe9d43b32cad562378372e07fa5f32f5e5a5437457e6ea5e3ff";
const operationSha = "ae441000ddc90537864e3fdd4a9dfc4aa81af37a65818b48ce9bf37d95d1eeb1";
const Corpus = S.Struct({
  schemaVersion: S.tag("citation-cleaner-pipeline/v1"),
  scope: S.tag("source observations; composed target and host-value/iteration/registry contracts remain open"),
  oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
  oracleTree: S.tag("a35a58fac03400f71a93a93485b77f1d56f2b02f"),
  python: S.tag("3.11.15"),
  pythonHashSeed: S.tag("0"),
  hashWidth: S.tag(64),
  hashAlgorithm: S.tag("siphash13"),
  license: S.tag("BSD-2-Clause"),
  licenseSha256: S.tag("db2c3c974a69bd9141257a10daee138116cd04ec354cd5239d0af52bc5025772"),
  lockSha256: S.tag("864cf7a1ef7ebafe8159b9691a42a2dfe980cf0e609b5fd1899bcc5703b91e9a"),
  producerSha256: S.String,
  sources: S.Struct({
    "clean.py": S.tag("b2a1f8484c84f3d704d2e7fe5e0a1fdb36a8bb07d2e56880701a831d5e1a12db"),
    "tests/test_UtilsTest.py": S.tag("578a4ae4403a41623df62e082c86895bc05b4abd0a916b606214e40e65af8c1a"),
  }),
  operationCorpusSha256: S.tag(operationSha),
  versions: S.Struct({
    eyecite: S.tag("2.7.6"),
    "reporters-db": S.tag("3.2.53"),
    "courts-db": S.tag("0.10.22"),
    lxml: S.tag("5.1.0"),
  }),
  libxmlRuntime: S.Tuple([S.Literal(2), S.Literal(12), S.Literal(3)]),
  libxmlCompiled: S.Tuple([S.Literal(2), S.Literal(12), S.Literal(3)]),
  builtinNames: S.Tuple([
    S.Literal("html"),
    S.Literal("inline_whitespace"),
    S.Literal("all_whitespace"),
    S.Literal("underscores"),
    S.Literal("xml"),
  ]),
  namedTextCount: S.tag(7),
  namedSequenceCount: S.tag(156),
  customScenes: S.Array(S.String),
  artifacts: S.Array(S.Struct({ sha256: S.String, value: S.String })),
  cases: S.Array(
    S.Struct({
      name: S.String,
      family: S.Literals(["named", "official", "custom"]),
      input: S.Json,
      steps: S.Json,
      runs: S.Array(S.Json),
      events: S.Array(S.Json),
      lookupAfter: S.Array(S.Json),
      officialId: S.optionalKey(S.String),
    })
  ),
});
const references = (value: unknown): ReadonlyArray<string> => {
  if (A.isArray(value)) return A.flatMap(value, references);
  if (!P.isObject(value)) return [];
  return A.flatMap(R.toEntries(value), ([key, entry]) =>
    key === "text" || key === "message" ? [P.isString(entry) ? entry : "invalid-reference"] : references(entry)
  );
};
const require = (condition: boolean) =>
  condition ? Effect.void : Effect.fail(new Error("Cleaner corpus invariant failed"));
const program = Effect.gen(function* () {
  const bytes = yield* Effect.tryPromise(() =>
    Bun.file(
      process.argv[2] ??
        new URL("../../../packages/law-practice/use-cases/test/fixtures/eyecite/cleaner-pipeline.json", import.meta.url)
    ).bytes()
  );
  yield* require(sha(bytes) === expected);
  const report = yield* S.decodeEffect(S.fromJsonString(Corpus), { onExcessProperty: "error" })(
    new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  );
  const producer = yield* Effect.tryPromise(() =>
    Bun.file(new URL("./probe-cleaner-pipeline.py", import.meta.url)).bytes()
  );
  const operations = yield* Effect.tryPromise(() =>
    Bun.file(
      process.argv[3] ??
        new URL("../../../packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url)
    ).bytes()
  );
  yield* require(sha(producer) === report.producerSha256 && sha(operations) === operationSha);
  yield* require(report.customScenes.length === 51 && new Set(report.customScenes).size === 51);
  const expectedNames = [
    ...A.flatMap(A.range(0, 6), (text) => A.map(A.range(0, 155), (sequence) => `named:${text}:${sequence}`)),
    ...A.map(A.range(0, 11), (index) => `official:${index}`),
    ...report.customScenes,
  ];
  yield* require(
    report.cases.length === 1155 &&
      A.every(
        A.zip(
          A.map(report.cases, (row) => row.name),
          expectedNames
        ),
        ([left, right]) => left === right
      )
  );
  yield* require(A.filter(report.cases, (row) => row.family === "named").length === 1092);
  yield* require(A.filter(report.cases, (row) => row.family === "official").length === 12);
  yield* require(A.filter(report.cases, (row) => row.family === "custom").length === 51);
  const hashes = A.map(report.artifacts, (row) => row.sha256);
  yield* require(
    hashes.length === 109 &&
      new Set(hashes).size === 109 &&
      A.every(A.zip(hashes, A.drop(hashes, 1)), ([left, right]) => left < right)
  );
  for (const artifact of report.artifacts) {
    const quoted = yield* S.encodeEffect(S.fromJsonString(S.String))(artifact.value);
    const fragments: Array<string> = [];
    let start = 0;
    for (let index = 0; index < Str.length(quoted); index++) {
      const unit = O.getOrElse(Str.charCodeAt(quoted, index), () => 0);
      if (unit < 127) continue;
      fragments.push(Str.slice(start, index)(quoted), `\\u${Str.padStart(4, "0")(unit.toString(16))}`);
      start = index + 1;
    }
    fragments.push(Str.slice(start)(quoted));
    yield* require(sha(A.join(fragments, "")) === artifact.sha256);
  }
  const referenced = A.flatMap(report.cases, references);
  yield* require(
    A.every(referenced, (hash) => A.contains(hashes, hash)) && A.every(hashes, (hash) => A.contains(referenced, hash))
  );
  yield* Console.log(
    "Cleaner source evidence valid: 1155 cases, 51 custom scenes, 109 immutable strings; target contracts and parity remain open."
  );
});
Effect.runPromise(
  program.pipe(
    Effect.catch(() =>
      Effect.gen(function* () {
        yield* Console.error("Cleaner source corpus validation failed.");
        process.exitCode = 1;
      })
    )
  )
);
