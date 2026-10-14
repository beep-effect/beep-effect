// The JWT segment codec — read a payload, or frame an unsigned token — for the
// two places this package reads a runner-issued token's claims.
//
// **No signature verification, deliberately.** Every token read here was
// handed to this process by the runner that started it, and the claim read
// scopes a request (`actionsResults`) or is republished for a verifier
// elsewhere (`OidcTokenIssuer`); neither authorizes anything on the strength
// of the claim alone. Do not "fix" it here.
//
// Core `Base64Url` does the base64url work, so no `Buffer` is involved: it is
// strict about the alphabet where Node's decoder is forgiving, which is why
// there is a test whose payload actually contains `-` and `_`.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Function from "effect/Function";
import * as Base64Url from "effect/encoding/Base64Url";

const Json = S.fromJsonString(S.Unknown);
const $I = $ScratchpadId.create("effected/github-actions/internal/jwt");
const JwtPayloadFailureKind = LiteralKit(["segments", "payload"]).annotate(
	$I.annote("JwtPayloadFailureKind", { description: "Whether token framing or payload decoding failed." }),
);
const PayloadFailureDetail = S.String.annotateKey({ description: "Why the token payload could not be read." });

/**
 * Why a token's payload could not be read.
 *
 * **Example** (Validate JwtPayloadFailure input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { JwtPayloadFailure } from "@beep/scratchpad/effected/github-actions/internal/jwt";
 *
 * const input = { kind: "segments", detail: "expected three JWT segments" };
 * Effect.runSync(Console.log(S.is(JwtPayloadFailure)(input))) // true
 * ```
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export const JwtPayloadFailure = S.Union([
	S.Struct({
		kind: JwtPayloadFailureKind.members[0].annotateKey({ description: "Invalid token framing." }),
		detail: PayloadFailureDetail,
	}),
	S.Struct({
		kind: JwtPayloadFailureKind.members[1].annotateKey({ description: "Invalid base64url or JSON payload." }),
		detail: PayloadFailureDetail,
		cause: S.Unknown.annotateKey({ description: "The underlying codec failure, including explicit undefined." }),
	}),
]).pipe(S.toTaggedUnion("kind")).annotate(
	$I.annote("JwtPayloadFailure", { description: "A plain-object JWT failure with a cause required only for payload failures." }),
);

/**
 * The failure variants accepted by {@link JwtPayloadFailure}.
 * @category type-level
 * @since 0.0.0
 */
export type JwtPayloadFailure = typeof JwtPayloadFailure.Type;

/**
 * The decoded payload of `token` — the middle segment, base64url JSON —
 * without any check on the signature.
 *
 * **Example** (Read claims from an unsigned fixture)
 *
 * ```ts
 * import { payloadOf, unsignedJwt } from "@beep/scratchpad/effected/github-actions/internal/jwt";
 * import * as Result from "effect/Result";
 *
 * const token = unsignedJwt({ alg: "none" }, { sub: "test" });
 * console.log(JSON.stringify(Result.getOrThrow(payloadOf(token)))) // {"sub":"test"}
 * ```
 *
 * @internal
 * @category parsing
 * @since 0.0.0
 */
export const payloadOf = (token: string): Result.Result<unknown, JwtPayloadFailure> => {
	const segments = token.split(".");
	const payload = segments[1];
	if (segments.length !== 3 || payload === undefined || payload === "") {
		return Result.fail({ kind: "segments", detail: `expected three segments, got ${segments.length}` });
	}
	const json = Base64Url.decodeString(payload);
	if (Result.isFailure(json)) {
		return Result.fail({ kind: "payload", detail: "the payload is not base64url JSON", cause: json.failure });
	}
	return Result.mapError(S.decodeResult(Json)(json.success), (cause): JwtPayloadFailure => ({
		kind: "payload", detail: "the payload is not base64url JSON", cause,
	}));
};

/**
 * An **unsigned** JWT: `header.payload.unsigned`, each JSON segment
 * base64url-encoded. For building test doubles and nothing else — the
 * signature segment is a placeholder, so this token fails any verifier.
 *
 * **Example** (Build a token with a placeholder signature)
 *
 * ```ts
 * import { unsignedJwt } from "@beep/scratchpad/effected/github-actions/internal/jwt";
 *
 * console.log(unsignedJwt({}, {})) // e30.e30.unsigned
 * ```
 *
 * @internal
 * @category fixtures
 * @since 0.0.0
 */
export const unsignedJwt: {
	(header: unknown, payload: unknown): string;
	(payload: unknown): (header: unknown) => string;
} = Function.dual(2, (header: unknown, payload: unknown): string => {
	const segment = (value: unknown): string => S.encodeResult(Json)(value).pipe(Result.getOrThrow, Base64Url.encode);
	return `${segment(header)}.${segment(payload)}.unsigned`;
});
