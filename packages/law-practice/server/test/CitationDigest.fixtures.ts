/**
 * Digest service doubles for citation identity and resource ownership tests.
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";

/**
 * Derive both digest operations from the same injected byte-producing function.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const makeTestCitationDigest = (
  digest: (typeof Digest.Digest.Service)["digest"]
): typeof Digest.Digest.Service =>
  Digest.Digest.of({
    digest,
    digestHex: (algorithm, bytes) => Effect.map(digest(algorithm, bytes), Hex.encode),
  });
