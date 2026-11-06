/** Replay the frozen cohort through the real failure-preserving inspection product path. */
import { ClaimElementTree } from "@beep/law-practice-domain/values/ClaimElement";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { UsptoClaimInputsLive } from "@beep/law-practice-server/UsptoClaims";
import {
  ClaimInspection,
  ClaimInspectionLive,
  PublishedClaimInspectionReport,
  UsptoClaimSource,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { compareStructuralFamily, StructuralEvaluationError } from "./Structural.ts";

const ReferenceFreeze = S.Struct({
  referenceSelectionDigest: S.String,
  families: S.Array(
    S.Struct({
      familyId: S.String,
      selectedClaimNumbers: S.Array(S.Int),
      annotationSha256: S.String,
      canonicalClaimsSha256: S.String,
      extractorReceiptSha256: S.String,
      criticReceiptSha256: S.String,
      currentConventionAccepted: S.Boolean,
      attorneyDecisionPending: S.Boolean,
    })
  ),
});
const SourceFreeze = S.Struct({
  sourceSelectionDigest: S.String,
  selection: S.Array(
    S.Struct({
      familyId: S.String,
      applicationNumber: S.String,
      cpcSection: S.String,
      claimsXmlSha256: S.String,
      publicationNumber: S.String,
    })
  ),
});
const ImplementationFreeze = S.Struct({
  implementationDigest: S.String,
  files: S.Array(S.Struct({ path: S.String, sha256: S.String })),
});
const Canonical = S.Struct({ claims: S.Array(S.Struct({ claimNumber: S.Int, claimText: S.String })) });
const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeReport = S.encodeEffect(S.fromJsonString(PublishedClaimInspectionReport));

const referenceFreezeJson = S.fromJsonString(ReferenceFreeze);
const sourceFreezeJson = S.fromJsonString(SourceFreeze);
const implementationFreezeJson = S.fromJsonString(ImplementationFreeze);
const claimElementTreesJson = S.fromJsonString(ClaimElementTree.pipe(S.Array));
const canonicalJson = S.fromJsonString(Canonical);

const sourceNumber = S.FiniteFromString.pipe(S.decodeTo(S.Int.check(S.isGreaterThan(0))));
const decodeSourceNumber = S.decodeOption(sourceNumber);
const sourceRecordFor = (value: PublishedClaimInspectionReport, claimNumber: number) =>
  A.findFirst(value.report.records, (record) =>
    O.exists(
      O.flatMap(record.decomposition.qualification.record.numberText, decodeSourceNumber),
      (number) => number === claimNumber
    )
  );
const treesOf = (value: PublishedClaimInspectionReport) =>
  A.flatMap(value.report.records, ({ decomposition }) =>
    decomposition.status === "decomposed" ? [decomposition.tree] : []
  );

const verifyCanonicalRecord = Effect.fn("InspectionEvaluation.verifyCanonicalRecord")(function* (
  records: PublishedClaimInspectionReport["source"]["input"]["records"],
  expected: (typeof Canonical.Type)["claims"][number],
  familyId: string
) {
  const matches = A.filter(records, (record) =>
    O.exists(O.flatMap(record.numberText, decodeSourceNumber), (number) => number === expected.claimNumber)
  );
  if (matches.length !== 1) {
    return yield* StructuralEvaluationError.make({
      message: `Source identity mismatch: ${familyId}/${expected.claimNumber}`,
    });
  }
  const actual = O.getOrThrow(A.head(matches));
  if (actual.kind === "text" && Str.trim(Str.replace(/\s+/gu, " ")(actual.canonicalText)) !== expected.claimText) {
    return yield* StructuralEvaluationError.make({
      message: `Raw canonical text mismatch: ${familyId}/${expected.claimNumber}`,
    });
  }
});

const verifyCanonicalText = Effect.fn("InspectionEvaluation.verifyCanonicalText")(function* (
  report: PublishedClaimInspectionReport,
  canonical: typeof Canonical.Type,
  familyId: string
) {
  const records = report.source.input.records;
  if (records.length !== canonical.claims.length) {
    return yield* StructuralEvaluationError.make({
      message: `Complete source-record count mismatch: ${familyId}; source=${records.length}, canonical=${canonical.claims.length}`,
    });
  }
  // Check every raw source text, including records that failed normalization.
  // Whitespace canonicalization is exactly the original normalization protocol.
  for (const expected of canonical.claims) {
    yield* verifyCanonicalRecord(records, expected, familyId);
  }
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const digest = yield* Digest.Digest;
  const output = yield* Config.String("CLAIM_EVALUATION_OUTPUT");
  const packet = "goals/claim-element-antecedent-check/research";
  const fixtures = "packages/law-practice/domain/test/fixtures/claim-element/positive";
  const argument = S.decodeEffect(referenceFreezeJson);
  const readFileString1 = yield* fs.readFileString(`${packet}/reference-freeze.json`);
  const reference = yield* argument(readFileString1);
  const argument1 = S.decodeEffect(sourceFreezeJson);
  const readFileString2 = yield* fs.readFileString(`${packet}/positive-source-freeze.json`);
  const sources = yield* argument1(readFileString2);
  const implementationFile = yield* Config.String("CLAIM_IMPLEMENTATION_FREEZE").pipe(
    Config.withDefault(`${packet}/implementation-freeze.json`)
  );
  const argument2 = S.decodeEffect(implementationFreezeJson);
  const readFileString3 = yield* fs.readFileString(implementationFile);
  const implementation = yield* argument2(readFileString3);
  const verifiedText = Effect.fn("PositiveEvaluation.verifiedText")(function* (path: string, expected: string) {
    const text = yield* fs.readFileString(path);
    const digest1 = yield* digest.digest(Digest.sha256, new TextEncoder().encode(text));
    if (Hex.encode(digest1) !== expected) {
      return yield* StructuralEvaluationError.make({ message: `Frozen file hash mismatch: ${path}` });
    }
    return text;
  });
  // Verify the entire baseline before any prediction, not just the next family.
  for (const file of implementation.files) {
    yield* verifiedText(file.path, file.sha256);
  }
  const inputs = yield* Effect.forEach(reference.families, (family) =>
    Effect.gen(function* () {
      const source = yield* Effect.fromOption(
        A.findFirst(sources.selection, (row) => row.familyId === family.familyId)
      );
      const base = `${fixtures}/${family.familyId}`;
      const argument3 = S.decodeEffect(claimElementTreesJson);
      const verifiedText4 = yield* verifiedText(`${base}/expected.json`, family.annotationSha256);
      const gold = yield* argument3(verifiedText4);
      const argument4 = S.decodeEffect(canonicalJson);
      const verifiedText5 = yield* verifiedText(`${base}/claims.json`, family.canonicalClaimsSha256);
      const canonical = yield* argument4(verifiedText5);
      yield* verifiedText(`${base}/extractor.json`, family.extractorReceiptSha256);
      yield* verifiedText(`${base}/critic.json`, family.criticReceiptSha256);
      const xml = yield* verifiedText(`${base}/source.claims.xml`, source.claimsXmlSha256);
      if (
        gold.length !== family.selectedClaimNumbers.length ||
        A.some(family.selectedClaimNumbers, (number) => !A.some(gold, (tree) => tree.claimNumber === number))
      ) {
        return yield* StructuralEvaluationError.make({
          message: `Frozen selected coverage mismatch: ${family.familyId}`,
        });
      }
      return { family, source, gold, canonical, xml };
    })
  );
  if (yield* fs.exists(output)) {
    return yield* StructuralEvaluationError.make({
      message: "Evaluation output already exists; choose a new directory to retain prior evidence.",
    });
  }
  yield* fs.makeDirectory(output, { recursive: true });
  const rows = yield* Effect.forEach(
    inputs,
    ({ family, source, gold, canonical, xml }, index) =>
      Effect.gen(function* () {
        // This URL is an explicit replay alias, never evidence of a live download.
        const alias = `https://api.uspto.gov/evaluation-replay/${source.applicationNumber}.xml`;
        const metadata = yield* encode({
          patentFileWrapperDataBag: [
            {
              applicationNumberText: source.applicationNumber,
              applicationMetaData: { earliestPublicationNumber: source.publicationNumber },
              pgpubDocumentMetaData: {
                productIdentifier: "APPXML",
                xmlFileName: "recorded-native-claims.xml",
                fileLocationURI: alias,
              },
            },
          ],
        });
        const transport = Layer.succeed(
          HttpClient.HttpClient,
          HttpClient.make((request) =>
            Effect.succeed(
              HttpClientResponse.fromWeb(
                request,
                Str.includes("/applications/search?")(request.url)
                  ? new Response(metadata)
                  : request.url === alias
                    ? new Response(xml)
                    : new Response("", { status: 404 })
              )
            )
          )
        );
        const live = ClaimInspectionLive.pipe(
          Layer.provide(UsptoClaimInputsLive),
          Layer.provide(BunCrypto.layer),
          Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({}))),
          Layer.provide(transport)
        );
        const checked = yield* Effect.gen(function* () {
          const context = yield* Layer.build(live);
          return yield* ClaimInspection.use((service) =>
            service.inspectPublished(
              UsptoClaimSource.cases.publication.make({
                publicationNumber: PatentNumber.make(Str.slice(2, 13)(source.publicationNumber)),
              })
            )
          ).pipe(Effect.provideContext(context), Effect.result);
        }).pipe(Effect.scoped);
        const report = checked._tag === "Success" ? O.some(checked.success) : O.none();
        const predicted = O.match(report, { onNone: () => [], onSome: treesOf });
        if (O.isSome(report)) {
          yield* verifyCanonicalText(report.value, canonical, family.familyId);
          const argument5 = `${output}/${family.familyId}.prediction.json`;
          const encodedReport = yield* encodeReport(report.value);
          yield* fs.writeFileString(argument5, encodedReport);
        }
        const scores = yield* compareStructuralFamily(gold, predicted);
        const selected = A.map(scores, (score) => {
          const tree = O.getOrThrow(A.findFirst(gold, (tree) => tree.claimNumber === score.claimNumber));
          const outcome = O.flatMap(report, (value) => sourceRecordFor(value, score.claimNumber));
          const findings = O.match(outcome, {
            onNone: () => [],
            onSome: (value) => (value.status === "unchecked" ? [] : value.findings),
          });
          const parsed = O.exists(
            outcome,
            ({ decomposition }) =>
              decomposition.qualification.status === "context-ready" ||
              decomposition.qualification.status === "context-unavailable"
          );
          const abstained = !O.exists(outcome, (value) => value.status === "complete");
          return {
            ...score,
            parsed,
            abstained,
            sourceOrdinal: O.match(outcome, {
              onNone: () => null,
              onSome: (value) => value.decomposition.qualification.record.sourceOrdinal,
            }),
            inspectionStatus: O.match(outcome, { onNone: () => "source-unavailable", onSome: (value) => value.status }),
            determinerGroups: A.dedupe(
              A.flatMap(tree.elements, (element) => A.map(element.terms, (term) => term.determiner))
            ),
            // Nested means containment below a top-level limitation, not an ordinary root limitation.
            nested: A.some(tree.edges, (edge) => edge.kind === "part-of" && edge.parent !== `${tree.claimNumber}`),
            functional: A.some(tree.edges, (edge) => edge.kind === "functional"),
            rules: A.dedupe(A.map(findings, (finding) => finding.rule)),
            findings: findings.length,
            stage: O.isNone(report)
              ? "input-failed"
              : score.predictionMissing
                ? "undecomposed"
                : score.strict
                  ? "strict-match"
                  : "structural-mismatch",
          };
        });

        yield* Console.log(`Scored frozen family ${index + 1}/${inputs.length}: ${family.familyId}`);
        return {
          familyId: family.familyId,
          cpcSection: source.cpcSection,
          attorneyDecisionPending: family.attorneyDecisionPending,
          currentConventionAccepted: family.currentConventionAccepted,
          inputFailure:
            checked._tag === "Failure" ? { reason: checked.failure.reason, message: checked.failure.message } : null,
          claims: selected,
        };
      }),
    { concurrency: 1 }
  );
  const argument6 = `${output}/results.json`;
  const encoded = yield* encode({
    schemaVersion: "claim-input-inspection-evaluation/v1",
    protocol: "strict-source-input-map/v1",
    provisional: true,
    actualAttorneyAgreementRecorded: false,
    sourceSelectionDigest: sources.sourceSelectionDigest,
    referenceSelectionDigest: reference.referenceSelectionDigest,
    implementationDigest: implementation.implementationDigest,
    transport: "offline recorded XML with explicit synthetic metadata aliases",
    families: rows,
  });
  yield* fs.writeFileString(argument6, encoded);
});
BunRuntime.runMain(
  Effect.gen(function* () {
    const services = yield* Layer.build(Layer.mergeAll(BunServices.layer, BunCrypto.layer));
    yield* program.pipe(Effect.provide(services));
  }).pipe(Effect.scoped)
);
