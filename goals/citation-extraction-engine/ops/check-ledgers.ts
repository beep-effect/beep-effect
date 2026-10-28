/** Audit compatible ledger projections; completion remains a separate strict mode. */
import {
  CitationOracleAssertions,
  CitationOracleDiscovery,
  CitationOracleLedgers,
  CitationOracleOperations,
} from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const root = new URL("../../../", import.meta.url);
const fixtureRoot =
  process.argv[2] && process.argv[2] !== "--complete"
    ? `${process.argv[2]}/`
    : new URL("packages/law-practice/use-cases/test/fixtures/eyecite/", root);
const hash = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const reject = (reason: string) => Effect.fail(new Error(reason));
const json = S.fromJsonString(S.JsonObject);
const same = S.toEquivalence(S.Json);
const unique = (ids: ReadonlyArray<string>) => A.length(A.dedupe(ids)) === A.length(ids);
const equalIds = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  unique(left) && unique(right) && left.length === right.length && A.every(left, (id) => A.contains(right, id));
const read = (path: string | URL) => Effect.tryPromise(() => Bun.file(path).text());
const filePath = (name: string) =>
  typeof fixtureRoot === "string" ? `${fixtureRoot}${name}` : new URL(name, fixtureRoot);
const program = Effect.gen(function* () {
  const values = yield* Effect.all(
    A.map(["source-inventory.json", "canonical-cases.json", "regex-inventory.json"], (name) =>
      read(filePath(name)).pipe(Effect.flatMap(S.decodeUnknownEffect(json)))
    )
  );
  const bundle = yield* S.decodeUnknownEffect(CitationOracleLedgers)({
    inventory: values[0],
    canonical: values[1],
    regex: values[2],
  });
  const { inventory, canonical, regex } = bundle;
  const exporter = yield* Effect.tryPromise(() => Bun.file(new URL("./export-ledgers.py", import.meta.url)).bytes());
  for (const ledger of [inventory, canonical, regex]) {
    if (ledger.generatorSha256 !== hash(exporter)) return yield* reject("ledger generator hash mismatch");
    for (const evidence of R.values(ledger.evidence)) {
      const bytes = yield* Effect.tryPromise(() => Bun.file(new URL(evidence.path, root)).bytes());
      if (hash(bytes) !== evidence.sha256) return yield* reject("ledger evidence hash mismatch");
    }
  }
  const discovery = yield* read(new URL(inventory.evidence.discovery.path, root)).pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(CitationOracleDiscovery)))
  );
  const assertions = yield* read(new URL(inventory.evidence.assertions.path, root)).pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(CitationOracleAssertions)))
  );
  const operations = yield* read(new URL(inventory.evidence.operations.path, root)).pipe(
    Effect.flatMap(S.decodeUnknownEffect(S.fromJsonString(CitationOracleOperations)))
  );
  const expectedRows = A.filter(
    discovery.sourceRows,
    (row) => row.kind !== "testMethod" && row.kind !== "regexCandidate"
  );
  const ordinaryRows = A.filter(inventory.rows, (row) => row.kind !== "regexFamily");
  if (
    !equalIds(
      A.map(expectedRows, (row) => row.id),
      A.map(ordinaryRows, (row) => row.id)
    ) ||
    !unique(A.map(inventory.rows, (row) => row.id))
  )
    return yield* reject("source row accounting mismatch");
  if (
    !same(
      inventory.testMethods,
      A.filter(discovery.sourceRows, (row) => row.kind === "testMethod")
    ) ||
    !same(inventory.parameterSources, assertions.source)
  )
    return yield* reject("method/parameter source mismatch");
  for (const expected of expectedRows) {
    const actual = A.filter(ordinaryRows, (row) => row.id === expected.id)[0];
    if (
      actual === undefined ||
      actual.kind !== expected.kind ||
      actual.path !== expected.path ||
      actual.sourceSha256 !== expected.sourceSha256 ||
      (expected.kind !== "fixture" &&
        (actual.kind === "fixture" ||
          actual.line !== expected.line ||
          actual.column !== expected.column ||
          actual.symbol !== expected.symbol))
    )
      return yield* reject("source declaration content mismatch");
  }
  for (const row of inventory.rows) {
    if (
      row.kind !== "fixture" &&
      !A.some(discovery.sourceFiles, (file) => file.path === row.path && file.sha256 === row.sourceSha256)
    )
      return yield* reject("source content hash mismatch");
  }
  const capabilitySources = A.filter(
    inventory.rows,
    (row) => row.kind === "publicOperation" || row.kind === "modelFamily" || row.kind === "helperFamily"
  );
  if (
    !equalIds(
      A.map(capabilitySources, (row) => row.id),
      A.map(canonical.capabilities, (row) => row.sourceRowId)
    ) ||
    !unique(A.map(canonical.capabilities, (row) => row.id)) ||
    !A.every(capabilitySources, (row) =>
      A.some(
        canonical.capabilities,
        (capability) => capability.id === row.capabilityId && capability.sourceRowId === row.id
      )
    )
  )
    return yield* reject("capability ownership mismatch");
  if (
    !equalIds(
      A.map(assertions.events, (row) => row.id),
      A.map(canonical.cases, (row) => row.id)
    )
  )
    return yield* reject("canonical case mismatch");
  const events = R.fromEntries(A.map(assertions.events, (row) => [row.id, row] as const));
  const iterations = R.fromEntries(A.map(assertions.iterations, (row) => [row.id, row] as const));
  for (const row of canonical.cases) {
    const event = events[row.id]!;
    const iterationIds = A.dedupe(A.flatMap(event.payload.value.context.frames, (frame) => frame.iterationIds));
    const literalItems = A.flatMap(iterationIds, (id) => {
      const iteration = iterations[id]!;
      return iteration.literalParameterId === undefined
        ? []
        : [{ parameterId: iteration.literalParameterId, itemOrdinal: iteration.indexWithinParent }];
    });
    if (
      row.declarationId !== event.declarationId ||
      row.test !== event.test ||
      row.ordinal !== event.ordinal ||
      row.assertion !== event.assertion ||
      row.observation.id !== row.id ||
      row.observation.normalizedSha256 !== event.normalizedSha256 ||
      !same(row.iterationIds, iterationIds) ||
      !same(row.literalItems, literalItems)
    )
      return yield* reject("canonical observation projection mismatch");
  }
  const declarations = A.filter(inventory.rows, (row) => row.kind === "caseDeclaration");
  if (
    !equalIds(
      A.map(declarations, (row) => row.id),
      A.map(inventory.declarationExpansions, (row) => row.declarationId)
    )
  )
    return yield* reject("declaration projection mismatch");
  for (const row of inventory.declarationExpansions) {
    if (
      !equalIds(
        row.eventIds,
        A.map(
          A.filter(canonical.cases, (entry) => entry.declarationId === row.declarationId),
          (entry) => entry.id
        )
      )
    )
      return yield* reject("declaration expansion mismatch");
  }
  const fixtures = A.filter(inventory.rows, (row) => row.kind === "fixture");
  if (
    !equalIds(
      A.map(fixtures, (row) => row.id),
      A.map(canonical.fixtures, (row) => row.id)
    ) ||
    !A.every(canonical.fixtures, (row) =>
      A.some(
        fixtures,
        (source) => source.id === row.id && source.sourceSha256 === row.sourceSha256 && source.path === row.path
      )
    )
  )
    return yield* reject("fixture provenance mismatch");
  if (
    !same(
      canonical.operationObservations,
      A.map(operations.cases, (row) => ({
        id: row.id,
        sourceSiteId: row.sourceSiteId,
        operation: row.operation,
        test: row.test,
        normalizedSha256: row.normalizedSha256,
      }))
    )
  )
    return yield* reject("operation projection mismatch");
  const families = A.filter(inventory.rows, (row) => row.kind === "regexFamily");
  if (
    !equalIds(
      A.map(families, (row) => row.id),
      A.map(regex.families, (row) => row.id)
    ) ||
    !A.every(regex.families, (row) => A.some(families, (source) => source.id === row.id && source.form === row.form))
  )
    return yield* reject("regex family mismatch");
  for (const candidate of A.filter(discovery.sourceRows, (row) => row.kind === "regexCandidate")) {
    if (
      !A.some(
        families,
        (row) =>
          row.form === "declaration" &&
          row.path === candidate.path &&
          row.line === candidate.line &&
          row.symbol === candidate.symbol
      )
    )
      return yield* reject("unclassified regex declaration");
  }
  const expectedInstances = A.flatMap(R.toEntries(operations.artifacts), ([artifactSha256, artifact]) =>
    artifact.kind === "tokenizer-extractors"
      ? A.map(artifact.payload.value, (_, index) => `${artifactSha256}::${index}`)
      : []
  );
  if (
    !equalIds(
      expectedInstances,
      A.map(regex.extractorInstances, (row) => row.id)
    )
  )
    return yield* reject("expanded regex instance mismatch");
  for (const row of regex.extractorInstances) {
    const artifact = operations.artifacts[row.artifactSha256];
    if (artifact?.kind !== "tokenizer-extractors" || row.id !== `${row.artifactSha256}::${row.index}`)
      return yield* reject("regex artifact mismatch");
    const extractor = artifact.payload.value[row.index];
    if (extractor === undefined) return yield* reject("regex extractor missing");
    const fields = yield* S.decodeUnknownEffect(
      S.Struct({ regex: S.String, flags: S.Natural, constructor: S.Struct({ callable: S.String }) })
    )(extractor.fields);
    if (
      row.patternSha256 !== hash(fields.regex) ||
      row.flags !== fields.flags ||
      row.constructor !== fields.constructor.callable
    )
      return yield* reject("expanded regex payload mismatch");
  }
  const pending = A.filter(
    [...canonical.capabilities, ...canonical.cases, ...regex.families, ...regex.extractorInstances],
    (row) => row.workflowState !== "complete" || row.proof === null
  ).length;
  if (process.argv.includes("--complete") && (pending > 0 || A.some(canonical.cases, (row) => row.targetTest === null)))
    return yield* reject("unfinished parity or safety proof");
  yield* Console.log(
    `Ledger projections valid: ${inventory.rows.length} source rows, ${canonical.cases.length} cases, ${regex.families.length} regex families, ${regex.extractorInstances.length} instances; ${pending} rows still lack completion proof.`
  );
});
Effect.runPromise(
  program.pipe(
    Effect.catchCause(() =>
      Console.error("Citation ledger validation failed; inspect projections, provenance and proof state.").pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    )
  )
);
