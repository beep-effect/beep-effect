/** Validate portable public-operation evidence without a live Python clone. */
import { convertTextOffsetRange, TextOffsetRange } from "@beep/langextract/VerifiedSpan";
import { CitationOracleDiscovery, CitationOracleOperations } from "@beep/law-practice-use-cases/test";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const sha256 = (value: string | Uint8Array) => new Bun.CryptoHasher("sha256").update(value).digest("hex");
const references = (value: unknown): ReadonlyArray<string> => {
  if (A.isArray(value)) return A.flatMap(value, references);
  if (P.isObject(value))
    return A.flatMap(R.toEntries(value), ([key, entry]) =>
      key === "artifactSha256" || key === "extractorsSha256"
        ? [P.isString(entry) ? entry : "invalid-artifact-reference"]
        : references(entry)
    );
  return [];
};
const orderedEditionBags = (value: unknown): boolean => {
  if (A.isArray(value)) return A.every(value, orderedEditionBags);
  if (!P.isObject(value)) return true;
  return A.every(R.toEntries(value), ([key, entry]) => {
    if (key === "exact_editions" || key === "variation_editions" || key === "all_editions") {
      if (!A.isArray(entry)) return false;
      const hashes = A.map(entry, (edition) =>
        P.isObject(edition) && P.isString(edition.artifactSha256) ? edition.artifactSha256 : "invalid"
      );
      if (A.contains(hashes, "invalid") || !A.every(A.zip(hashes, A.drop(hashes, 1)), ([left, right]) => left <= right))
        return false;
    }
    return orderedEditionBags(entry);
  });
};
const program = Effect.gen(function* () {
  const text = yield* Effect.tryPromise(() =>
    Bun.file(
      process.argv[2] ??
        new URL("../../../packages/law-practice/use-cases/test/fixtures/eyecite/operation-cases.json", import.meta.url)
    ).text()
  );
  // Hash the original encoded payload bytes before any codec normalization.
  const encoded = yield* S.decodeUnknownEffect(S.fromJsonString(S.toEncoded(CitationOracleOperations)))(text);
  const exporter = yield* Effect.tryPromise(() => Bun.file(new URL("./export-operations.py", import.meta.url)).bytes());
  if (sha256(exporter) !== encoded.exporterSha256) {
    return yield* Effect.fail(new Error("Operation exporter hash mismatch"));
  }
  for (const row of encoded.cases) {
    if (sha256(row.payload) !== row.normalizedSha256) {
      return yield* Effect.fail(new Error(`Operation payload hash mismatch: ${row.id}`));
    }
  }
  for (const [hash, artifact] of R.toEntries(encoded.artifacts)) {
    if (sha256(artifact.payload) !== hash) {
      return yield* Effect.fail(new Error("Shared oracle artifact hash mismatch"));
    }
  }
  const report = yield* S.decodeEffect(CitationOracleOperations)(encoded);
  const discoveryText = yield* Effect.tryPromise(() =>
    Bun.file(new URL("../history/evidence/oracle-discovery.json", import.meta.url)).text()
  );
  const discovery = yield* S.decodeUnknownEffect(S.fromJsonString(CitationOracleDiscovery))(discoveryText);
  for (const site of report.sourceSites) {
    if (!A.some(discovery.sourceFiles, (file) => file.path === site.path && file.sha256 === site.sourceSha256)) {
      return yield* Effect.fail(new Error("Operation site disagrees with independent source-content inventory"));
    }
  }
  const artifactHashes: ReadonlyArray<string> = R.keys(report.artifacts);
  const payloads = [
    ...A.map(report.cases, (row) => row.payload.value),
    ...A.map(R.values(report.artifacts), (artifact) => artifact.payload.value),
  ];
  if (!A.every(payloads, orderedEditionBags)) {
    return yield* Effect.fail(new Error("Edition candidate bags violate the recorded representation normalization"));
  }
  const referenced = A.flatMap(payloads, references);
  if (
    !A.every(referenced, (hash) => A.contains(artifactHashes, hash)) ||
    !A.every(artifactHashes, (hash) => A.contains(referenced, hash))
  ) {
    return yield* Effect.fail(new Error("Missing or unaccounted shared oracle artifact"));
  }
  for (const row of report.cases) {
    if (row.operation === "get_citations") {
      const { document, citationSpans, filtering } = row.payload.value.stages;
      if (
        !A.isReadonlyArrayNonEmpty(filtering) ||
        !A.every(filtering, (stage) => A.every(stage.retained, (index) => index < A.length(stage.candidates)))
      ) {
        return yield* Effect.fail(new Error("Filtering stage references an absent candidate"));
      }
      const last = A.lastNonEmpty(filtering);
      const equalJson = S.toEquivalence(S.Json);
      if (
        row.payload.value.outcome.kind === "success" &&
        !equalJson(
          A.map(last.retained, (index) => last.candidates[index]!),
          row.payload.value.outcome.value
        )
      ) {
        return yield* Effect.fail(new Error("Final filtering selection disagrees with extraction output"));
      }
      if (
        row.payload.value.outcome.kind === "success" &&
        A.length(row.payload.value.outcome.value) !== A.length(citationSpans)
      ) {
        return yield* Effect.fail(new Error("Extraction output/span accounting mismatch"));
      }
      for (const ranges of citationSpans) {
        for (const evidence of [ranges.span, ranges.fullSpan, ranges.spanWithPincite]) {
          const converted = yield* convertTextOffsetRange(
            TextOffsetRange.make({
              start: evidence.python[0],
              end: evidence.python[1],
              unit: "unicode-code-point",
            }),
            document.plainText
          );
          if (
            converted.startChar !== evidence.utf16[0] ||
            converted.endChar !== evidence.utf16[1] ||
            Str.slice(converted.startChar, converted.endChar)(document.plainText) !== evidence.text
          ) {
            return yield* Effect.fail(new Error("Python/UTF-16 coordinate evidence failed exact slice equality"));
          }
        }
      }
    }
    if (
      row.operation === "resolve_citations" &&
      !A.every(row.payload.value.stages.resolutionGroups, (group) =>
        A.every(group.members, (index) => index < A.length(row.payload.value.input.citations))
      )
    ) {
      return yield* Effect.fail(new Error("Resolution group references an absent occurrence"));
    }
  }
  yield* Console.log(
    `Operation evidence valid: ${A.length(report.sourceSites)} source sites, ` +
      `${A.length(report.cases)} observations, ${A.length(R.keys(report.artifacts))} shared artifacts. ` +
      "Model/helper accounting and target parity remain unproved."
  );
});

Effect.runPromise(
  program.pipe(
    Effect.catch(() =>
      Effect.gen(function* () {
        yield* Console.error(
          "Public-operation oracle validation failed; inspect source/site accounting, schemas and hashes."
        );
        process.exitCode = 1;
      })
    )
  )
);
