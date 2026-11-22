import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { DuplicateDomainTag, PreimageRegistry } from "@beep/jsonc/Mint";
import { it } from "@beep/test-runner";
import { CapturePreimage } from "@beep/text/Capture";
import { OccurrencePreimage } from "@beep/text/Occurrence";
import { QuoteKeyPreimage } from "@beep/text/QuoteKey";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sha256 } from "./support/generators.ts";
import { firstCitation } from "./support/goldens.ts";

// The canonical bytes each golden hashes, written out by hand. A plain SHA-256 of these strings gives the recorded
// hashes (section 1.4 of the P2 design), independently of the minting code.
const occurrenceBytes = `["occurrence/v1","matter:example","source:example","documents/source.txt","sha256:${Str.repeat(64)("a")}","sha256:8de1c1a5a8abb0bdb1fc6c7b77a78338e87ab823115cb2dad18003f268e5515f","utf8","1","1","utf16-code-unit",3,11,"1 U.S. 1"]`;
const captureBytes = `["capture/v1","matter:example","source:example","documents/source.txt","sha256:${Str.repeat(64)("a")}","sha256:8de1c1a5a8abb0bdb1fc6c7b77a78338e87ab823115cb2dad18003f268e5515f","utf8","1","1"]`;
const quoteKeyBytes = '["quote-key/v1","nfkc-dehyphenate/v1","1 U.S. 1"]';

const registry = () => PreimageRegistry.make([OccurrencePreimage, QuoteKeyPreimage, CapturePreimage]);

describe("@beep/text preimages", () => {
  it("registers the three preimages under distinct domain tags and verifies their goldens", () => {
    expect(A.map([OccurrencePreimage, QuoteKeyPreimage, CapturePreimage], (preimage) => preimage.domainTag)).toEqual([
      "occurrence/v1",
      "quote-key/v1",
      "capture/v1",
    ]);
    assertSuccess(registry().pipe(Result.flatMap((declared) => declared.verifyGoldensResult(sha256))), undefined);
  });

  it("refuses a duplicate domain tag", () => {
    assertFailure(
      PreimageRegistry.make([OccurrencePreimage, QuoteKeyPreimage, OccurrencePreimage]),
      DuplicateDomainTag.make({ domainTag: OccurrencePreimage.domainTag })
    );
  });

  it("hashes the hand-written canonical bytes of each golden", () => {
    for (const [preimage, bytes] of [
      [OccurrencePreimage, occurrenceBytes],
      [QuoteKeyPreimage, quoteKeyBytes],
      [CapturePreimage, captureBytes],
    ] as const) {
      assertSuccess(
        JsoncFingerprint.canonicalizeResult(A.prepend(preimage.golden.preimage, preimage.domainTag)),
        bytes
      );
    }
    expect(OccurrencePreimage.golden.hash).toBe(
      "sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48"
    );
    expect(QuoteKeyPreimage.golden.hash).toBe(
      "sha256:4d35c407eaeb249dd409c6f6e33515178a35b09ce1bfc6f088dfdf459c69c7ab"
    );
    expect(CapturePreimage.golden.hash).toBe("sha256:c7f8616c75be6548d508e2e6a071d3400673dd915454e7e90d97f26bb967eed6");
  });

  it("decodes the occurrence golden to the anchors row of the first citation", () => {
    assertSuccess(S.decodeResult(OccurrencePreimage.schema)(OccurrencePreimage.golden.preimage), firstCitation);
  });

  it.effect(
    "refuses an occurrence preimage whose range width disagrees with its quote",
    Effect.fnUntraced(function* () {
      const tooWide = O.getOrThrow(A.modify(OccurrencePreimage.golden.preimage, 10, () => 12));
      expect(tooWide).toHaveLength(12);
      const refused = yield* Effect.flip(S.decodeUnknownEffect(OccurrencePreimage.schema)(tooWide));
      expect(S.isSchemaError(refused)).toBe(true);
    })
  );
});

it.layer(Digest.layerWebCrypto)("@beep/text preimages through the Digest service", (it) => {
  it.effect("verifies the three goldens", () =>
    Effect.fromResult(registry()).pipe(Effect.flatMap((declared) => declared.verifyGoldens()))
  );
});
