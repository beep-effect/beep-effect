import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { Anchored } from "@beep/text/Occurrence";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  toTextAnchorVerificationReceipt,
  VerifiedTextAnchor,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/text/VerifiedTextAnchor";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect, expectTypeOf } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const ReceiptJson = S.fromJsonString(TextAnchorVerificationReceipt);
const AnchoredJson = S.fromJsonString(Anchored);
const ProofJson = S.fromJsonString(VerifiedTextAnchor);
const UnknownJson = S.fromJsonString(S.Unknown);

const isProof = S.is(VerifiedTextAnchor);
const decodesAsProof = (candidate: unknown): boolean =>
  Result.isSuccess(S.decodeUnknownResult(VerifiedTextAnchor)(candidate));

const sourceText = "😀 1 U.S. 1; 1 U.S. 1";

const frozenReceipt =
  '{"anchor":{"startChar":3,"endChar":11,"quote":"1 U.S. 1"},"source":{"scopeRef":"matter:example","sourceRef":"source:example","locator":"documents/source.txt","sourceDigest":"sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","textDigest":"sha256:8de1c1a5a8abb0bdb1fc6c7b77a78338e87ab823115cb2dad18003f268e5515f","extractor":{"name":"utf8","version":"1"},"normalizationVersion":"1"}}';

it.layer(BunCrypto.layer, { timeout: "5 seconds" })("stored text anchor receipts", (it) => {
  it.effect(
    "writes and reads the frozen receipt JSON without changing a byte",
    Effect.fnUntraced(function* () {
      const source = SourceTextIdentity.make({
        extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
        locator: PosixPath.make("documents/source.txt"),
        normalizationVersion: "1",
        scopeRef: "matter:example",
        sourceDigest: SourceTextDigest.make(`sha256:${Str.repeat(64)("a")}`),
        sourceRef: "source:example",
        textDigest: SourceTextDigest.make("sha256:8de1c1a5a8abb0bdb1fc6c7b77a78338e87ab823115cb2dad18003f268e5515f"),
      });
      const proof = yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor: TextAnchor.make({ endChar: 11, quote: "1 U.S. 1", startChar: 3 }),
          expectedSource: source,
          source,
          sourceText,
        })
      );
      const receipt = toTextAnchorVerificationReceipt(proof);
      const written = yield* S.encodeEffect(ReceiptJson)(receipt);
      expect(
        written,
        "the receipt JSON encoded before the package became @beep/text; columns, logs, events and the epistemic manifestation key hold these bytes, so the literal is never regenerated"
      ).toBe(frozenReceipt);

      const read = yield* S.decodeEffect(ReceiptJson)(frozenReceipt);
      expect(read).toEqual(receipt);
      const rewritten = yield* S.encodeEffect(ReceiptJson)(read);
      expect(rewritten).toBe(frozenReceipt);
    })
  );

  it.effect(
    "L1-6 a decoded receipt grants no proof without re-verification",
    Effect.fnUntraced(function* () {
      const receipt = yield* S.decodeEffect(ReceiptJson)(frozenReceipt);
      const verify = (text: string) =>
        verifyTextAnchor(
          VerifyTextAnchorInput.make({
            anchor: receipt.anchor,
            expectedSource: receipt.source,
            source: receipt.source,
            sourceText: text,
          })
        );
      const proof = yield* verify(sourceText);
      expect(isProof(proof)).toBe(true);

      const anchoredJson = yield* S.encodeEffect(AnchoredJson)(Anchored.make({ receipt }));
      const anchored = yield* S.decodeEffect(AnchoredJson)(anchoredJson);
      const proofJson = yield* S.encodeEffect(UnknownJson)(proof);
      const proofReadBack = yield* S.decodeEffect(UnknownJson)(proofJson);
      const lookalikesThatSkippedVerification: ReadonlyArray<readonly [string, unknown]> = [
        ["decoded receipt", receipt],
        ["decoded Anchored", anchored],
        ["receipt of a decoded Anchored", anchored.receipt],
        ["spread proof", { ...proof }],
        ["proof fields copied", { anchor: proof.anchor, source: proof.source }],
        ["structured clone", structuredClone(proof)],
        ["forged prototype", Object.create(Object.getPrototypeOf(proof))],
        ["proof JSON read back", proofReadBack],
      ];
      for (const [name, lookalike] of lookalikesThatSkippedVerification) {
        expect(isProof(lookalike), name).toBe(false);
        expect(decodesAsProof(lookalike), name).toBe(false);
        expect(() => toTextAnchorVerificationReceipt(lookalike as VerifiedTextAnchor), name).toThrow();
      }
      for (const json of [frozenReceipt, anchoredJson, proofJson]) {
        const refused = yield* Effect.flip(S.decodeEffect(ProofJson)(json));
        expect(S.isSchemaError(refused), json).toBe(true);
      }

      expectTypeOf<typeof receipt>().not.toExtend<Parameters<typeof toTextAnchorVerificationReceipt>[0]>();
      expectTypeOf<typeof anchored>().not.toExtend<Parameters<typeof toTextAnchorVerificationReceipt>[0]>();

      const reverified = yield* verify(sourceText);
      expect(isProof(reverified), "re-verification against the text the receipt names yields a proof").toBe(true);
      expect(toTextAnchorVerificationReceipt(reverified), "the re-verified proof's receipt is the decoded one").toEqual(
        receipt
      );
      const altered = Str.replace("😀", "😁")(sourceText);
      expect(Str.slice(3, 11)(altered), "altered text keeps its length and the quote in place").toBe(
        receipt.anchor.quote
      );
      const refusal = yield* Effect.flip(verify(altered));
      expect(refusal.reason, "re-verification against altered text is refused").toBe("stale-source");
    })
  );

  it.effect.prop(
    "reads and rewrites any receipt without changing a byte",
    [Arbitrary.schema(TextAnchorVerificationReceipt)],
    ([receipt]) =>
      Effect.gen(function* () {
        const written = yield* S.encodeEffect(ReceiptJson)(receipt);
        const read = yield* S.decodeEffect(ReceiptJson)(written);
        const rewritten = yield* S.encodeEffect(ReceiptJson)(read);
        expect(rewritten).toBe(written);
      }),
    { arbitrary: fcRuns(25) }
  );
});
