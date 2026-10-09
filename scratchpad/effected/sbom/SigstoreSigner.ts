// The ONE module that imports `@sigstore/*`.
//
// Everything else in this package — the SBOM emitter, the NTIA report,
// statements, provenance, the bundle value — is pure computation, and a
// consumer that only emits an SBOM must not pull Fulcio's HTTP stack into its
// bundle.
//
// Errors keep the original failure structurally (`cause: Schema.Defect()`) and
// the four `kind` values say which step failed, so no cause-chain flattening
// into a message string is needed.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { bundleToJSON } from "@sigstore/bundle";
import type { IdentityProvider, Signer, Witness } from "@sigstore/sign";
import { DSSEBundleBuilder, FulcioSigner, RekorWitness } from "@sigstore/sign";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Redacted from "effect/Redacted";
import * as S from "effect/Schema";
import type { IdentityTokenShape } from "./IdentityToken.ts";
import { IdentityToken } from "./IdentityToken.ts";
import type { InTotoStatement } from "./InTotoStatement.ts";
import { IN_TOTO_PAYLOAD_TYPE, SigstoreBundle } from "./SigstoreBundle.ts";

const $I = $ScratchpadId.create("effected/sbom/SigstoreSigner");

/**
 * The OIDC audience Sigstore's certificate authority requires.
 *
 * @remarks
 * It lives here, not at the call site, because it is the **signing protocol's**
 * requirement rather than the caller's knowledge — which is why
 * {@link SigstoreSignerShape.sign} takes only a statement and asks the identity
 * contract for a token.
 *
 * @public
 */
export const SIGSTORE_OIDC_AUDIENCE = "sigstore" as const;

/**
 * Which step of signing failed.
 *
 * @public
 */
export const SigningErrorKind = LiteralKit(["identity", "certificate", "transparencyLog", "bundle"]).pipe($I.annoteSchema("SigningErrorKind", { description: "Which step of signing failed." }));

/**
 * The decoded type of {@link (SigningErrorKind:variable)}.
 *
 * @public
 */
export type SigningErrorKind = typeof SigningErrorKind.Type;

/**
 * Raised when a statement cannot be signed.
 *
 * @remarks
 * Sized to what a caller can act on: an `identity` failure is a workflow
 * permissions problem, `certificate` is Fulcio, `transparencyLog` is Rekor, and
 * `bundle` is everything else about assembling the result. The original failure
 * is preserved structurally on `cause` rather than flattened into a message.
 *
 * @public
 */
export class SigningError extends S.TaggedError<SigningError>($I`SigningError`)("SigningError", {
	/** Which step failed. */
	kind: SigningErrorKind.annotateKey({ description: "Which step failed." }),
	/** The underlying failure, preserved structurally. */
	cause: S.Defect().annotateKey({ description: "The underlying failure, preserved structurally." }),
}, $I.annote("SigningError", { description: "Raised when a statement cannot be signed." })) {
	override get message(): string {
		return `Failed to sign the statement (${this.kind})`;
	}
}

// Attribute a `@sigstore/sign` failure to a step.
//
// `InternalError` carries a `code`, which is a far better signal than scraping
// the message text. An unrecognized failure is `bundle` — literally "the bundle
// did not get built" — rather than being guessed into a step it may not belong
// to.
const kindOf = (cause: unknown): SigningErrorKind => {
	const code = P.hasProperty(cause, "code") ? cause.code : undefined;
	if (!P.isString(code)) return "bundle";
	if (code.startsWith("IDENTITY_TOKEN_")) return "identity";
	if (code.startsWith("CA_")) return "certificate";
	// A timestamp authority is not a transparency log, but both are witnesses
	// attesting to the signature after the fact, and a caller acts on them the
	// same way. Kept in one arm rather than adding a fifth.
	if (code.startsWith("TLOG_") || code.startsWith("TSA_")) return "transparencyLog";
	return "bundle";
};

/**
 * Where signing happens, and with what.
 *
 * @remarks
 * The URL overrides exist for the Sigstore **staging** instance, which is what
 * an opt-in end-to-end test points at. `signer` and `witnesses` replace the
 * default Fulcio/Rekor pair outright — the seam that lets a test drive the
 * **real** `DSSEBundleBuilder` with no network, no keys and no OIDC.
 *
 * @public
 */
export interface SigstoreSignerOptions {
	/** Fulcio's base URL. Defaults to the public-good instance. */
	readonly fulcioBaseUrl?: string | undefined;
	/** Rekor's base URL. Defaults to the public-good instance. */
	readonly rekorBaseUrl?: string | undefined;
	/** Replace the certificate signer. */
	readonly signer?: Signer | undefined;
	/** Replace the witnesses. An empty array signs without a transparency log. */
	readonly witnesses?: ReadonlyArray<Witness> | undefined;
}

/**
 * The signing surface.
 *
 * @public
 */
export interface SigstoreSignerShape {
	/**
	 * Sign a statement into a DSSE bundle.
	 *
	 * @remarks
	 * The identity token is fetched, used and discarded inside this call; it is
	 * `Redacted` from the contract to the moment it is handed to Fulcio, and
	 * declassified exactly once, here.
	 */
	readonly sign: (statement: InTotoStatement) => Effect.Effect<SigstoreBundle, SigningError>;
}

const make = (identity: IdentityTokenShape, options: SigstoreSignerOptions): SigstoreSignerShape => ({
	sign: Effect.fn("SigstoreSigner.sign")(function* (statement: InTotoStatement) {
		const token = yield* identity
			.token(SIGSTORE_OIDC_AUDIENCE)
			.pipe(Effect.mapError((cause) => SigningError.make({ kind: "identity", cause })));

		// The single declassification point in this package.
		const identityProvider: IdentityProvider = { getToken: () => Promise.resolve(Redacted.value(token)) };
		const signer =
			options.signer ??
			new FulcioSigner({
				identityProvider,
				...(options.fulcioBaseUrl !== undefined && { fulcioBaseURL: options.fulcioBaseUrl }),
			});
		const witnesses = options.witnesses ?? [
			new RekorWitness({
				entryType: "dsse",
				...(options.rekorBaseUrl !== undefined && { rekorBaseURL: options.rekorBaseUrl }),
			}),
		];
		const builder = new DSSEBundleBuilder({ signer, witnesses: [...witnesses] });

		const bundle = yield* Effect.tryPromise({
			try: () => builder.create({ data: Buffer.from(statement.toJson(), "utf8"), type: IN_TOTO_PAYLOAD_TYPE }),
			catch: (cause) => SigningError.make({ kind: kindOf(cause), cause }),
		});

		return yield* Effect.try({
			try: () => {
				const serialized = bundleToJSON(bundle);
				return SigstoreBundle.make({
					mediaType: serialized.mediaType,
					verificationMaterial: serialized.verificationMaterial,
					dsseEnvelope: serialized.dsseEnvelope,
				});
			},
			catch: (cause) => SigningError.make({ kind: "bundle", cause }),
		});
	}),
});

/** Raised when a signer test double has no signing override. */
class UnstubbedSigstoreSignerError extends S.TaggedError<UnstubbedSigstoreSignerError>($I`UnstubbedSigstoreSignerError`)(
	"UnstubbedSigstoreSignerError",
	{ message: S.String.annotateKey({ description: "Explains why the signer test double requires an explicit signing override." }) },
	$I.annote("UnstubbedSigstoreSignerError", { description: "Raised when a signer test double has no signing override." }),
) {}

const unstubbed = (): never => {
	throw UnstubbedSigstoreSignerError.make({
		message: "SigstoreSigner.makeTest: sign() was called but not stubbed — a fabricated bundle would be a signature-shaped lie. Pass a `sign` override, or drive the real builder through SigstoreSigner.layerWith({ signer, witnesses }).",
	});
};

/**
 * Signs an in-toto statement into a Sigstore DSSE bundle, using a Fulcio
 * certificate and a Rekor transparency-log entry.
 *
 * @remarks
 * Fails with {@link SigningError}. The live {@link (SigstoreSigner:class).layer}
 * requires {@link IdentityToken} in `R`.
 *
 * @example
 * ```ts
 * import type { InTotoStatement } from "./index.ts";
 * import { IdentityToken, SigstoreSigner } from "./index.ts";
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
 *
 * const sign = (statement: InTotoStatement) =>
 *   Effect.gen(function* () {
 *     const signer = yield* SigstoreSigner;
 *     return yield* signer.sign(statement);
 *   });
 *
 * const live = SigstoreSigner.layer.pipe(
 *   Layer.provide(IdentityToken.layerStatic(Redacted.make(process.env.OIDC_TOKEN ?? ""))),
 * );
 * ```
 *
 * @public
 */
export class SigstoreSigner extends Context.Service<SigstoreSigner, SigstoreSignerShape>()(
	$I`SigstoreSigner`,
) {
	/** Signing against the public-good Fulcio and Rekor instances. */
	static readonly layer: Layer.Layer<SigstoreSigner, never, IdentityToken> = Layer.effect(
		this,
		Effect.map(IdentityToken, (identity) => make(identity, {})),
	);

	/** {@link (SigstoreSigner:class).layer} with the signing endpoints, or the signer and witnesses, replaced. */
	static readonly layerWith = (options: SigstoreSignerOptions): Layer.Layer<SigstoreSigner, never, IdentityToken> =>
		Layer.effect(
			SigstoreSigner,
			Effect.map(IdentityToken, (identity) => make(identity, options)),
		);

	/**
	 * An in-memory double whose `sign` **dies** unless stubbed.
	 *
	 * @remarks
	 * The strongest case in the kit for the die-loudly default: no honest
	 * fabricated answer exists, because a bundle that looks signed and is not is
	 * exactly the failure an attestation exists to prevent. A test that wants a
	 * real bundle without a network drives the real builder through
	 * {@link (SigstoreSigner:class).layerWith}.
	 */
	static readonly makeTest = (overrides: Partial<SigstoreSignerShape> = {}): SigstoreSignerShape => ({
		sign: overrides.sign ?? unstubbed,
	});

	/** {@link (SigstoreSigner:class).makeTest} behind a `Layer`. */
	static readonly layerTest = (overrides: Partial<SigstoreSignerShape> = {}): Layer.Layer<SigstoreSigner> =>
		Layer.succeed(SigstoreSigner, SigstoreSigner.makeTest(overrides));
}
