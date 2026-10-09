import { Context, Effect, Layer, Redacted, Schema, Result, flow } from "effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import { ActionEnvironment } from "./ActionEnvironment.ts";
import { payloadOf, unsignedJwt } from "./internal/jwt.ts";
import { unstubbed } from "./internal/unstubbed.ts";

/**
 * Raised when an OIDC token cannot be issued or read.
 *
 * @public
 */
export class OidcTokenError extends Schema.TaggedError<OidcTokenError>()("OidcTokenError", {
	/**
	 * `unavailable` — the runner did not publish the token-service variables,
	 * which almost always means the workflow is missing `permissions: id-token:
	 * write`. `requestFailed` — the token service could not be reached or refused
	 * the request. `malformedResponse` — it answered with something that is not a
	 * token envelope. `malformedToken` — the token is not a decodable JWT.
	 * `missingClaims` — it decoded, but without the claims a provenance statement
	 * needs.
	 */
	reason: Schema.Literals(["unavailable", "requestFailed", "malformedResponse", "malformedToken", "missingClaims"]),
	/** What was wrong, in one line. */
	detail: Schema.optionalKey(Schema.String),
	/** The HTTP status, when the token service answered. */
	status: Schema.optionalKey(Schema.Finite),
	/** The underlying failure, preserved structurally. */
	cause: Schema.optionalKey(Schema.Defect()),
}) {
	override get message(): string {
		switch (this.reason) {
			case "unavailable":
				return "The runner published no OIDC token service; the workflow needs `permissions: id-token: write`";
			case "requestFailed":
				return `The OIDC token request failed${this.status === undefined ? "" : ` with status ${this.status}`}`;
			case "malformedResponse":
				return "The OIDC token service answered with an unexpected shape";
			case "malformedToken":
				return `The OIDC token is not a decodable JWT${this.detail === undefined ? "" : `: ${this.detail}`}`;
			default:
				return "The OIDC token is missing claims a provenance statement needs";
		}
	}
}

/**
 * The claims a GitHub Actions OIDC token carries about the workflow that ran.
 *
 * @remarks
 * The field names are GitHub's own JWT claim names, kept verbatim rather than
 * translated to the kit's casing. They are an **external vocabulary** — the
 * same strings that appear in a SLSA provenance predicate and in every
 * published example of an Actions OIDC policy — and renaming them would put a
 * translation layer between a consumer and the specification they are reading.
 *
 * @public
 */
export class OidcClaims extends Schema.Class<OidcClaims>("OidcClaims")({
	/** The issuer, e.g. `https://token.actions.githubusercontent.com`. */
	iss: Schema.String,
	/** The full ref the workflow ran on. */
	ref: Schema.String,
	/** The commit. */
	sha: Schema.String,
	/** `owner/repo`. */
	repository: Schema.String,
	/** The event that triggered the run. */
	event_name: Schema.String,
	/** The reusable-workflow ref, which is what a verifier pins against. */
	job_workflow_ref: Schema.String,
	/** The calling workflow's ref. */
	workflow_ref: Schema.String,
	/** The numeric repository id, as a string. */
	repository_id: Schema.String,
	/** The numeric owner id, as a string. */
	repository_owner_id: Schema.String,
	/** `github-hosted` or `self-hosted`. */
	runner_environment: Schema.String,
	/** The run id, as a string. */
	run_id: Schema.String,
	/** The run attempt, as a string. */
	run_attempt: Schema.String,
}) {}

/** The token envelope the runner's token service answers with. */
const TokenEnvelope = Schema.Struct({
	value: Schema.String,
	count: Schema.optionalKey(Schema.Finite),
});

const REQUEST_TOKEN = "ACTIONS_ID_TOKEN_REQUEST_TOKEN";
const REQUEST_URL = "ACTIONS_ID_TOKEN_REQUEST_URL";

/**
 * Read the claims out of a JWT **without verifying its signature**.
 *
 * @remarks
 * The absence of verification is deliberate and is documented on
 * {@link OidcTokenIssuerShape.claims}; do not "fix" it here.
 */
const readClaims = (token: string): Effect.Effect<OidcClaims, OidcTokenError> =>
	Effect.gen(function* () {
		const decoded = yield* Effect.fromResult(payloadOf(token)).pipe(
			Effect.mapError((failure) =>
				failure.kind === "segments"
					? OidcTokenError.make({ reason: "malformedToken", detail: failure.detail })
					: OidcTokenError.make({ reason: "malformedToken", detail: failure.detail, cause: failure.cause }),
			),
		);
		return yield* Schema.decodeUnknownEffect(OidcClaims)(decoded).pipe(
			Effect.mapError((cause) => OidcTokenError.make({ reason: "missingClaims", cause })),
		);
	});

/**
 * The members of the {@link OidcTokenIssuer} service: request an ID `token`
 * and read its decoded `claims`, both failing with {@link OidcTokenError}.
 *
 * @public
 */
export interface OidcTokenIssuerShape {
	/**
	 * Request an ID token, optionally bound to an audience.
	 *
	 * @remarks
	 * Omitting the audience sends no `audience` parameter at all, matching
	 * `@actions/core.getIDToken` — the runner's default audience is not the empty
	 * string.
	 */
	readonly token: (audience?: string) => Effect.Effect<Redacted.Redacted<string>, OidcTokenError>;
	/**
	 * The token's claims, decoded.
	 *
	 * @remarks
	 * **The signature is deliberately not verified**, for three reasons that are
	 * recorded so nobody "fixes" it:
	 *
	 * 1. The token comes from the runner's own token-service endpoint over TLS.
	 *    The transport is the trust boundary, and the process asking for the
	 *    token is the process that received it.
	 * 2. The claims populate a provenance predicate, not a trust decision.
	 *    Nothing branches on them for authorization; they are recorded as
	 *    attested facts about the workflow that ran.
	 * 3. Verifying would need a JWKS fetch, which turns a decode into a network
	 *    call — untestable without a fixture server, and dependent on GitHub's
	 *    key endpoint being reachable at attestation time.
	 *
	 * A consumer that needs a *verified* token needs a different operation with a
	 * different name and a different error channel, not an option on this one.
	 *
	 * Claims are on the surface rather than left to the call site because that is
	 * what makes the provenance path reachable in a test: a double built with
	 * {@link OidcTokenIssuer.layerFor} answers with real, decodable claims, so
	 * a test cannot silently skip the path under test because the double
	 * returned a token that is not a JWT.
	 */
	readonly claims: (audience?: string) => Effect.Effect<OidcClaims, OidcTokenError>;
}

const make = Effect.gen(function* () {
	const env = yield* ActionEnvironment;
	const http = yield* HttpClient.HttpClient;

	const required = (name: string): Effect.Effect<string, OidcTokenError> =>
		env.get(name).pipe(Effect.mapError(() => OidcTokenError.make({ reason: "unavailable", detail: name })));

	/**
	 * The raw JWT, before it is wrapped.
	 *
	 * @remarks
	 * `claims` reads this rather than unwrapping what `token` returns, so
	 * `Redacted.value` does not appear in this module at all — the package's
	 * declassification invariant is that `Secret.ts` is the only place a secret
	 * becomes a string, and a wrap-then-immediately-unwrap here would be a
	 * genuine exception to it rather than a cosmetic one.
	 */
	const issue = Effect.fn("OidcTokenIssuer.token")(function* (audience?: string) {
		const bearer = yield* required(REQUEST_TOKEN);
		const base = yield* required(REQUEST_URL);
		// The runner's URL already carries a query string, so the audience is
		// appended with `&` rather than `?`.
		const url = audience === undefined ? base : `${base}&audience=${encodeURIComponent(audience)}`;

		const response = yield* http
			.execute(HttpClientRequest.get(url).pipe(HttpClientRequest.bearerToken(bearer), HttpClientRequest.acceptJson))
			.pipe(Effect.mapError((cause) => OidcTokenError.make({ reason: "requestFailed", cause })));

		if (response.status < 200 || response.status >= 300) {
			return yield* OidcTokenError.make({ reason: "requestFailed", status: response.status });
		}

		const envelope = yield* HttpClientResponse.schemaBodyJson(TokenEnvelope)(response).pipe(
			Effect.mapError((cause) => OidcTokenError.make({ reason: "malformedResponse", cause })),
		);
		return envelope.value;
	});

	return {
		token: (audience?: string) => Effect.map(issue(audience), Redacted.make),
		claims: Effect.fn("OidcTokenIssuer.claims")(function* (audience?: string) {
			return yield* readClaims(yield* issue(audience));
		}),
	} satisfies OidcTokenIssuerShape;
});

const dies = unstubbed("OidcTokenIssuer.makeTest");

/**
 * The runner's OIDC token service.
 *
 * @remarks
 * Lives here rather than with attestation because it reads
 * `ACTIONS_ID_TOKEN_REQUEST_TOKEN` and `ACTIONS_ID_TOKEN_REQUEST_URL`, which
 * exist only when a workflow declares `permissions: id-token: write` — that is
 * a fact about the runner, not about signing.
 *
 * @example
 * ```ts
 * import { OidcTokenIssuer } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const issuer = yield* OidcTokenIssuer;
 *   const claims = yield* issuer.claims("sigstore");
 *   return claims.job_workflow_ref;
 * });
 * ```
 *
 * @public
 */
export class OidcTokenIssuer extends Context.Service<OidcTokenIssuer, OidcTokenIssuerShape>()(
	"@beep/scratchpad/effected/github-actions/OidcTokenIssuer",
) {
	/**
	 * The live issuer, requesting tokens from the runner's token service.
	 *
	 * @remarks
	 * Fails with {@link OidcTokenError} (`unavailable`) at use when the workflow
	 * lacks `permissions: id-token: write`.
	 */
	static readonly layer: Layer.Layer<OidcTokenIssuer, never, ActionEnvironment | HttpClient.HttpClient> = Layer.effect(
		this,
		make,
	);

	/**
	 * An **unsigned** JWT carrying these claims.
	 *
	 * @remarks
	 * For building test doubles, and nothing else: the signature segment is a
	 * placeholder, so this token would fail any verifier. It exists because a
	 * double returning a synthetic non-JWT would make the provenance path
	 * structurally unreachable in a test.
	 */
	static readonly unsignedTokenFor = (claims: OidcClaims): Redacted.Redacted<string> =>
		Redacted.make(unsignedJwt({ alg: "RS256", typ: "JWT" }, flow(Schema.encodeUnknownResult(OidcClaims), Result.getOrThrowWith((error) => error))(claims)));

	/** A test double. Unstubbed members die rather than answering with a non-token. */
	static readonly makeTest = (overrides: Partial<OidcTokenIssuerShape> = {}): OidcTokenIssuerShape => ({
		token: () => dies("token"),
		claims: () => dies("claims"),
		...overrides,
	});

	/** {@link OidcTokenIssuer.makeTest} behind `Layer.succeed`. */
	static readonly layerTest = (overrides: Partial<OidcTokenIssuerShape> = {}): Layer.Layer<OidcTokenIssuer> =>
		Layer.succeed(OidcTokenIssuer, OidcTokenIssuer.makeTest(overrides));

	/**
	 * A double that answers with these claims, consistently on both members.
	 *
	 * @remarks
	 * `token()` returns a real decodable JWT built from the same claims
	 * `claims()` returns, so a consumer that decodes the token itself and a
	 * consumer that asks the service both see the same thing. A double whose two
	 * members can disagree is how a test proves a path works while production
	 * takes the other one.
	 */
	static readonly layerFor = (claims: OidcClaims): Layer.Layer<OidcTokenIssuer> =>
		Layer.succeed(OidcTokenIssuer, {
			token: Effect.fn("OidcTokenIssuer.token")(() => Effect.succeed(OidcTokenIssuer.unsignedTokenFor(claims))),
			claims: Effect.fn("OidcTokenIssuer.claims")(() => Effect.succeed(claims)),
		});
}
