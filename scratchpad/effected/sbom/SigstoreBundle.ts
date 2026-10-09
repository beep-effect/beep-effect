// The signed bundle, as a value.
//
// This module imports NOTHING from `@sigstore/*`, deliberately. A bundle is
// what crosses the seam to `@effected/github`'s attestation upload, and it is
// what a verifier reads; neither should have to load Fulcio's transport to name
// the shape. The media-type constants are therefore written out rather than
// re-exported from `@sigstore/bundle`.

import { $ScratchpadId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("effected/sbom/SigstoreBundle");

/**
 * The Sigstore bundle media type this package produces.
 *
 * **Details**
 *
 * v0.3 with a single certificate — what `DSSEBundleBuilder` emits by default,
 * and what GitHub's `POST /repos/{owner}/{repo}/attestations` accepts.
 *
 * @public
 */
export const SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE = "application/vnd.dev.sigstore.bundle.v0.3+json" as const;

/**
 * The DSSE payload type for an in-toto statement, per the GitHub attestations
 * specification.
 *
 * @public
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
 * @see {@link https://github.com/sigstore/protobuf-specs/blob/main/protos/sigstore_bundle.proto | sigstore_bundle.proto} for the bundle wire format
 * @public
 */
export class SigstoreBundle extends S.Class<SigstoreBundle>($I`SigstoreBundle`)({
	/** The bundle's media type, usually {@link SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE}. */
	mediaType: S.String.annotateKey({ description: "The bundle's media type, usually SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE." }),
	/** The certificate and transparency-log entries a verifier checks. */
	verificationMaterial: S.Unknown.annotateKey({ description: "The certificate and transparency-log entries a verifier checks." }),
	/** The signed DSSE envelope carrying the statement. */
	dsseEnvelope: S.Unknown.annotateKey({ description: "The signed DSSE envelope carrying the statement." }),
}, $I.annote("SigstoreBundle", { description: "A signed Sigstore bundle: the wire form of an attestation." })) {}
