import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { UsptoClaimsLive } from "@beep/law-practice-server/UsptoClaims";
import { UsptoClaimSource, UsptoClaims } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import { assert, describe } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { recordedApplication, recordedResponses } from "./UsptoClaims.fixture.ts";

// The real driver over an HTTP client that only replays the recorded responses; nothing leaves the process.
const replayingHttpClient = (responses: typeof recordedResponses, requests: Array<string>) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        requests.push(request.url);
        return HttpClientResponse.fromWeb(
          request,
          pipe(
            A.findFirst(responses, ([suffix]) => Str.endsWith(suffix)(request.url)),
            O.match({
              onNone: () => new Response("", { status: 404 }),
              onSome: ([, body]) => new Response(body, { status: 200 }),
            })
          )
        );
      })
    )
  );

const claimsWithResponses = (responses: typeof recordedResponses, requests: Array<string>) =>
  UsptoClaimsLive.pipe(
    Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({ apiKey: Redacted.make("synthetic-key") }))),
    Layer.provide(replayingHttpClient(responses, requests))
  );
const recordedUsptoClaims = claimsWithResponses(recordedResponses, []);
const tiedResponses = A.map(recordedResponses, ([suffix, body]): (typeof recordedResponses)[number] => [
  suffix,
  Str.endsWith("/documents")(suffix) && P.isString(body)
    ? Str.replace("2025-06-10T00:00:00.000-0400", "2026-03-02T00:00:00.000-0500")(body)
    : body,
]);
const emptySearchRequests: Array<string> = [];
const emptySearchResponses: typeof recordedResponses = A.prepend(recordedResponses, [
  `/applications/search?q=${encodeURIComponent("applicationMetaData.earliestPublicationNumber:US20260100003A*")}`,
  '{"patentFileWrapperDataBag":[]}',
]);

const application = (documentIdentifier?: string) =>
  UsptoClaimSource.cases.application.make({
    applicationNumber: UsptoNormalizedApplicationNumber.make(recordedApplication),
    ...(documentIdentifier === undefined ? {} : { documentIdentifier }),
  });

describe("UsptoClaims adapter", () => {
  it.layer(claimsWithResponses(tiedResponses, []), { timeout: "10 seconds" })("equal official dates", (it) => {
    it.effect("breaks the latest claims-document date tie by descending document identifier", () =>
      Effect.gen(function* () {
        const port = yield* UsptoClaims;
        const claims = yield* port.claims(application());
        assert.strictEqual(claims.documentIdentifier, "SYNTHCLM2");
        assert.strictEqual(claims.claims.length, 2);
      })
    );
  });
  it.layer(claimsWithResponses(emptySearchResponses, emptySearchRequests), { timeout: "10 seconds" })(
    "empty successful publication search",
    (it) => {
      it.effect("reports no matching application without attempting a document download", () =>
        Effect.gen(function* () {
          const port = yield* UsptoClaims;
          const error = yield* port
            .claims(UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20260100003") }))
            .pipe(Effect.flip);
          assert.strictEqual(error.reason, "not-found");
          assert.strictEqual(error.message, "The publication did not resolve to one matching USPTO application.");
          assert.strictEqual(emptySearchRequests.length, 1);
          assert.isTrue(Str.includes("/applications/search?")(A.getUnsafe(emptySearchRequests, 0)));
        })
      );
    }
  );

  it.layer(recordedUsptoClaims, { timeout: "10 seconds" })("over recorded ODP responses", (it) => {
    it.effect("selects XML after PDF in the latest claims document", () =>
      Effect.gen(function* () {
        const claimSet = yield* (yield* UsptoClaims).claims(application());
        assert.strictEqual(claimSet.documentIdentifier, "SYNTHCLM2");
        assert.deepStrictEqual(
          A.map(claimSet.claims, ({ claimNumber, claimText, claimType }) => [claimNumber, claimType, claimText]),
          [
            [
              1,
              "independent",
              "A lamp comprising: a base & a stem; a bulb held by the stem; and a switch wired to the bulb.",
            ],
            [2, "dependent", "The lamp of claim 1, wherein the switch is a toggle switch."],
          ]
        );
      })
    );

    it.effect("reads native publication XML through ODP's individual-record reference", () =>
      Effect.gen(function* () {
        const claimSet = yield* (yield* UsptoClaims).claims(
          UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20260100001") })
        );
        assert.strictEqual(claimSet.documentIdentifier, "native-publication.xml");
        assert.strictEqual(claimSet.claims.length, 2);
        assert.strictEqual(claimSet.claims[0]?.claimNumber, 1);
      })
    );

    it.effect("fails closed on OCR-only, unknown, and publication sources", () =>
      Effect.gen(function* () {
        const port = yield* UsptoClaims;
        const reasonOf = (source: UsptoClaimSource) =>
          Effect.map(Effect.flip(port.claims(source)), ({ reason }) => reason);
        const all1 = yield* Effect.all([
          reasonOf(application("SYNTHCLM1")),
          reasonOf(application("SYNTHCLM9")),
          reasonOf(UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("10123456") })),
        ]);
        assert.deepStrictEqual(all1, ["no-full-text-claims", "not-found", "not-found"]);
      })
    );

    it.effect("excludes OCR grant claims and publications without a native XML reference", () =>
      Effect.gen(function* () {
        const port = yield* UsptoClaims;
        const failureOf = (publicationNumber: string) =>
          Effect.flip(
            port.claims(
              UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make(publicationNumber) })
            )
          );
        const ocr = yield* failureOf("10200001");
        const unreferenced = yield* failureOf("20260100002");
        assert.deepStrictEqual([ocr.reason, unreferenced.reason], ["no-full-text-claims", "no-full-text-claims"]);
        assert.strictEqual(ocr.message, "OCR-derived claims are excluded from the native publication source.");
        assert.strictEqual(unreferenced.message, "The publication has no native XML reference.");
      })
    );
  });
});
