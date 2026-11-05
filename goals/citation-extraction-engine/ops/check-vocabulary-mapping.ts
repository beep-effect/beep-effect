/** Validate identity mapping against frozen evidence and the public API only. */
import {
  CourtReporterArtifact,
  CourtReporterArtifactContract,
  findReportersByAlias,
} from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { CitationOracleOperations, CitationOracleVocabularyMapping } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";

const sha = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const reject = (reason: string) => Effect.fail(new Error(reason));
const same = S.toEquivalence(S.Json);
const unique = (values: ReadonlyArray<string>) => A.length(A.dedupe(values)) === values.length;
const sameIds = (left: ReadonlyArray<string>, right: ReadonlyArray<string>) =>
  unique(left) && unique(right) && left.length === right.length && A.every(left, (id) => A.contains(right, id));
const canonical = (value: unknown): unknown =>
  A.isArray(value)
    ? A.map(value, canonical)
    : P.isObject(value)
      ? R.fromEntries(
          A.map(
            A.sort(
              R.toEntries(value),
              Order.mapInput(Order.String, ([key]: readonly [string, unknown]) => key)
            ),
            ([key, item]) => [key, canonical(item)] as const
          )
        )
      : value;
const differences = (legacy: Readonly<Record<string, S.Json>>, current: Readonly<Record<string, S.Json>>) =>
  A.flatMap(R.toEntries(legacy), ([field, value]) =>
    same(value, current[field]!) ? [] : [{ field, legacy: value, current: current[field]! }]
  );
const Datetime = S.NullOr(S.Struct({ datetime: S.String }));
const ReporterData = S.Struct({ source: S.String, short_name: S.String, name: S.String, cite_type: S.String });
const EditionData = S.Struct({
  reporter: S.Struct({ artifactSha256: S.String }),
  short_name: S.String,
  start: Datetime,
  end: Datetime,
});
const CourtMetadata = S.Struct({
  name: S.String,
  nameAbbreviation: S.NullOr(S.String),
  sourceJurisdiction: S.Union([S.String, S.Array(S.String), S.Null]),
  system: S.String,
  type: S.NullOr(S.String),
  hierarchyLevel: S.NullOr(S.String),
  location: S.String,
  effectiveRanges: S.Array(S.Struct({ start: S.NullOr(S.String), end: S.NullOr(S.String) })),
});
const program = Effect.gen(function* () {
  const text = yield* Effect.tryPromise(() =>
    Bun.file(
      process.argv[2] ??
        new URL(
          "../../../packages/law-practice/use-cases/test/fixtures/eyecite/vocabulary-mapping.json",
          import.meta.url
        )
    ).text()
  );
  const report = yield* S.decodeUnknownEffect(S.fromJsonString(CitationOracleVocabularyMapping), {
    onExcessProperty: "error",
  })(text);
  if (Result.isFailure(CourtReporterArtifact)) return yield* reject("public artifact failed decoding");
  const current = yield* S.encodeEffect(CourtReporterArtifactContract)(CourtReporterArtifact.success);
  if (
    report.publicArtifactVersion !== current.artifactVersion ||
    current.artifactVersion !== "crv1:f353e51400a5:fad63b383b92" ||
    report.publicReportersVersion !== current.reporters.source.release ||
    report.publicCourtsVersion !== current.courts.source.release
  )
    return yield* reject("public vocabulary version mismatch");
  for (const [file, expected] of [
    ["export-vocabulary-mapping.py", report.exporterSha256],
    ["export-public-vocabulary.ts", report.publicExporterSha256],
  ]) {
    const bytes = yield* Effect.tryPromise(() => Bun.file(new URL(`./${file}`, import.meta.url)).bytes());
    if (sha(bytes) !== expected) return yield* reject("vocabulary exporter hash mismatch");
  }
  const operationBytes = yield* Effect.tryPromise(() =>
    Bun.file(
      new URL("../../../packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url)
    ).text()
  );
  if (sha(operationBytes) !== report.operationCorpusSha256)
    return yield* reject("vocabulary operation evidence hash mismatch");
  const operations = yield* S.decodeUnknownEffect(S.fromJsonString(CitationOracleOperations))(operationBytes);
  const reporterArtifacts: Record<string, typeof ReporterData.Type> = {};
  const editionArtifacts: Record<string, typeof EditionData.Type> = {};
  for (const [hash, artifact] of R.toEntries(operations.artifacts)) {
    if (artifact.kind !== "model-value") continue;
    if (artifact.payload.value.pythonType === "eyecite.models.Reporter")
      reporterArtifacts[hash] = yield* S.decodeUnknownEffect(ReporterData)(artifact.payload.value.fields);
    if (artifact.payload.value.pythonType === "eyecite.models.Edition")
      editionArtifacts[hash] = yield* S.decodeUnknownEffect(EditionData)(artifact.payload.value.fields);
  }
  if (
    !sameIds(
      R.keys(reporterArtifacts),
      A.map(report.reporters, (row) => row.artifactSha256)
    ) ||
    !sameIds(
      R.keys(editionArtifacts),
      A.map(report.editions, (row) => row.artifactSha256)
    )
  )
    return yield* reject("publication/edition artifact coverage mismatch");
  const currentReporters = R.fromEntries(A.map(current.reporters.records, (row) => [row.id, row] as const));
  const mappings = R.fromEntries(A.map(report.reporters, (row) => [row.artifactSha256, row] as const));
  const explicit = [
    [
      "C.I.T.",
      "specialty",
      "Court of International Trade Reports",
      "alias-merger",
      "reporter:ec9ba165d777489bf3ceb824",
    ],
    [
      "Ct. Int'l Trade",
      "federal",
      "Court of International Trade Reports",
      "cite-type-update",
      "reporter:ec9ba165d777489bf3ceb824",
    ],
    [
      "Teiss.",
      "state",
      "Louisiana Court of Appeals Reports, Teisser",
      "name-correction",
      "reporter:d6ce49dfb219086bae7a6d8a",
    ],
  ];
  for (const row of report.reporters) {
    const legacy = reporterArtifacts[row.artifactSha256]!;
    if (
      legacy.source !== row.legacySource ||
      legacy.short_name !== row.legacyAbbreviation ||
      legacy.name !== row.legacyName ||
      legacy.cite_type !== row.legacyCiteType
    )
      return yield* reject("publication identity fields mismatch");
    if (row.kind !== "case-reporter") continue;
    const target = currentReporters[row.reporterId];
    if (
      target === undefined ||
      !A.some(findReportersByAlias(row.legacyAbbreviation), (candidate) => candidate.id === row.reporterId)
    )
      return yield* reject("unresolved public reporter identity");
    if (row.method === "exact-source-identity") {
      if (
        target.primaryAbbreviation !== legacy.short_name ||
        target.citeType !== legacy.cite_type ||
        target.name !== legacy.name
      )
        return yield* reject("non-exact reporter identity called exact");
    } else if (
      !A.some(
        explicit,
        ([abbreviation, citeType, name, method, id]) =>
          legacy.short_name === abbreviation &&
          legacy.cite_type === citeType &&
          legacy.name === name &&
          row.method === method &&
          row.reporterId === id
      )
    )
      return yield* reject("unreviewed reporter transition");
    const actualEditions = A.map(
      A.filter(R.values(editionArtifacts), (edition) => edition.reporter.artifactSha256 === row.artifactSha256),
      (edition) => ({
        abbreviation: edition.short_name,
        start: edition.start?.datetime ?? null,
        end: edition.end?.datetime ?? null,
      })
    );
    if (
      actualEditions.length !== row.legacyMetadata.editions.length ||
      !A.every(actualEditions, (edition) => A.some(row.legacyMetadata.editions, (entry) => same(edition, entry)))
    )
      return yield* reject("legacy reporter metadata/edition artifacts disagree");
    const expected = differences(
      {
        primaryAbbreviation: legacy.short_name,
        name: legacy.name,
        citeType: legacy.cite_type,
        jurisdictions: row.legacyMetadata.jurisdictions,
        editions: row.legacyMetadata.editions,
      },
      target
    );
    if (!same(row.differences, expected)) return yield* reject("reporter version differences omitted or changed");
  }
  for (const row of report.editions) {
    const legacy = editionArtifacts[row.artifactSha256]!;
    const parent = mappings[row.reporterArtifactSha256];
    if (
      parent === undefined ||
      parent.kind !== row.kind ||
      legacy.reporter.artifactSha256 !== row.reporterArtifactSha256 ||
      legacy.short_name !== row.legacyAbbreviation
    )
      return yield* reject("edition parent identity mismatch");
    if (row.kind !== "case-reporter" || parent.kind !== "case-reporter") continue;
    const target = currentReporters[row.reporterId];
    const edition =
      target === undefined
        ? undefined
        : A.filter(target.editions, (entry) => entry.abbreviation === row.currentAbbreviation)[0];
    if (
      row.reporterId !== parent.reporterId ||
      edition === undefined ||
      (row.method === "exact-edition-abbreviation" && row.currentAbbreviation !== row.legacyAbbreviation)
    )
      return yield* reject("edition public identity mismatch");
    if (
      row.method === "historical-edition-alias" &&
      (parent.method !== "alias-merger" ||
        row.legacyAbbreviation !== "C.I.T." ||
        row.currentAbbreviation !== "Ct. Int'l Trade")
    )
      return yield* reject("unreviewed edition transition");
    if (
      !same(
        row.differences,
        differences(
          { abbreviation: legacy.short_name, start: legacy.start?.datetime ?? null, end: legacy.end?.datetime ?? null },
          edition
        )
      )
    )
      return yield* reject("edition date/name differences omitted or changed");
  }
  if (
    report.courts.length !== 2798 ||
    !unique(A.map(report.courts, (row) => row.id)) ||
    !A.every(report.courts, (row, index) => row.ordinal === index + 1)
  )
    return yield* reject("legacy court order/coverage mismatch");
  const courtSelection = A.map(report.courts, (row) => ({
    id: row.id,
    ordinal: row.ordinal,
    citationString: row.citationString,
  }));
  const selectionJson = yield* S.encodeUnknownEffect(S.fromJsonString(S.Json))(canonical(courtSelection));
  if (sha(selectionJson) !== report.legacyCourtSelectionSha256)
    return yield* reject("legacy court selection hash mismatch");
  const currentCourts = R.fromEntries(A.map(current.courts.records, (row) => [row.sourceId, row] as const));
  for (const row of report.courts) {
    const target = currentCourts[row.id];
    if (target === undefined || target.id !== row.id || target.citationString !== row.citationString)
      return yield* reject("unmapped legacy court identity/string");
    const metadata = yield* S.decodeUnknownEffect(CourtMetadata)(row.legacyMetadata);
    const jurisdiction = metadata.sourceJurisdiction;
    const projected = {
      ...metadata,
      sourceJurisdiction: A.isArray(jurisdiction) && jurisdiction.length === 1 ? jurisdiction[0]! : jurisdiction,
    };
    if (!same(row.differences, differences({ citationString: row.citationString, ...projected }, target)))
      return yield* reject("court version differences omitted or changed");
  }
  const mappedReporterIds = A.dedupe(
    A.flatMap(report.reporters, (row) => (row.kind === "case-reporter" ? [row.reporterId] : []))
  );
  if (
    !sameIds(
      report.publicOnlyReporterIds,
      A.filter(R.keys(currentReporters), (id) => !A.contains(mappedReporterIds, id))
    ) ||
    !sameIds(
      report.publicOnlyCourtIds,
      A.filter(
        A.map(current.courts.records, (row) => row.id),
        (id) => !A.some(report.courts, (court) => court.id === id)
      )
    )
  )
    return yield* reject("unaccounted vocabulary additions");
  yield* Console.log(
    `Vocabulary mapping valid: ${report.reporters.length} publications, ${report.editions.length} editions and ${report.courts.length} ordered courts; all case reporters map to public IDs.`
  );
});
Effect.runPromise(
  program.pipe(
    Effect.catchCause(() =>
      Console.error("Vocabulary mapping validation failed; inspect source identity, version drift and coverage.").pipe(
        Effect.tap(() =>
          Effect.sync(() => {
            process.exitCode = 1;
          })
        )
      )
    )
  )
);
