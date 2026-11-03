import { UsptoNormalizedApplicationNumber } from "@beep/law-practice-domain/values/CitingApplicationIdentity";
import { decomposeClaimInput } from "@beep/law-practice-domain/values/ClaimElement";
import { normalizeClaimInput } from "@beep/law-practice-domain/values/PatentDocument";
import { PatentNumber } from "@beep/law-practice-domain/values/PatentNumber";
import { UsptoClaimInputsLive, UsptoClaimsLive } from "@beep/law-practice-server/UsptoClaims";
import { UsptoClaimInputs, UsptoClaimSource, UsptoClaims } from "@beep/law-practice-use-cases/ClaimSelfCheck";
import { it } from "@beep/test-runner";
import { Uspto, UsptoConfigInput } from "@beep/uspto";
import { assert, describe } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
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
const recordedLayer = (xml: string | Uint8Array, digestLayer: Layer.Layer<Digest.Digest> = Digest.layerWebCrypto) =>
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
    Layer.provide(digestLayer)
  );
const valid =
  '<claims><claim num="00001"><claim-text>1. A fixture comprising a panel.</claim-text></claim><claim num="00002"><claim-text>2. The fixture of claim 1 wherein the panel is metallic.</claim-text></claim></claims>';
const mixed =
  '<claims><claim num="1"><claim-text>1. A fixture comprising a panel.</claim-text></claim><claim num="2"><claim-text>2. A fragment without transition.</claim-text></claim><claim num="3"><claim-text>3. A fixture comprising a sensor.</claim-text></claim><claim num="4"><claim-text>4. The fixture of claim 2 wherein the panel is metallic.</claim-text></claim></claims>';
const irregular =
  '<claims><claim><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="wrong"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="1"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="01"><claim-text>A fixture comprising a panel.</claim-text></claim><claim num="5"/></claims>';

describe("failure-preserving public source adapter", () => {
  it.layer(recordedLayer(valid), { timeout: "10 seconds" })("valid recorded sources", (it) => {
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

  it.layer(recordedLayer(mixed), { timeout: "10 seconds" })("malformed normalization sibling", (it) => {
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

  it.layer(recordedLayer(irregular), { timeout: "10 seconds" })("irregular source numbers", (it) => {
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

  it.layer(recordedLayer("<claims><claim num='00003'>A fixture comprising a panel.</claim></claims>"), {
    timeout: "10 seconds",
  })("single-quoted source number", (it) => {
    it.effect("retains the original literal number and source fragment", () =>
      Effect.gen(function* () {
        const set = yield* (yield* UsptoClaimInputs).inputs(source);
        const record = O.getOrThrow(A.head(set.input.records));
        assertSome(record.numberText, "00003");
        assert.strictEqual(record.sourceText, "<claim num='00003'>A fixture comprising a panel.</claim>");
        assert.strictEqual(record.kind, "text");
      })
    );
  });

  const duplicateNumberRecord = '<claim num="1" num="2">A fixture comprising a panel.</claim>';
  it.layer(
    recordedLayer(`<claims>${duplicateNumberRecord}<claim num="3">A fixture comprising a sensor.</claim></claims>`),
    {
      timeout: "10 seconds",
    }
  )("ambiguous duplicate number attributes", (it) => {
    it.effect(
      "retains the ambiguous record as unavailable instead of selecting an attribute or dropping its sibling",
      () =>
        Effect.gen(function* () {
          const set = yield* (yield* UsptoClaimInputs).inputs(source);
          assert.deepStrictEqual(
            A.map(set.input.records, ({ kind }) => kind),
            ["unavailable", "text"]
          );
          const record = O.getOrThrow(A.head(set.input.records));
          assertNone(record.numberText);
          assert.strictEqual(record.sourceText, duplicateNumberRecord);
          if (record.kind === "unavailable") assert.strictEqual(record.reason, "invalid-text");
        })
    );
  });

  it.layer(recordedLayer(new Uint8Array([0xff, 0xfe])), { timeout: "10 seconds" })("invalid source encoding", (it) => {
    it.effect("rejects non-UTF-8 bytes through both source and strict acquisition without replacement text", () =>
      Effect.gen(function* () {
        const inputFailure = yield* Effect.flip((yield* UsptoClaimInputs).inputs(source));
        const strictFailure = yield* Effect.flip((yield* UsptoClaims).claims(source));
        assert.strictEqual(inputFailure.reason, "no-full-text-claims");
        assert.strictEqual(strictFailure.reason, "no-full-text-claims");
        assert.isTrue(Str.includes("UTF-8")(inputFailure.message));
      })
    );
  });

  const invalidDigest = Layer.succeed(
    Digest.Digest,
    Digest.Digest.of({
      digest: Effect.fn("RecordedDigest.invalidBytes")(() => Effect.succeed(new Uint8Array([0x01]))),
      digestHex: Effect.fn("RecordedDigest.unusedHex")(() =>
        Effect.die("The acquisition hashes bytes, not digestHex.")
      ),
    })
  );
  it.layer(recordedLayer(valid, invalidDigest), { timeout: "10 seconds" })("invalid digest provider result", (it) => {
    it.effect("refuses a source identity when the provider cannot establish a valid SHA-256 digest", () =>
      Effect.gen(function* () {
        const failure = yield* Effect.flip((yield* UsptoClaimInputs).inputs(source));
        assert.strictEqual(failure.reason, "malformed-claims");
        assert.isTrue(Str.includes("digest could not be established")(failure.message));
      })
    );
  });

  for (const [label, xml, reason] of [
    ["missing numeric attribute", "<claims><claim>A fixture comprising a panel.</claim></claims>", "malformed-claims"],
    ["invalid XML text", '<claims><claim num="1">A fixture comprising 3 < 5.</claim></claims>', "malformed-claims"],
    ["empty claim inventory", "<claims/>", "no-full-text-claims"],
    [
      "unsupported claim grammar",
      '<claims><claim num="1">A fragment without a transition.</claim></claims>',
      "malformed-claims",
    ],
  ] as const) {
    it.layer(recordedLayer(xml), { timeout: "10 seconds" })(`strict acquisition failure ${label}`, (it) => {
      it.effect("keeps the original strict failure contract instead of returning repaired claims", () =>
        Effect.gen(function* () {
          const failure = yield* Effect.flip((yield* UsptoClaims).claims(source));
          assert.strictEqual(failure.reason, reason);
        })
      );
    });
  }

  it.layer(recordedLayer(`\n${valid}`), { timeout: "10 seconds" })("changed document bytes", (it) => {
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
    ),
    { timeout: "10 seconds" }
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
    it.layer(recordedLayer(`<claims><claim num="1"><claim-text>${markup}</claim-text></claim></claims>`), {
      timeout: "10 seconds",
    })(`source text ${label}`, (it) => {
      it.effect("retains actual XML text without discarded limitations or leaked metadata", () =>
        Effect.gen(function* () {
          const set = yield* (yield* UsptoClaimInputs).inputs(source);
          const record = O.getOrThrow(A.head(set.input.records));
          assert.strictEqual(record.kind, "text");
          if (record.kind === "text") assert.strictEqual(record.canonicalText, expected);
        })
      );
    });
  }

  it.layer(
    recordedLayer(
      '<claims><claim num="1"><claim-text>A fixture comprising a panel < 5 and > 2.</claim-text></claim></claims>'
    ),
    { timeout: "10 seconds" }
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
    ["container interrupts claim", '<claims><claim num="1"><claims/></claim></claims>', "malformed-claims"],
    ["unmatched container close", "</claims>", "malformed-claims"],
    ["multiple containers", "<claims/><claims/>", "malformed-claims"],
    ["unmatched claim close", "<claims></claim></claims>", "malformed-claims"],
    ["nested claim", '<claims><claim num="1"><claim num="2"/></claim></claims>', "malformed-claims"],
    ["unsupported between-record element", "<claims><note/></claims>", "malformed-claims"],
    ["unterminated trailing metadata", `${valid}<metadata value="unfinished`, "malformed-claims"],
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
    it.layer(recordedLayer(xml), { timeout: "10 seconds" })(`rejected source ${label}`, (it) => {
      it.effect("returns a typed source failure without a clean empty report", () =>
        Effect.gen(function* () {
          const failure = yield* Effect.flip((yield* UsptoClaimInputs).inputs(source));
          assert.strictEqual(failure.reason, reason);
        })
      );
    });
  }
});
