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

import { Result } from "effect";
import * as Base64Url from "effect/encoding/Base64Url";

/** Why a token's payload could not be read. @internal */
export type JwtPayloadFailure =
	| { readonly kind: "segments"; readonly detail: string }
	| { readonly kind: "payload"; readonly detail: string; readonly cause: unknown };

/**
 * The decoded payload of `token` — the middle segment, base64url JSON —
 * without any check on the signature.
 *
 * @internal
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
	try {
		return Result.succeed(JSON.parse(json.success) as unknown);
	} catch (cause) {
		return Result.fail({ kind: "payload", detail: "the payload is not base64url JSON", cause });
	}
};

/**
 * An **unsigned** JWT: `header.payload.unsigned`, each JSON segment
 * base64url-encoded. For building test doubles and nothing else — the
 * signature segment is a placeholder, so this token fails any verifier.
 *
 * @internal
 */
export const unsignedJwt = (header: unknown, payload: unknown): string => {
	const segment = (value: unknown): string => Base64Url.encode(JSON.stringify(value));
	return `${segment(header)}.${segment(payload)}.unsigned`;
};
