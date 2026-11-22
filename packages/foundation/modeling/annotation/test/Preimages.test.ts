import { AnnotationPreimage, GenerationPreimage } from "@beep/annotation/AnnotationId";
import { JsoncFingerprint } from "@beep/jsonc/JsoncFingerprint";
import { DuplicateDomainTag, PreimageRegistry } from "@beep/jsonc/Mint";
import { it } from "@beep/test-runner";
import { OccurrencePreimage } from "@beep/text/Occurrence";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import { sha256 } from "./support/generators.ts";

// The canonical bytes each golden hashes, written out by hand. A plain SHA-256 of these strings gives the recorded
// hashes (section 1.4 of the P3 design), independently of the minting code.
const annotationBytes =
  '["annotation/v1",["sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48"],' +
  '"https://beep-effect.com/ns/annotation/Mention",{"class":"https://beep-effect.com/ns/office-action/distinction"}]';
const generationBytes =
  '["generation/v1","sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9",' +
  '"sha256:2a2b259a63e6402ee336c2e1d4f1023b98bee9880bfa586fface844bca277388"]';

const registry = () => PreimageRegistry.make([AnnotationPreimage, GenerationPreimage]);

describe("@beep/annotation preimages", () => {
  it("registers the two preimages under distinct domain tags and verifies their goldens", () => {
    expect(A.map([AnnotationPreimage, GenerationPreimage], (preimage) => preimage.domainTag)).toEqual([
      "annotation/v1",
      "generation/v1",
    ]);
    assertSuccess(registry().pipe(Result.flatMap((declared) => declared.verifyGoldensResult(sha256))), undefined);
  });

  it("refuses a duplicate domain tag", () => {
    assertFailure(
      PreimageRegistry.make([AnnotationPreimage, GenerationPreimage, AnnotationPreimage]),
      DuplicateDomainTag.make({ domainTag: AnnotationPreimage.domainTag })
    );
  });

  it("hashes the hand-written canonical bytes of each golden", () => {
    for (const [preimage, bytes] of [
      [AnnotationPreimage, annotationBytes],
      [GenerationPreimage, generationBytes],
    ] as const) {
      assertSuccess(
        JsoncFingerprint.canonicalizeResult(A.prepend(preimage.golden.preimage, preimage.domainTag)),
        bytes
      );
    }
    expect(AnnotationPreimage.golden.hash).toBe(
      "sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9"
    );
    expect(GenerationPreimage.golden.hash).toBe(
      "sha256:e1303854ed5d9fddcba55d0d0ae4e4dd5d9ca20c4e4738e0ba643f5696575acd"
    );
  });

  it("chains the goldens: the annotation's target is the occurrence golden, the generation's pair names it", () => {
    expect(AnnotationPreimage.golden.preimage[0]).toEqual([OccurrencePreimage.golden.hash]);
    expect(GenerationPreimage.golden.preimage[0]).toBe(AnnotationPreimage.golden.hash);
  });
});

it.layer(Digest.layerWebCrypto)("@beep/annotation preimages through the Digest service", (it) => {
  it.effect("verifies the two goldens", () =>
    Effect.fromResult(registry()).pipe(Effect.flatMap((declared) => declared.verifyGoldens()))
  );
});
