import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity";
import { decomposeClaimInput } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizeClaimInput } from "@beep/law-practice-domain/values/PatentDocument";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { UsptoClaimInputsLive, UsptoClaimsLive } from "@beep/law-practice-server/UsptoClaims";
import { UsptoClaimInputs, UsptoClaimSource, UsptoClaims } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import { assert, describe } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { recordedApplication, recordedResponses } from "./UsptoClaims.fixture.ts";

const source = UsptoClaimSource.cases.application.make({
  applicationNumber: UsptoNormalizedApplicationNumber.make(recordedApplication),
});
const publication = UsptoClaimSource.cases.publication.make({ publicationNumber: PatentNumber.make("20260100001") });
const recordedLayer = (xml: string | Uint8Array) =>
  Layer.merge(UsptoClaimsLive, UsptoClaimInputsLive).pipe(
    Layer.provide(Uspto.makeLayer(UsptoConfigInput.make({}))),
    Layer.provide(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make((request) =>
          Effect.succeed(
            HttpClientResponse.fromWeb(
              request,
              Str.endsWith("/SYNTHCLM2.xml")(request.url)
                ? new Response(xml)
                : O.match(
                    A.findFirst(recordedResponses, ([suffix]) => Str.endsWith(suffix)(request.url)),
                    {
                      onNone: () => new Response("", { status: 404 }),
                      onSome: ([, body]) => new Response(body),
                    }
                  )
            )
          )
        )
      )
    ),
    Layer.provide(Digest.layerWebCrypto)
  );
const valid =
  '<claims><claim num="00001"><claim-text>1. A fixture comprising a panel.</claim-text></claim><claim num="00002"><claim-text>2. The fixture of claim 1 wherein the panel is metallic.</claim-text></claim></claims>';
const mixed =
  '<claims><claim num="1"><claim-text>1. A fixture comprising a panel.</claim-text></claim><claim num="2"><claim-text>2. A fragment without transition.</claim-text></claim><claim num="3"><claim-text>3. A fixture comprising a sensor.</claim-text></claim><claim num="4"><claim-text>4. The fixture of claim 2 wherein the panel is metallic.</claim-text></claim></claims>';
const irregular =
  '<claims><claim><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="wrong"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="1"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="01"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="5"/></claims>';

describe("failure-preserving public source adapter", () => {
  it.layer(recordedLayer(valid))("valid recorded sources", (it) => {
    it.effect("matches strict normalization and binds records to independently hashed bytes", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        const strict = yield* (yield* UsptoClaims).claims(source);
        const outcomes = yield* normalizeClaimInput(set.input);
        assert.deepStrictEqual(
          A.map(outcomes, ({ status }) => status),
          ["normalized", "normalized"]
        );
        assert.deepStrictEqual(
          A.getSomes(
            A.map(outcomes, (outcome) => (outcome.status === "normalized" ? O.some(outcome.claim) : O.none()))
          ),
          A.fromIterable(strict.claims)
        );
        assert.strictEqual(
          set.sourceDocumentDigest,
          "sha256:a6ab6e92f287fe9ec19fc6b850c7e465df44bc9080b4ec51ca7ee985d0c82994"
        );
        assert.strictEqual(set.input.sourceKey, `${set.documentIdentifier}:${set.sourceDocumentDigest}`);
        assert.deepStrictEqual(
          A.map(set.input.records, ({ numberText }) => O.getOrNull(numberText)),
          ["00001", "00002"]
        );
      })
    );
    it.effect("also reads the native publication through the real driver", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(publication);
        assert.strictEqual(set.documentIdentifier, "native-publication.xml");
        assert.strictEqual(set.input.records.length, 2);
      })
    );
  });

  it.layer(recordedLayer(mixed))("malformed normalization sibling", (it) => {
    it.effect("actually decomposes independent siblings and retains affected ancestry", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        const outcomes = yield* decomposeClaimInput(set.input);
        assert.deepStrictEqual(
          A.map(outcomes, ({ status }) => status),
          ["decomposed", "unchecked", "decomposed", "unchecked"]
        );
        assert.deepStrictEqual(
          A.map(set.input.records, ({ sourceOrdinal }) => sourceOrdinal),
          [1, 2, 3, 4]
        );
        assert.strictEqual(
          O.getOrThrow(A.get(set.input.records, 1)).sourceText,
          '<claim num="2"><claim-text>2. A fragment without transition.</claim-text></claim>'
        );
      })
    );
  });

  it.layer(recordedLayer(irregular))("irregular source numbers", (it) => {
    it.effect("retains missing, malformed, duplicated and self-closing records", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        assert.strictEqual(set.input.records.length, 5);
        assertNone(set.input.records[0].numberText);
        assert.deepStrictEqual(
          A.map(set.input.records, ({ numberText }) => O.getOrNull(numberText)),
          [null, "wrong", "1", "01", "5"]
        );
        assert.deepStrictEqual(
          A.map(set.input.records, ({ kind }) => kind),
          ["text", "text", "text", "text", "unavailable"]
        );
        const empty = O.getOrThrow(A.last(set.input.records));
        if (empty.kind === "unavailable") assert.strictEqual(empty.reason, "empty-text");
      })
    );
  });

  it.layer(recordedLayer(`\n${valid}`))("changed document bytes", (it) => {
    it.effect("uses the new byte digest even when canonical claim text is unchanged", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        assert.strictEqual(
          set.sourceDocumentDigest,
          "sha256:7d493643db6fe5201e420ced19a615a726adc4bbc1dcfff5ac1e444a76fa5898"
        );
        assert.strictEqual(set.input.sourceKey, `SYNTHCLM2:${set.sourceDocumentDigest}`);
        assert.strictEqual(
          O.getOrThrow(A.head(set.input.records)).sourceText,
          '<claim num="00001"><claim-text>1. A fixture comprising a panel.</claim-text></claim>'
        );
      })
    );
  });

  it.layer(
    recordedLayer(
      '<claims><claim num="1"><claim-text>A fixture comprising 3 < 5.</claim-text></claim><claim num="2"><claim-text>A fixture comprising a panel.</claim-text></claim></claims>'
    )
  )("invalid extracted text", (it) => {
    it.effect("keeps failed text and usable sibling records", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        assert.deepStrictEqual(
          A.map(set.input.records, ({ kind }) => kind),
          ["unavailable", "text"]
        );
        const failed = O.getOrThrow(A.head(set.input.records));
        if (failed.kind === "unavailable") assert.strictEqual(failed.reason, "invalid-text");
      })
    );
  });

  for (const [label, markup, expected] of [
    [
      "CDATA",
      "A fixture comprising a panel <![CDATA[and an optical sensor]]>.",
      "A fixture comprising a panel and an optical sensor.",
    ],
    ["comment", "A fixture comprising a panel <!-- ignored > optical sensor -->.", "A fixture comprising a panel ."],
    [
      "quoted tag attribute",
      'The fixture of <claim-ref title="angle > value">claim 1</claim-ref> wherein the panel is metallic.',
      "The fixture of claim 1 wherein the panel is metallic.",
    ],
  ] as const) {
    it.layer(recordedLayer(`<claims><claim num="1"><claim-text>${markup}</claim-text></claim></claims>`))(
      `source text ${label}`,
      (it) => {
        it.effect("retains actual XML text without discarded limitations or leaked metadata", () =>
          Effect.gen(function* () {
            const set = yield* (yield* UsptoClaimInputs).inputs(source);
            const record = O.getOrThrow(A.head(set.input.records));
            assert.strictEqual(record.kind, "text");
            if (record.kind === "text") assert.strictEqual(record.canonicalText, expected);
          })
        );
      }
    );
  }

  it.layer(
    recordedLayer(
      '<claims><claim num="1"><claim-text>A fixture comprising a panel < 5 and > 2.</claim-text></claim></claims>'
    )
  )("malformed comparisons", (it) => {
    it.effect("abstains on malformed XML instead of erasing text into a successful record", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        const record = O.getOrThrow(A.head(set.input.records));
        assert.strictEqual(record.kind, "unavailable");
        if (record.kind === "unavailable") assert.strictEqual(record.reason, "invalid-text");
        assert.strictEqual(
          record.sourceText,
          '<claim num="1"><claim-text>A fixture comprising a panel < 5 and > 2.</claim-text></claim>'
        );
      })
    );
  });
  for (const [label, xml, reason] of [
    [
      "incomplete",
      '<claims><claim num="1"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="2">unfinished',
      "malformed-claims",
    ],
    [
      "comment spoof",
      '<claims><!-- <claim num="1">A fixture comprising a panel.</claim> --></claims>',
      "malformed-claims",
    ],
    [
      "processing-instruction spoof",
      '<?fixture <claim num="24"><claim-text>A fake fixture comprising a panel.</claim-text></claim> ?><claims><claim num="1"><claim-text>A real fixture comprising a sensor.</claim-text></claim></claims>',
      "malformed-claims",
    ],
    [
      "internal declaration spoof",
      '<!DOCTYPE claims [<!ENTITY demo \'<claim num="24"><claim-text>A fake fixture comprising a panel.</claim-text></claim>\'>]><claims><claim num="1"><claim-text>A real fixture comprising a sensor.</claim-text></claim></claims>',
      "malformed-claims",
    ],
    [
      "outside claims container",
      '<document><description><claim num="24"><claim-text>A fake fixture comprising a panel.</claim-text></claim></description><claims><claim num="1"><claim-text>A real fixture comprising a sensor.</claim-text></claim></claims></document>',
      "malformed-claims",
    ],
    [
      "quoted metadata spoof",
      "<metadata value=\"<claims><claim num='24'><claim-text>A fake fixture comprising a panel.</claim-text></claim></claims>\"/>",
      "no-full-text-claims",
    ],
    [
      "unterminated quoted metadata",
      "<metadata value=\"<claims><claim num='24'><claim-text>A fake fixture comprising a panel.</claim-text></claim></claims>",
      "malformed-claims",
    ],
    ["no records", "<claims/>", "no-full-text-claims"],
    ["OCR", "<claims><OCRConfidenceData/></claims>", "no-full-text-claims"],
  ] as const) {
    it.layer(recordedLayer(xml))(`rejected source ${label}`, (it) => {
      it.effect("returns a typed source failure without a clean empty report", () =>
        Effect.gen(function* () {
          const failure = yield* Effect.flip((yield* UsptoClaimInputs).inputs(source));
          assert.strictEqual(failure.reason, reason);
        })
      );
    });
  }
});
