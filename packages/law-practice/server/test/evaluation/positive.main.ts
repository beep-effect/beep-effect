/** Replay frozen native USPTO XML through the real adapter and score every selected claim. */
import { ClaimElementTree, claimNumberOfPath } from "@beep/law-practice-domain/values/ClaimElement";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { UsptoClaimsLive } from "@beep/law-practice-server/UsptoClaims";
import {
  ClaimSelfCheck,
  ClaimSelfCheckLive,
  PublishedClaimSelfCheckReport,
  UsptoClaimSource,
} from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import * as BunRuntime from "@effect/platform-bun/BunRuntime";
import * as BunServices from "@effect/platform-bun/BunServices";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Crypto from "effect/Crypto";
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
const encodeReport = S.encodeEffect(S.fromJsonString(PublishedClaimSelfCheckReport));

const referenceFreezeJson = S.fromJsonString(ReferenceFreeze);
const sourceFreezeJson = S.fromJsonString(SourceFreeze);
const implementationFreezeJson = S.fromJsonString(ImplementationFreeze);
const claimElementTreesJson = S.fromJsonString(ClaimElementTree.pipe(S.Array));
const canonicalJson = S.fromJsonString(Canonical);

const verifyCanonicalText = Effect.fn("PositiveEvaluation.verifyCanonicalText")(function* (
  report: PublishedClaimSelfCheckReport,
  canonical: typeof Canonical.Type,
  familyId: string
) {
  for (const expected of canonical.claims) {
    const actual = A.findFirst(report.claimSet.claims, (claim) => claim.claimNumber === expected.claimNumber);
    if (O.isNone(actual) || actual.value.claimText !== expected.claimText)
      return yield* StructuralEvaluationError.make({
        message: `Adapter canonical text mismatch: ${familyId}/${expected.claimNumber}`,
      });
  }
});

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const crypto = yield* Crypto.Crypto;
  const output = yield* Config.String("CLAIM_EVALUATION_OUTPUT");
  const packet = "goals/claim-element-antecedent-check/research";
  const fixtures = "packages/law-practice/domain/test/fixtures/claim-element/positive";
  const reference = yield* S.decodeEffect(referenceFreezeJson)(
    yield* fs.readFileString(`${packet}/reference-freeze.json`)
  );
  const sources = yield* S.decodeEffect(sourceFreezeJson)(
    yield* fs.readFileString(`${packet}/positive-source-freeze.json`)
  );
  const implementationFile = yield* Config.String("CLAIM_IMPLEMENTATION_FREEZE").pipe(
    Config.withDefault(`${packet}/implementation-freeze.json`)
  );
  const implementation = yield* S.decodeEffect(implementationFreezeJson)(yield* fs.readFileString(implementationFile));
  const verifiedText = Effect.fn("PositiveEvaluation.verifiedText")(function* (path: string, expected: string) {
    const text = yield* fs.readFileString(path);
    if (Hex.encode(yield* crypto.digest("SHA-256", new TextEncoder().encode(text))) !== expected)
      return yield* StructuralEvaluationError.make({ message: `Frozen file hash mismatch: ${path}` });
    return text;
  });
  // Verify the entire baseline before any prediction, not just the next family.
  for (const file of implementation.files) yield* verifiedText(file.path, file.sha256);
  const inputs = yield* Effect.forEach(reference.families, (family) =>
    Effect.gen(function* () {
      const source = yield* Effect.fromOption(
        A.findFirst(sources.selection, (row) => row.familyId === family.familyId)
      );
      const base = `${fixtures}/${family.familyId}`;
      const gold = yield* S.decodeEffect(claimElementTreesJson)(
        yield* verifiedText(`${base}/expected.json`, family.annotationSha256)
      );
      const canonical = yield* S.decodeEffect(canonicalJson)(
        yield* verifiedText(`${base}/claims.json`, family.canonicalClaimsSha256)
      );
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
  if (yield* fs.exists(output))
    return yield* StructuralEvaluationError.make({
      message: "Evaluation output already exists; choose a new directory to retain prior evidence.",
    });
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
        const live = ClaimSelfCheckLive.pipe(
          Layer.provide(UsptoClaimsLive),
          Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({}))),
          Layer.provide(transport)
        );
        const checked = yield* Effect.gen(function* () {
          const context = yield* Layer.build(live);
          return yield* ClaimSelfCheck.use((service) =>
            service.checkPublished(
              UsptoClaimSource.cases.publication.make({
                publicationNumber: PatentNumber.make(Str.slice(2, 13)(source.publicationNumber)),
              })
            )
          ).pipe(Effect.provide(context), Effect.result);
        }).pipe(Effect.scoped);
        const report = checked._tag === "Success" ? O.some(checked.success) : O.none();
        const predicted = O.match(report, { onNone: () => [], onSome: (value) => value.report.trees });
        if (O.isSome(report)) {
          yield* verifyCanonicalText(report.value, canonical, family.familyId);
          yield* fs.writeFileString(`${output}/${family.familyId}.prediction.json`, yield* encodeReport(report.value));
        }
        const scores = yield* compareStructuralFamily(gold, predicted);
        const selected = A.map(scores, (score) => {
          const tree = O.getOrThrow(A.findFirst(gold, (tree) => tree.claimNumber === score.claimNumber));
          const findings = O.match(report, {
            onNone: () => [],
            onSome: (value) =>
              A.filter(
                value.report.findings,
                (finding) => claimNumberOfPath(finding.referring.path) === score.claimNumber
              ),
          });
          return {
            ...score,
            determinerGroups: A.dedupe(
              A.flatMap(tree.elements, (element) => A.map(element.terms, (term) => term.determiner))
            ),
            nested: A.some(tree.edges, (edge) => edge.kind === "part-of"),
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
  yield* fs.writeFileString(
    `${output}/results.json`,
    yield* encode({
      schemaVersion: "claim-antecedent-positive-evaluation/v1",
      protocol: "strict-source-map/v1",
      provisional: true,
      actualAttorneyAgreementRecorded: false,
      sourceSelectionDigest: sources.sourceSelectionDigest,
      referenceSelectionDigest: reference.referenceSelectionDigest,
      implementationDigest: implementation.implementationDigest,
      transport: "offline recorded XML with explicit synthetic metadata aliases",
      families: rows,
    })
  );
});
BunRuntime.runMain(
  Effect.gen(function* () {
    const services = yield* Layer.build(BunServices.layer);
    yield* program.pipe(Effect.provide(services));
  }).pipe(Effect.scoped)
);
