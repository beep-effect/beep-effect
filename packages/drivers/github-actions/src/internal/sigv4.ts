import { $GithubActionsId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Function from "effect/Function";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { sha256Hex } from "./digest.ts";

const $I = $GithubActionsId.create("internal/sigv4");

// Effect Crypto cannot provide the synchronous HMAC required by SigV4.
const { createHmac } = process.getBuiltinModule("node:crypto");

/**
 * AWS Signature Version 4, for S3-compatible object stores.
 *
 * **Details**
 *
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

const hmac: {
  (key: Uint8Array | string, value: string): Uint8Array;
  (value: string): (key: Uint8Array | string) => Uint8Array;
} = Function.dual(
  2,
  (key: Uint8Array | string, value: string): Uint8Array =>
    new Uint8Array(createHmac("sha256", key).update(value).digest())
);

/**
 * Percent-encode one path segment the way SigV4 requires.
 *
 * **Gotchas**
 *
 * `encodeURIComponent` leaves `!'()*` alone and AWS does not, so a key
 * containing any of them signs one string and requests another — which fails as
 * an opaque `SignatureDoesNotMatch` rather than as anything that names the
 * character. The unreserved set is exactly `A-Za-z0-9-_.~`.
 *
 * **Example** (Encode reserved path characters)
 *
 * ```ts
 * import { uriEncode } from "@beep/github-actions/internal/sigv4"
 *
 * console.log(uriEncode("a b+c")) // a%20b%2Bc
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const uriEncode = (value: string): string =>
  Function.pipe(
    encodeURIComponent(value),
    Str.replaceAll("!", "%21"),
    Str.replaceAll("'", "%27"),
    Str.replaceAll("(", "%28"),
    Str.replaceAll(")", "%29"),
    Str.replaceAll("*", "%2A")
  );

/**
 * The credentials and coordinates a signature needs.
 * **Example** (Validate SigV4Credentials input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import { SigV4Credentials } from "@beep/github-actions/internal/sigv4";
 *
 * const input = { accessKeyId: "example-access", secretAccessKey: "example-secret", region: "us-east-1", service: "s3" };
 * Effect.runSync(Console.log(S.is(SigV4Credentials)(input))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SigV4Credentials extends S.Opaque<SigV4Credentials, { readonly brand: unique symbol }>()(
  S.Struct({
    accessKeyId: S.String.pipe(
      $I.annoteKey("SigV4Credentials.accessKeyId", { description: "The public access key identifier." })
    ),
    secretAccessKey: S.String.pipe(
      $I.annoteKey("SigV4Credentials.secretAccessKey", { description: "The already declassified signing secret." })
    ),
    sessionToken: S.optionalKey(S.String).pipe(
      $I.annoteKey("SigV4Credentials.sessionToken", { description: "A temporary session token, absent otherwise." })
    ),
    region: S.String.pipe($I.annoteKey("SigV4Credentials.region", { description: "The signing region." })),
    /** Almost always `"s3"` here, but the algorithm is not S3-specific. */
    service: S.String.pipe(
      $I.annoteKey("SigV4Credentials.service", { description: "The signing service, usually s3." })
    ),
  }).pipe(
    $I.annoteSchema("SigV4Credentials", {
      description: "Plain-object credentials and coordinates used to sign a request.",
    })
  )
) {}

/**
 * The credential type derived from the executable contract.
 * @category models
 * @since 0.0.0
 */
export declare namespace SigV4Credentials {
  /**
   * The plain object a {@link SigV4Credentials} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SigV4Credentials.Encoded;
}

/**
 * One request to sign.
 * **Example** (Validate SigV4Request input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import * as Console from "effect/Console";
 * import * as Effect from "effect/Effect";
 * import * as DateTime from "effect/DateTime";
 * import { SigV4Request } from "@beep/github-actions/internal/sigv4";
 *
 * const input = { method: "GET", path: "/object.txt", host: "example.s3.amazonaws.com", headers: {}, body: new Uint8Array(), now: DateTime.toDateUtc(DateTime.makeUnsafe("2013-05-24T00:00:00Z")) };
 * Effect.runSync(Console.log(S.is(SigV4Request)(input))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SigV4Request extends S.Opaque<SigV4Request, { readonly brand: unique symbol }>()(
  S.Struct({
    method: S.String.pipe($I.annoteKey("SigV4Request.method", { description: "The HTTP method, preserved verbatim." })),
    /** The raw path; every segment is encoded here, preserving empty segments. */
    path: S.String.pipe(
      $I.annoteKey("SigV4Request.path", { description: "The raw object path, including empty segments." })
    ),
    /** An already encoded endpoint pathname, without a trailing slash. */
    encodedPathPrefix: S.optionalKey(S.String).pipe(
      $I.annoteKey("SigV4Request.encodedPathPrefix", {
        description: "An already encoded endpoint path prefix; omitted requests retain raw-path signing.",
      })
    ),
    host: S.String.pipe(
      $I.annoteKey("SigV4Request.host", { description: "The host and optional port sent to the server." })
    ),
    /** Headers to sign, in any case and any order. */
    headers: S.Record(S.String, S.String).pipe(
      $I.annoteKey("SigV4Request.headers", { description: "String-valued headers in any case and order." })
    ),
    body: S.Uint8Array.pipe($I.annoteKey("SigV4Request.body", { description: "The exact payload bytes." })),
    /** The signing instant. Explicit so a signature is reproducible in a test. */
    now: S.instanceOf(Date).pipe(
      $I.annoteKey("SigV4Request.now", { description: "The explicit JavaScript Date signing instant." })
    ),
  }).pipe(
    $I.annoteSchema("SigV4Request", {
      description: "A plain-object request with the exact payload and reproducible signing instant.",
    })
  )
) {}

/**
 * The request type derived from the executable contract.
 * @category models
 * @since 0.0.0
 */
export declare namespace SigV4Request {
  /**
   * The plain object a {@link SigV4Request} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SigV4Request.Encoded;
}

/** `20130524T000000Z` and `20130524`, the two forms the algorithm uses. */
const timestamps = (now: Date): { readonly amzDate: string; readonly dateStamp: string } => {
  const amzDate = `${Function.pipe(now.toISOString(), Str.replace(/[:-]|\.\d{3}/g, ""), Str.slice(0, 15))}Z`;
  return { amzDate, dateStamp: Str.slice(0, 8)(amzDate) };
};

/**
 * Assemble the headers that will be signed, and the canonical request over them.
 *
 * **Details**
 *
 * Exported separately from {@link sign} so a test can pin it against AWS's
 * **own documented** canonical request rather than against this
 * implementation's output.
 *
 * **Example** (Inspect canonical signing headers)
 *
 * ```ts
 * import { canonicalize } from "@beep/github-actions/internal/sigv4"
 *
 * const request = {
 *   method: "GET",
 *   path: "/object.txt",
 *   host: "example.s3.amazonaws.com",
 *   headers: {},
 *   body: new Uint8Array(),
 *   now: new Date("2013-05-24T00:00:00Z")
 * }
 * const credentials = {
 *   accessKeyId: "example-access-key",
 *   secretAccessKey: "example-secret-key",
 *   region: "us-east-1",
 *   service: "s3"
 * }
 *
 * console.log(canonicalize(request, credentials).signedHeaders) // host;x-amz-content-sha256;x-amz-date
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const canonicalize: {
  (
    request: SigV4Request.Encoded,
    credentials: SigV4Credentials.Encoded
  ): {
    readonly headers: Record<string, string>;
    readonly canonicalRequest: string;
    readonly signedHeaders: string;
    readonly amzDate: string;
    readonly dateStamp: string;
  };
  (
    credentials: SigV4Credentials.Encoded
  ): (request: SigV4Request.Encoded) => {
    readonly headers: Record<string, string>;
    readonly canonicalRequest: string;
    readonly signedHeaders: string;
    readonly amzDate: string;
    readonly dateStamp: string;
  };
} = Function.dual(
  2,
  (
    request: SigV4Request.Encoded,
    credentials: SigV4Credentials.Encoded
  ): {
    readonly headers: Record<string, string>;
    readonly canonicalRequest: string;
    readonly signedHeaders: string;
    readonly amzDate: string;
    readonly dateStamp: string;
  } => {
    const { amzDate, dateStamp } = timestamps(request.now);
    const payloadHash = sha256Hex(request.body);

    const normalized = R.reduce(request.headers, R.empty<string, string>(), (headers, value, name) => {
      const lowered = Str.toLowerCase(name);
      const trimmed = Str.trim(value);
      return R.set(
        headers,
        lowered,
        O.match(R.get(headers, lowered), {
          onNone: () => trimmed,
          onSome: (previous) => `${previous}, ${trimmed}`,
        })
      );
    });
    const signingHeaders: Record<string, string> = {
      ...R.remove(normalized, "authorization"),
      host: request.host,
      "x-amz-date": amzDate,
      "x-amz-content-sha256": payloadHash,
      ...O.getSomesStruct({ "x-amz-security-token": O.fromUndefinedOr(credentials.sessionToken) }),
    };
    const headers = R.map(signingHeaders, Function.flow(Str.trim, Str.replace(/\s+/g, " ")));

    // Canonical headers are lowercased, whitespace-collapsed and sorted by name.
    // The sort is not cosmetic: the signature covers this exact string, so any
    // other order produces a valid-looking signature the server will reject with
    // nothing more informative than `SignatureDoesNotMatch`.
    const canonicalNames = A.sort(R.keys(headers), Order.String);
    const canonicalHeaders = A.join(
      A.map(canonicalNames, (name) => `${name}:${O.getOrThrow(R.get(headers, name))}\n`),
      ""
    );
    const signedHeaders = A.join(canonicalNames, ";");

    const encodedObjectPath = A.join(
      A.map(Str.split(Str.startsWith("/")(request.path) ? request.path : `/${request.path}`, "/"), uriEncode),
      "/"
    );
    const canonicalPath = `${request.encodedPathPrefix ?? ""}${encodedObjectPath}`;

    return {
      headers,
      signedHeaders,
      amzDate,
      dateStamp,
      canonicalRequest: A.join([request.method, canonicalPath, "", canonicalHeaders, signedHeaders, payloadHash], "\n"),
    };
  }
);

/**
 * Derive a signing key.
 *
 * **Details**
 *
 * Four nested HMACs over date, region, service and the literal `aws4_request`.
 * Exported so a test can reproduce AWS's documented derivation example.
 *
 * **Example** (Derive a SHA-256 signing key)
 *
 * ```ts
 * import { signingKey } from "@beep/github-actions/internal/sigv4"
 *
 * const key = signingKey("example-secret-key", "20130524", "us-east-1", "s3")
 * console.log(key.length) // 32
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const signingKey: {
  (secretAccessKey: string, dateStamp: string, region: string, service: string): Uint8Array;
  (dateStamp: string, region: string, service: string): (secretAccessKey: string) => Uint8Array;
} = Function.dual(
  4,
  (secretAccessKey: string, dateStamp: string, region: string, service: string): Uint8Array =>
    hmac(hmac(hmac(hmac(`AWS4${secretAccessKey}`, dateStamp), region), service), "aws4_request")
);

/**
 * Sign a request, returning the headers to send.
 *
 * **Details**
 *
 * The returned record is the caller's headers **plus** everything signing added
 * — `host`, `x-amz-date`, `x-amz-content-sha256`, the optional
 * `x-amz-security-token` and `authorization` — so a caller sends exactly what
 * was signed rather than assembling a second, subtly different set.
 *
 * **Example** (Sign a reproducible S3 request)
 *
 * ```ts
 * import { sign } from "@beep/github-actions/internal/sigv4"
 *
 * const request = {
 *   method: "GET",
 *   path: "/object.txt",
 *   host: "example.s3.amazonaws.com",
 *   headers: {},
 *   body: new Uint8Array(),
 *   now: new Date("2013-05-24T00:00:00Z")
 * }
 * const credentials = {
 *   accessKeyId: "example-access-key",
 *   secretAccessKey: "example-secret-key",
 *   region: "us-east-1",
 *   service: "s3"
 * }
 *
 * console.log(sign(request, credentials)["x-amz-date"]) // 20130524T000000Z
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const sign: {
  (request: SigV4Request.Encoded, credentials: SigV4Credentials.Encoded): Record<string, string>;
  (credentials: SigV4Credentials.Encoded): (request: SigV4Request.Encoded) => Record<string, string>;
} = Function.dual(2, (request: SigV4Request.Encoded, credentials: SigV4Credentials.Encoded): Record<string, string> => {
  const { headers, canonicalRequest, signedHeaders, amzDate, dateStamp } = canonicalize(request, credentials);
  const scope = `${dateStamp}/${credentials.region}/${credentials.service}/aws4_request`;
  const stringToSign = A.join([ALGORITHM, amzDate, scope, sha256Hex(canonicalRequest)], "\n");
  const key = signingKey(credentials.secretAccessKey, dateStamp, credentials.region, credentials.service);
  const signature = Buffer.from(hmac(key, stringToSign)).toString("hex");

  return {
    ...headers,
    authorization: `${ALGORITHM} Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
  };
});

/**
 * The hex SHA-256 of a string, for tests that pin an intermediate.
 *
 * **Example** (Hash an empty payload)
 *
 * ```ts
 * import { digestHex } from "@beep/github-actions/internal/sigv4"
 *
 * console.log(digestHex("")) // e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export { sha256Hex as digestHex };
