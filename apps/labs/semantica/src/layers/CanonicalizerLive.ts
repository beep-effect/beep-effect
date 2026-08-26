import { ResolvedSourceText } from "@beep/file-processing/SourceText";
import {
  SourceTextDigest,
  SourceTextIdentity,
  toTextAnchorVerificationReceipt,
  VerifyTextAnchorInput,
  verifyTextAnchor,
} from "@beep/provenance";
import { PosixPath, Sha256HexFromBytes } from "@beep/schema";
import { Crypto, Effect, Layer } from "effect";
import { AnchorRejected } from "@/schema/Errors";
import { Canonicalizer } from "@/services/Canonicalizer";

const utf8Encoder = new TextEncoder();

const makeCanonicalizer = Effect.gen(function* () {
  const crypto = yield* Crypto.Crypto;
  const hashText = Effect.fn("Canonicalizer.hashText")((text: string) =>
    Sha256HexFromBytes.decodeEffect(utf8Encoder.encode(text)).pipe(
      Effect.provideService(Crypto.Crypto, crypto),
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
        Effect.provideService(Crypto.Crypto, crypto),
        Effect.map(toTextAnchorVerificationReceipt),
        Effect.mapError((cause) =>
          AnchorRejected.make({
            cause,
            message: "The candidate anchor does not match the canonical source text.",
          })
        )
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
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(CanonicalizerLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CanonicalizerLive = Layer.effect(Canonicalizer, makeCanonicalizer);
