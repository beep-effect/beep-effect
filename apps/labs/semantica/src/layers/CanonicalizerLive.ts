import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import {
  SourceTextDigest,
  SourceTextIdentity,
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/provenance";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { AnchorRejected } from "@/schema/Errors";
import { Canonicalizer } from "@/services/Canonicalizer";

const utf8Encoder = new TextEncoder();

const makeCanonicalizer = Effect.gen(function* () {
  const crypto = yield* Digest.Digest;
  const hashText = Effect.fn("Canonicalizer.hashText")((text: string) =>
    S.decodeEffect(Sha256HexFromBytes)(utf8Encoder.encode(text)).pipe(
      Effect.provideService(Digest.Digest, crypto),
      Effect.orDie
    )
  );

  return Canonicalizer.of({
    identify: Effect.fn("Canonicalizer.identify")(function* (document, parsed) {
      const textDigest = yield* hashText(parsed.text);
      const identity = SourceTextIdentity.make({
        extractor: parsed.extractor,
        locator: PosixPath.make(document.origin.relativePath),
        normalizationVersion: "raw/1",
        scopeRef: "semantica-canary",
        sourceDigest: SourceTextDigest.make(`sha256:${document.sha256}`),
        sourceRef: document.id,
        textDigest: SourceTextDigest.make(`sha256:${textDigest}`),
      });
      return ResolvedSourceText.make({ identity, text: parsed.text });
    }),
    verify: Effect.fn("Canonicalizer.verify")(function* (canonical, anchor) {
      return yield* verifyTextAnchor(
        VerifyTextAnchorInput.make({
          anchor,
          expectedSource: canonical.identity,
          source: canonical.identity,
          sourceText: canonical.text,
        })
      ).pipe(
        Effect.provideService(Digest.Digest, crypto),
        Effect.mapBoth({
          onFailure: (cause) =>
            AnchorRejected.make({
              cause,
              message: "The candidate anchor does not match the canonical source text.",
            }),
          onSuccess: toTextAnchorVerificationReceipt,
        })
      );
    }),
  });
});

/**
 * Canonicalizer implementation using the shared provenance verifier.
 *
 * **Example** (Inspect the canonicalizer layer)
 *
 * ```ts
 * import { CanonicalizerLive } from "@/layers/CanonicalizerLive"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(CanonicalizerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CanonicalizerLive = Layer.effect(Canonicalizer, makeCanonicalizer);
