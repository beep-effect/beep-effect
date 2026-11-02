/**
 * The signed bundle, as a value.
 *
 * **Details**
 *
 * This module imports NOTHING from `@sigstore/*`, deliberately. A bundle is
 * what crosses the seam to `@beep/github`'s attestation upload, and it is what
 * a verifier reads; neither should have to load Fulcio's transport to name the
 * shape. The signer that produces it is deferred as `@beep/sigstore`. The media-type constants are therefore written out rather than
 * re-exported from `@sigstore/bundle`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SbomId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SbomId.create("SigstoreBundle");

/**
 * The Sigstore bundle media type this package produces.
 *
 * **Details**
 *
 * v0.3 with a single certificate — what `DSSEBundleBuilder` emits by default,
 * and what GitHub's `POST /repos/{owner}/{repo}/attestations` accepts.
 *
 * **Example** (Identify the emitted bundle format)
 *
 * ```ts
 * import { SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE } from "@beep/sbom/SigstoreBundle";
 *
 * console.log(SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE) // application/vnd.dev.sigstore.bundle.v0.3+json
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE = "application/vnd.dev.sigstore.bundle.v0.3+json" as const;

/**
 * The DSSE payload type for an in-toto statement, per the GitHub attestations
 * specification.
 *
 * **Example** (Identify the signed statement payload)
 *
 * ```ts
 * import { IN_TOTO_PAYLOAD_TYPE } from "@beep/sbom/SigstoreBundle";
 *
 * console.log(IN_TOTO_PAYLOAD_TYPE) // application/vnd.in-toto+json
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export const IN_TOTO_PAYLOAD_TYPE = "application/vnd.in-toto+json" as const;

/**
 * A signed Sigstore bundle: the wire form of an attestation.
 *
 * **Details**
 *
 * `verificationMaterial` and `dsseEnvelope` are `unknown` because their shapes
 * belong to the Sigstore protobuf specifications, and re-declaring them here
 * would be a second, drifting copy of a wire format this package does not own.
 * The bundle is opaque to everything that merely stores or forwards it.
 *
 * `mediaType` is carried through from what the builder produced rather than
 * asserted — the version is the producer's statement about the bundle, and a
 * literal here would quietly lie the day a builder emits a different one.
 *
 * **Example** (Carry opaque signing material)
 *
 * ```ts
 * import { SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, SigstoreBundle } from "@beep/sbom/SigstoreBundle";
 *
 * const bundle = SigstoreBundle.make({
 *   mediaType: SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
 *   verificationMaterial: {},
 *   dsseEnvelope: {},
 * });
 * console.log(bundle.mediaType) // application/vnd.dev.sigstore.bundle.v0.3+json
 * ```
 *
 * @see {@link https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto | sigstore_bundle.proto} for the bundle wire format
 * @public
 * @category models
 * @since 0.0.0
 */
export class SigstoreBundle extends S.Opaque<SigstoreBundle, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The bundle's media type, usually {@link SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE}. */
    mediaType: S.String.pipe(
      $I.annoteKey("SigstoreBundle.mediaType", {
        description: "The bundle's media type, usually SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE.",
      })
    ),
    /** The certificate and transparency-log entries a verifier checks. */
    verificationMaterial: S.Unknown.pipe(
      $I.annoteKey("SigstoreBundle.verificationMaterial", {
        description: "The certificate and transparency-log entries a verifier checks.",
      })
    ),
    /** The signed DSSE envelope carrying the statement. */
    dsseEnvelope: S.Unknown.pipe(
      $I.annoteKey("SigstoreBundle.dsseEnvelope", { description: "The signed DSSE envelope carrying the statement." })
    ),
  }).pipe(
    $I.annoteSchema("SigstoreBundle", { description: "A signed Sigstore bundle: the wire form of an attestation." })
  )
) {}

/**
 * Companion types for {@link SigstoreBundle}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SigstoreBundle {
  /**
   * The plain object a {@link SigstoreBundle} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SigstoreBundle.Encoded;
}
