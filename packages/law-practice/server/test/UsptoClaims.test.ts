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
import * as Redacted from "effect/Redacted";
import * as Str from "effect/String";
import { recordedApplication, recordedResponses } from "./UsptoClaims.fixture.ts";

// The real driver over an HTTP client that only replays the recorded responses; nothing leaves the process.
const replayingHttpClient = Layer.succeed(
  HttpClient.HttpClient,
  HttpClient.make((request) =>
    Effect.succeed(
      HttpClientResponse.fromWeb(
        request,
        pipe(
          A.findFirst(recordedResponses, ([suffix]) => Str.endsWith(suffix)(request.url)),
          O.match({
            onNone: () => new Response("", { status: 404 }),
            onSome: ([, body]) => new Response(body, { status: 200 }),
          })
        )
      )
    )
  )
);

const recordedUsptoClaims = UsptoClaimsLive.pipe(
  Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({ apiKey: Redacted.make("synthetic-key") }))),
  Layer.provide(replayingHttpClient)
);

const application = (documentIdentifier?: string) =>
  UsptoClaimSource.cases.application.make({
    applicationNumber: UsptoNormalizedApplicationNumber.make(recordedApplication),
    ...(documentIdentifier === undefined ? {} : { documentIdentifier }),
  });

describe("UsptoClaims adapter", () => {
  it.layer(recordedUsptoClaims, { timeout: "10 seconds" })("over recorded ODP responses", (it) => {
    it.effect("reads the latest full-text claims document into a validated claim set", () =>
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

    it.effect("fails closed on OCR-only, unknown, and publication sources", () =>
      Effect.gen(function* () {
        const port = yield* UsptoClaims;
        const reasonOf = (source: UsptoClaimSource) =>
          Effect.map(Effect.flip(port.claims(source)), ({ reason }) => reason);
        assert.deepStrictEqual(
          yield* Effect.all([
            reasonOf(application("SYNTHCLM1")),
            reasonOf(application("SYNTHCLM9")),
            reasonOf(UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("10123456") })),
          ]),
          ["no-full-text-claims", "not-found", "unavailable"]
        );
      })
    );
  });
});
