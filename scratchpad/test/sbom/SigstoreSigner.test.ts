// @effect-diagnostics strictEffectProvide:skip-file asyncFunction:skip-file
// Signing, without keys, without OIDC and without a network.
//
// `@sigstore/sign` is built for this: `DSSEBundleBuilder` takes its `Signer`
// and `Witness` by interface, so a test supplies stubs for those two and the
// code under test is the REAL builder — genuine DSSE pre-authentication
// encoding, genuine envelope assembly, genuine protobuf serialization. Nothing
// about the bundle path is mocked away; only the certificate authority and the
// transparency log are.

import { assert, describe, it } from "@effect/vitest";
import { BUNDLE_V03_MEDIA_TYPE } from "@sigstore/bundle";
import type { Signer, Witness } from "@sigstore/sign";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import type { Sha256Digest } from "../../effected/sbom/index.ts";
import {
	IN_TOTO_PAYLOAD_TYPE,
	IdentityToken,
	IdentityTokenError,
	InTotoStatement,
	SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
	SigningError,
	SigstoreBundle,
	SigstoreSigner,
} from "../../effected/sbom/index.ts";

const HEX = "6a13657ec19f43b1d7b95c2f0a1c1e5b8d4f7a206a13657ec19f43b1d7b95c2f";

const statement = InTotoStatement.forSubject({
	name: "pkg:npm/%40effected/sbom@0.1.0",
	digest: HEX as Sha256Digest,
	predicateType: "https://example.test/predicate/v1",
	predicate: { built: true },
});

/**
 * A PEM whose body is arbitrary base64. `pem.toDER` strips the armour and
 * base64-decodes; nothing in the bundle path parses X.509, so a real
 * certificate would prove nothing this does not.
 */
const CERTIFICATE = ["-----BEGIN CERTIFICATE-----", "c3RhbmQtaW4tY2VydGlmaWNhdGU=", "-----END CERTIFICATE-----"].join(
	"\n",
);

const stubSigner = (onSign?: (data: Buffer) => void): Signer => ({
	sign: async (data: Buffer) => {
		onSign?.(data);
		return { signature: Buffer.from("stub-signature"), key: { $case: "x509Certificate", certificate: CERTIFICATE } };
	},
});

const failingSigner = (error: unknown): Signer => ({
	sign: () => Promise.reject(error),
});

const stubWitness = (): Witness => ({
	testify: async () => ({
		tlogEntries: [
			{
				logIndex: "1",
				logId: { keyId: Buffer.from("stub-log") },
				kindVersion: { kind: "dsse", version: "0.0.1" },
				integratedTime: "1753401600",
				inclusionPromise: { signedEntryTimestamp: Buffer.from("stub-set") },
				inclusionProof: undefined,
				canonicalizedBody: Buffer.from("stub-body"),
			},
		],
	}),
});

const failingWitness = (error: unknown): Witness => ({
	testify: () => Promise.reject(error),
});

const CANNED_BUNDLE = SigstoreBundle.make({
	mediaType: SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE,
	verificationMaterial: {},
	dsseEnvelope: {},
});

interface Envelope {
	readonly payload: string;
	readonly payloadType: string;
	readonly signatures: ReadonlyArray<{ readonly sig: string; readonly keyid: string }>;
}

const signWith = (
	options: Parameters<typeof SigstoreSigner.layerWith>[0],
	identity: Layer.Layer<IdentityToken> = IdentityToken.layerTest(),
) =>
	Effect.gen(function* () {
		const signer = yield* SigstoreSigner;
		return yield* signer.sign(statement);
	}).pipe(Effect.provide(SigstoreSigner.layerWith(options).pipe(Layer.provide(identity))));

describe("the media type constant", () => {
	it("matches the one @sigstore/bundle publishes", () => {
		// `SigstoreBundle.ts` must not import `@sigstore/*` — that is the whole
		// confinement claim — so the constant is written out there and checked
		// against the real package HERE, where importing it is allowed.
		assert.strictEqual(SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE, BUNDLE_V03_MEDIA_TYPE);
	});
});

describe("SigstoreSigner.sign — the real DSSE builder", () => {
	it.effect("produces a bundle carrying the statement as its DSSE payload", () =>
		Effect.gen(function* () {
			const bundle = yield* signWith({ signer: stubSigner(), witnesses: [stubWitness()] });
			assert.instanceOf(bundle, SigstoreBundle);
			assert.strictEqual(bundle.mediaType, SIGSTORE_BUNDLE_V0_3_MEDIA_TYPE);

			const envelope = bundle.dsseEnvelope as Envelope;
			assert.strictEqual(envelope.payloadType, IN_TOTO_PAYLOAD_TYPE);
			assert.strictEqual(Buffer.from(envelope.payload, "base64").toString("utf8"), statement.toJson());
			assert.strictEqual(Buffer.from(envelope.signatures[0]?.sig ?? "", "base64").toString("utf8"), "stub-signature");
		}),
	);

	it.effect("signs the DSSE pre-authentication encoding, not the raw statement", () =>
		Effect.gen(function* () {
			// The discriminating assertion that the REAL builder ran: DSSE signs
			// `DSSEv1 <len(type)> <type> <len(body)> <body>`, never the payload
			// alone. A hand-rolled fake would sign the JSON.
			const signed: Array<string> = [];
			yield* signWith({ signer: stubSigner((data) => signed.push(data.toString("utf8"))), witnesses: [] });
			assert.lengthOf(signed, 1);
			const blob = signed[0] ?? "";
			assert.isTrue(
				blob.startsWith(`DSSEv1 ${IN_TOTO_PAYLOAD_TYPE.length} ${IN_TOTO_PAYLOAD_TYPE} `),
				blob.slice(0, 60),
			);
			assert.include(blob, statement.toJson());
		}),
	);

	it.effect("accepts statically-undefined options under exactOptionalPropertyTypes", () =>
		Effect.gen(function* () {
			// The #664 widening, applied here: a Fulcio/Rekor URL read out of config
			// arrives as `string | undefined` and must forward without a spread. The
			// stub signer and witnesses keep the builder off the network.
			const config: { fulcioBaseUrl: string | undefined; rekorBaseUrl: string | undefined } = {
				fulcioBaseUrl: undefined,
				rekorBaseUrl: undefined,
			};
			const bundle = yield* signWith({ ...config, signer: stubSigner(), witnesses: [stubWitness()] });
			assert.instanceOf(bundle, SigstoreBundle);
		}),
	);

	it.effect("carries the witness's transparency-log entries into the verification material", () =>
		Effect.gen(function* () {
			const bundle = yield* signWith({ signer: stubSigner(), witnesses: [stubWitness()] });
			const material = bundle.verificationMaterial as { readonly tlogEntries: ReadonlyArray<{ logIndex: string }> };
			assert.lengthOf(material.tlogEntries, 1);
			assert.strictEqual(material.tlogEntries[0]?.logIndex, "1");
		}),
	);

	it.effect("signs without a transparency log when there are no witnesses", () =>
		Effect.gen(function* () {
			// Worth pinning rather than assuming: protobuf JSON omits empty repeated
			// fields, so an unwitnessed bundle has NO `tlogEntries` key at all — not
			// an empty array. A consumer that reads `.tlogEntries.length` blindly
			// would throw on a legitimately unwitnessed bundle.
			const bundle = yield* signWith({ signer: stubSigner(), witnesses: [] });
			const material = bundle.verificationMaterial as { readonly tlogEntries?: ReadonlyArray<unknown> };
			assert.isUndefined(material.tlogEntries);
			assert.property(material, "certificate");
		}),
	);

	it.effect("asks the identity contract for a token with Sigstore's audience", () =>
		Effect.gen(function* () {
			// The audience constant belongs to the signing protocol, so `sign` takes
			// only a statement and asks for the token itself. This is the assertion
			// that keeps that promise honest.
			const audiences: Array<string> = [];
			const recording = IdentityToken.layerTest({
				// Suspended: a stub that records eagerly logs calls that were only
				// DESCRIBED, never run.
				token: (audience) =>
					Effect.suspend(() => {
						audiences.push(audience);
						return Effect.succeed(Redacted.make("test-identity-token"));
					}),
			});
			yield* signWith({ signer: stubSigner(), witnesses: [] }, recording);
			assert.deepStrictEqual(audiences, ["sigstore"]);
		}),
	);
});

describe("SigstoreSigner.sign — failures, attributed", () => {
	it.effect("an identity failure is kind `identity`", () =>
		Effect.gen(function* () {
			const failing = IdentityToken.layerTest({
				token: (audience) => Effect.fail(IdentityTokenError.make({ audience, cause: new Error("no token service") })),
			});
			const error = yield* Effect.flip(signWith({ signer: stubSigner(), witnesses: [] }, failing));
			assert.instanceOf(error, SigningError);
			assert.strictEqual(error.kind, "identity");
			assert.instanceOf(error.cause, IdentityTokenError);
		}),
	);

	it.effect("a certificate-authority failure is kind `certificate`", () =>
		Effect.gen(function* () {
			// `@sigstore/sign` codes its own failures; reading `code` is what lets
			// the predecessor's 30-line message-scraping cause walker be deleted.
			const cause = Object.assign(new Error("error creating signing certificate"), {
				code: "CA_CREATE_SIGNING_CERTIFICATE_ERROR",
			});
			const error = yield* Effect.flip(signWith({ signer: failingSigner(cause), witnesses: [] }));
			assert.strictEqual(error.kind, "certificate");
			assert.strictEqual(error.cause, cause);
		}),
	);

	it.effect("a transparency-log failure is kind `transparencyLog`", () =>
		Effect.gen(function* () {
			const cause = Object.assign(new Error("error creating tlog entry"), { code: "TLOG_CREATE_ENTRY_ERROR" });
			const error = yield* Effect.flip(signWith({ signer: stubSigner(), witnesses: [failingWitness(cause)] }));
			assert.strictEqual(error.kind, "transparencyLog");
		}),
	);

	it.effect("an unattributable failure is kind `bundle`, not a guess", () =>
		Effect.gen(function* () {
			const error = yield* Effect.flip(signWith({ signer: failingSigner(new Error("something else entirely")) }));
			assert.strictEqual(error.kind, "bundle");
		}),
	);

	it.effect("keeps the original failure structurally rather than as a message", () =>
		Effect.gen(function* () {
			const cause = Object.assign(new Error("fulcio said no"), {
				code: "CA_CREATE_SIGNING_CERTIFICATE_ERROR",
				statusCode: 403,
			});
			const error = yield* Effect.flip(signWith({ signer: failingSigner(cause), witnesses: [] }));
			// The predecessor flattened this into a string and lost the status code.
			assert.strictEqual((error.cause as { statusCode?: number }).statusCode, 403);
		}),
	);
});

describe("SigstoreSigner doubles", () => {
	it("makeTest dies loudly rather than fabricating a bundle", () => {
		// A bundle that looks signed and is not is exactly the failure an
		// attestation exists to prevent, so no honest default answer exists.
		assert.throws(() => SigstoreSigner.makeTest().sign(statement), /not stubbed/);
	});

	it.effect("layerTest answers with whatever a test stubs", () =>
		Effect.gen(function* () {
			const signer = yield* SigstoreSigner;
			assert.strictEqual(yield* signer.sign(statement), CANNED_BUNDLE);
		}).pipe(Effect.provide(SigstoreSigner.layerTest({ sign: () => Effect.succeed(CANNED_BUNDLE) }))),
	);
});
