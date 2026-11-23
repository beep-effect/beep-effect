import { AnnotationPreimage, GenerationPreimage } from "@beep/annotation/AnnotationId";
import { ImportActivityPreimage, ImportedActivityPreimage } from "@beep/annotation/rdf/OaCodec";
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
import * as Str from "effect/String";
import { sha256 } from "./support/generators.ts";

// The canonical bytes each golden hashes, written out by hand. A plain SHA-256 of these strings gives the recorded
// hashes (sections 1.4 and 8.2 of the P3 design), independently of the minting code.
const annotationBytes =
  '["annotation/v1",["sha256:68270708e021dadff3752f9e0d36a435565fdb6015bf7c1cc16e4e9024c54a48"],' +
  '"https://beep-effect.com/ns/annotation/Mention",{"class":"https://beep-effect.com/ns/office-action/distinction"}]';
const generationBytes =
  '["generation/v1","sha256:8a816f6d07f571cb31aba23d9650d0cb67c72ce6832c12b6c89f388b6fd9ddb9",' +
  '"sha256:2a2b259a63e6402ee336c2e1d4f1023b98bee9880bfa586fface844bca277388"]';
const importedActivityBytes = '["imported-activity/v1",{"_tag":"Activity","iri":"https://example.org/activity/1"}]';
const importActivityBytes = `["import-activity/v2","sha256:${Str.repeat(64)("b")}"]`;

const declared = [AnnotationPreimage, GenerationPreimage, ImportedActivityPreimage, ImportActivityPreimage] as const;

const registry = () => PreimageRegistry.make(declared);

describe("@beep/annotation preimages", () => {
  it("registers the four preimages under distinct domain tags and verifies their goldens", () => {
    expect(A.map(declared, (preimage) => preimage.domainTag)).toEqual([
      "annotation/v1",
      "generation/v1",
      "imported-activity/v1",
      "import-activity/v2",
    ]);
    assertSuccess(registry().pipe(Result.flatMap((preimages) => preimages.verifyGoldensResult(sha256))), undefined);
  });

  it("refuses a duplicate domain tag", () => {
    assertFailure(
      PreimageRegistry.make([...declared, ImportActivityPreimage]),
      DuplicateDomainTag.make({ domainTag: ImportActivityPreimage.domainTag })
    );
  });

  it("hashes the hand-written canonical bytes of each golden", () => {
    for (const [preimage, bytes] of [
      [AnnotationPreimage, annotationBytes],
      [GenerationPreimage, generationBytes],
      [ImportedActivityPreimage, importedActivityBytes],
      [ImportActivityPreimage, importActivityBytes],
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
    expect(ImportedActivityPreimage.golden.hash).toBe(
      "sha256:9924f029d9bb4a3a0788bb5c915176e98210d3b4bbd604efd8b2dfc65b6de8fa"
    );
    expect(ImportActivityPreimage.golden.hash).toBe(
      "sha256:9215bcc3db199a3fe273addef7a10334b9e5c3fa1d5eac7e408db8b03bbf2590"
    );
  });

  it("chains the goldens: the annotation's target is the occurrence golden, the generation's pair names it", () => {
    expect(AnnotationPreimage.golden.preimage[0]).toEqual([OccurrencePreimage.golden.hash]);
    expect(GenerationPreimage.golden.preimage[0]).toBe(AnnotationPreimage.golden.hash);
  });
});

it.layer(Digest.layerWebCrypto)("@beep/annotation preimages through the Digest service", (it) => {
  it.effect("verifies the four goldens", () =>
    Effect.fromResult(registry()).pipe(Effect.flatMap((preimages) => preimages.verifyGoldens()))
  );
});
