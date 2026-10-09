import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Function from "effect/Function";
import { sha256Hex } from "./digest.ts";
import * as R from "effect/Record";
import * as O from "@beep/utils/Option";

// Effect Crypto cannot provide the synchronous HMAC required by SigV4.
const { createHmac } = process.getBuiltinModule("node:crypto");

/**
 * AWS Signature Version 4, for S3-compatible object stores.
 *
 * @remarks
 * **Pure**, and about a hundred lines, which is the whole argument for not
 * taking an `@aws-sdk/*` dependency to obtain it. Signing is a specified
 * algorithm over strings and HMACs; the SDK around it exists to manage
 * credentials, retries and a service catalogue this package does not want.
 *
 * Native HMAC supplies the synchronous signing primitive; incremental hashing
 * is centralized in `internal/digest.ts`.
 *
 * @internal
 */

const ALGORITHM = "AWS4-HMAC-SHA256";

const hmac = (key: Uint8Array | string, value: string): Uint8Array =>
	new Uint8Array(createHmac("sha256", key).update(value).digest());

/**
 * Percent-encode one path segment the way SigV4 requires.
 *
 * @remarks
 * `encodeURIComponent` leaves `!'()*` alone and AWS does not, so a key
 * containing any of them signs one string and requests another — which fails as
 * an opaque `SignatureDoesNotMatch` rather than as anything that names the
 * character. The unreserved set is exactly `A-Za-z0-9-_.~`.
 */
export const uriEncode = (value: string): string =>
	encodeURIComponent(value).replace(
		/[!'()*]/g,
		(character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
	);

/** The credentials and coordinates a signature needs. */
export interface SigV4Credentials {
	readonly accessKeyId: string;
	readonly secretAccessKey: string;
	readonly sessionToken?: string | undefined;
	readonly region: string;
	/** Almost always `"s3"` here, but the algorithm is not S3-specific. */
	readonly service: string;
}

/** One request to sign. */
export interface SigV4Request {
	readonly method: string;
	/** The raw path; every segment is encoded here, preserving empty segments. */
	readonly path: string;
	readonly host: string;
	/** Headers to sign, in any case and any order. */
	readonly headers: Readonly<Record<string, string>>;
	readonly body: Uint8Array;
	/** The signing instant. Explicit so a signature is reproducible in a test. */
	readonly now: Date;
}

/** `20130524T000000Z` and `20130524`, the two forms the algorithm uses. */
const timestamps = (now: Date): { readonly amzDate: string; readonly dateStamp: string } => {
	const amzDate = `${now
		.toISOString()
		.replace(/[:-]|\.\d{3}/g, "")
		.slice(0, 15)}Z`;
	return { amzDate, dateStamp: amzDate.slice(0, 8) };
};

/**
 * Assemble the headers that will be signed, and the canonical request over them.
 *
 * @remarks
 * Exported separately from {@link sign} so a test can pin it against AWS's
 * **own documented** canonical request rather than against this
 * implementation's output.
 */
export const canonicalize: {
	(request: SigV4Request, credentials: SigV4Credentials): {
	readonly headers: Record<string, string>;
	readonly canonicalRequest: string;
	readonly signedHeaders: string;
	readonly amzDate: string;
	readonly dateStamp: string;
};
	(credentials: SigV4Credentials): (request: SigV4Request) => {
	readonly headers: Record<string, string>;
	readonly canonicalRequest: string;
	readonly signedHeaders: string;
	readonly amzDate: string;
	readonly dateStamp: string;
};
} = Function.dual(2, (
	request: SigV4Request,
	credentials: SigV4Credentials,
): {
	readonly headers: Record<string, string>;
	readonly canonicalRequest: string;
	readonly signedHeaders: string;
	readonly amzDate: string;
	readonly dateStamp: string;
} => {
	const { amzDate, dateStamp } = timestamps(request.now);
	const payloadHash = sha256Hex(request.body);

	const headers: Record<string, string> = {
		...request.headers,
		host: request.host,
		"x-amz-date": amzDate,
		"x-amz-content-sha256": payloadHash,
		...O.getSomesStruct({ "x-amz-security-token": O.fromUndefinedOr(credentials.sessionToken) }),
	};

	// Canonical headers are lowercased, whitespace-collapsed and sorted by name.
	// The sort is not cosmetic: the signature covers this exact string, so any
	// other order produces a valid-looking signature the server will reject with
	// nothing more informative than `SignatureDoesNotMatch`.
	const lowered = MutableHashMap.fromIterable(R.toEntries(headers).map(([name, value]) => [name.toLowerCase(), value] as const));
	const canonicalNames = A.sort(MutableHashMap.keys(lowered), Order.String);
	const canonicalHeaders = canonicalNames
		.map((name) => `${name}:${(O.getOrElse(MutableHashMap.get(lowered, name), () => "")).trim().replace(/\s+/g, " ")}\n`)
		.join("");
	const signedHeaders = canonicalNames.join(";");

	const canonicalPath = A.join(
		A.map(Str.split(Str.startsWith("/")(request.path) ? request.path : `/${request.path}`, "/"), uriEncode),
		"/",
	);

	return {
		headers,
		signedHeaders,
		amzDate,
		dateStamp,
		canonicalRequest: [request.method, canonicalPath, "", canonicalHeaders, signedHeaders, payloadHash].join("\n"),
	};
});

/**
 * Derive a signing key.
 *
 * @remarks
 * Four nested HMACs over date, region, service and the literal `aws4_request`.
 * Exported so a test can reproduce AWS's documented derivation example.
 */
export const signingKey: {
	(secretAccessKey: string, dateStamp: string, region: string, service: string): Uint8Array;
	(dateStamp: string, region: string, service: string): (secretAccessKey: string) => Uint8Array;
} = Function.dual(4, (secretAccessKey: string, dateStamp: string, region: string, service: string): Uint8Array =>
	hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request"));

/**
 * Sign a request, returning the headers to send.
 *
 * @remarks
 * The returned record is the caller's headers **plus** everything signing added
 * — `host`, `x-amz-date`, `x-amz-content-sha256`, the optional
 * `x-amz-security-token` and `authorization` — so a caller sends exactly what
 * was signed rather than assembling a second, subtly different set.
 */
export const sign: {
	(request: SigV4Request, credentials: SigV4Credentials): Record<string, string>;
	(credentials: SigV4Credentials): (request: SigV4Request) => Record<string, string>;
} = Function.dual(2, (request: SigV4Request, credentials: SigV4Credentials): Record<string, string> => {
	const { headers, canonicalRequest, signedHeaders, amzDate, dateStamp } = canonicalize(request, credentials);
	const scope = `${dateStamp}/${credentials.region}/${credentials.service}/aws4_request`;
	const stringToSign = [ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)].join("\n");
	const key = signingKey(credentials.secretAccessKey, dateStamp, credentials.region, credentials.service);
	const signature = Buffer.from(hmac(key, stringToSign)).toString("hex");

	return {
		...headers,
		authorization: `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
	};
});

/** The hex SHA-256 of a string, for tests that pin an intermediate. */
export { sha256Hex as digestHex };
