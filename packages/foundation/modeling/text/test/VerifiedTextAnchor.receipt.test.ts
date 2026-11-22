import { PosixPath } from "@beep/schema/PosixPath";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { TextAnchor } from "@beep/text/TextAnchor";
import {
  TextAnchorVerificationReceipt,
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/text/VerifiedTextAnchor";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const ReceiptJson = S.fromJsonString(TextAnchorVerificationReceipt);

const sourceText = "😀 1 U.S. 1; 1 U.S. 1";

// The stored JSON of one receipt, exactly as `S.fromJsonString(TextAnchorVerificationReceipt)` encoded the
// projection of a `verifyTextAnchor` proof before the package became @beep/text. Columns, logs, events and
// the epistemic manifestation key hold these bytes: the literal is never regenerated.
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
      expect(written).toBe(frozenReceipt);

      const read = yield* S.decodeEffect(ReceiptJson)(frozenReceipt);
      expect(read).toEqual(receipt);
      const rewritten = yield* S.encodeEffect(ReceiptJson)(read);
      expect(rewritten).toBe(frozenReceipt);
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
