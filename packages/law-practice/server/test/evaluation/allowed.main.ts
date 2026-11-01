/** Replay every frozen allowed claim set; findings remain unadjudicated. */
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
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { StructuralEvaluationError } from "./Structural.ts";

const AllowedSample = S.Struct({
  selectedSetCount: S.Int,
  selectedClaimCount: S.Int,
  sets: S.Array(
    S.Struct({
      applicationNumber: S.String,
      patentNumber: S.String,
      cpcSection: S.String,
      claimCount: S.Int,
      claimsXmlSha256: S.String,
    })
  ),
});
const ImplementationFreeze = S.Struct({
  implementationDigest: S.String,
  files: S.Array(S.Struct({ path: S.String, sha256: S.String })),
});
const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const encodeReport = S.encodeEffect(S.fromJsonString(PublishedClaimSelfCheckReport));

const allowedSampleJson = S.fromJsonString(AllowedSample);
const implementationFreezeJson = S.fromJsonString(ImplementationFreeze);

const isCompleteSample = (manifest: typeof AllowedSample.Type): boolean =>
  manifest.sets.length === manifest.selectedSetCount &&
  A.reduce(manifest.sets, 0, (total, row) => total + row.claimCount) === manifest.selectedClaimCount &&
  A.dedupe(A.map(manifest.sets, (row) => row.patentNumber)).length === manifest.sets.length;

const program = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const crypto = yield* Crypto.Crypto;
  const output = yield* Config.String("CLAIM_ALLOWED_OUTPUT");
  const implementationFile = yield* Config.String("CLAIM_IMPLEMENTATION_FREEZE");
  const manifestFile = "goals/claim-element-antecedent-check/research/allowed-sampling.json";
  const manifestText = yield* fs.readFileString(manifestFile);
  const manifest = yield* S.decodeEffect(allowedSampleJson)(manifestText);
  const implementation = yield* S.decodeEffect(implementationFreezeJson)(yield* fs.readFileString(implementationFile));
  const digest = (text: string) =>
    crypto.digest("SHA-256", new TextEncoder().encode(text)).pipe(Effect.map(Hex.encode));
  const verifiedText = Effect.fn("AllowedEvaluation.verifiedText")(function* (path: string, expected: string) {
    const text = yield* fs.readFileString(path);
    if ((yield* digest(text)) !== expected)
      return yield* StructuralEvaluationError.make({ message: `Frozen file hash mismatch: ${path}` });
    return text;
  });
  if (!isCompleteSample(manifest))
    return yield* StructuralEvaluationError.make({
      message: "Frozen allowed sample has inconsistent counts or duplicate patents.",
    });
  // Verify the entire source and implementation before emitting any prediction.
  for (const file of implementation.files) yield* verifiedText(file.path, file.sha256);
  const inputs = yield* Effect.forEach(manifest.sets, (row) =>
    verifiedText(
      `packages/law-practice/domain/test/fixtures/claim-element/allowed/${row.patentNumber}.claims.xml`,
      row.claimsXmlSha256
    ).pipe(Effect.map((xml) => ({ row, xml })))
  );
  if (yield* fs.exists(output))
    return yield* StructuralEvaluationError.make({
      message: "Allowed evaluation output already exists; choose a new directory.",
    });
  yield* fs.makeDirectory(output, { recursive: true });
  const rows = yield* Effect.forEach(
    inputs,
    ({ row, xml }, index) =>
      Effect.gen(function* () {
        const alias = `https://api.uspto.gov/evaluation-replay/allowed/${row.patentNumber}.xml`;
        const metadata = yield* encode({
          patentFileWrapperDataBag: [
            {
              applicationNumberText: row.applicationNumber,
              applicationMetaData: { patentNumber: row.patentNumber },
              grantDocumentMetaData: {
                productIdentifier: "PTGRXML",
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
              UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make(row.patentNumber) })
            )
          ).pipe(Effect.provide(context), Effect.result);
        }).pipe(Effect.scoped);
        const progress = Console.log(`Replayed frozen allowed set ${index + 1}/${inputs.length}: ${row.patentNumber}`);
        if (checked._tag === "Success") {
          const report = checked.success;
          if (report.claimSet.claims.length !== row.claimCount)
            return yield* StructuralEvaluationError.make({
              message: `Allowed adapter claim count mismatch: ${row.patentNumber}`,
            });
          yield* fs.writeFileString(`${output}/${row.patentNumber}.prediction.json`, yield* encodeReport(report));
          yield* progress;
          return {
            ...row,
            status: "checked",
            checkedClaims: report.claimSet.claims.length,
            trees: report.report.trees.length,
            undecomposed: report.report.undecomposed.length,
            findings: report.report.findings.length,
          };
        }
        yield* progress;
        return {
          ...row,
          status: "input-failed",
          failureReason: checked.failure.reason,
          failureMessage: checked.failure.message,
        };
      }),
    { concurrency: 1 }
  );
  yield* fs.writeFileString(
    `${output}/results.json`,
    yield* encode({
      schemaVersion: "claim-antecedent-allowed-replay/v1",
      manifestSha256: yield* digest(manifestText),
      implementationDigest: implementation.implementationDigest,
      selectedSetCount: manifest.selectedSetCount,
      selectedClaimCount: manifest.selectedClaimCount,
      transport: "offline recorded native XML with explicit synthetic metadata aliases; no live download",
      actualAttorneyAdjudicationRecorded: false,
      falsePositiveRate: null,
      sets: rows,
    })
  );
});
BunRuntime.runMain(
  Effect.gen(function* () {
    const services = yield* Layer.build(BunServices.layer);
    yield* program.pipe(Effect.provide(services));
  }).pipe(Effect.scoped)
);
