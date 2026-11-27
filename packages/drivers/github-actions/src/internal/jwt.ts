import { $GithubActionsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as Base64Url from "effect/encoding/Base64Url";
import * as Function from "effect/Function";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const Json = S.fromJsonString(S.Unknown);
const $I = $GithubActionsId.create("internal/jwt");
const JwtPayloadFailureKind = LiteralKit(["segments", "payload"]).pipe(
  $I.annoteSchema("JwtPayloadFailureKind", { description: "Whether token framing or payload decoding failed." })
);
const PayloadFailureDetail = S.String.pipe(
  $I.annoteKey("JwtPayloadFailure.detail", { description: "Why the token payload could not be read." })
);

/**
 * A token whose framing is wrong: not three segments, or an empty payload.
 *
 * **Example** (Admit a framing failure)
 *
 * ```ts
 * import { JwtSegmentsFailure } from "@beep/github-actions/internal/jwt";
 *
 * const failure = JwtSegmentsFailure.make({ kind: "segments", detail: "expected three segments, got 1" });
 * console.log(failure.kind) // segments
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class JwtSegmentsFailure extends S.Opaque<JwtSegmentsFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: JwtPayloadFailureKind.members[0].pipe(
      $I.annoteKey("JwtPayloadFailure.segments.kind", { description: "Invalid token framing." })
    ),
    detail: PayloadFailureDetail,
  }).pipe($I.annoteSchema("JwtSegmentsFailure", { description: "A JWT whose segment framing is invalid." }))
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JwtSegmentsFailure {
  /**
   * The plain object a {@link JwtSegmentsFailure} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof JwtSegmentsFailure.Encoded;
}

/**
 * A token whose payload segment is not base64url JSON, with the codec failure.
 *
 * **Example** (Admit a payload failure)
 *
 * ```ts
 * import { JwtCodecFailure } from "@beep/github-actions/internal/jwt";
 *
 * const failure = JwtCodecFailure.make({ kind: "payload", detail: "the payload is not base64url JSON", cause: "bad" });
 * console.log(failure.kind) // payload
 * ```
 *
 * @internal
 * @category models
 * @since 0.0.0
 */
export class JwtCodecFailure extends S.Opaque<JwtCodecFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: JwtPayloadFailureKind.members[1].pipe(
      $I.annoteKey("JwtPayloadFailure.payload.kind", { description: "Invalid base64url or JSON payload." })
    ),
    detail: PayloadFailureDetail,
    cause: S.Unknown.pipe(
      $I.annoteKey("JwtPayloadFailure.payload.cause", {
        description: "The underlying codec failure, including explicit undefined.",
      })
    ),
  }).pipe($I.annoteSchema("JwtCodecFailure", { description: "A JWT whose payload is not base64url JSON." }))
) {}

/**
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export declare namespace JwtCodecFailure {
  /**
   * The plain object a {@link JwtCodecFailure} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof JwtCodecFailure.Encoded;
}

/**
 * Why a token's payload could not be read: its framing, or its payload codec.
 *
 * **Example** (Validate JwtPayloadFailure input)
 *
 * ```ts
 * import * as S from "effect/Schema";
 * import { JwtPayloadFailure } from "@beep/github-actions/internal/jwt";
 *
 * const input = { kind: "segments", detail: "expected three JWT segments" };
 * console.log(S.is(JwtPayloadFailure)(input)) // true
 * ```
 *
 * @internal
 * @category schemas
 * @since 0.0.0
 */
export const JwtPayloadFailure = S.Union([JwtSegmentsFailure, JwtCodecFailure]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("JwtPayloadFailure", {
    description: "A JWT failure with a cause required only for payload failures.",
  })
);

/**
 * The failure variants accepted by {@link (JwtPayloadFailure:variable)}.
 *
 * @internal
 * @category type-level
 * @since 0.0.0
 */
export type JwtPayloadFailure = typeof JwtPayloadFailure.Type;

const codecFailure = (cause: unknown): JwtPayloadFailure =>
  JwtCodecFailure.make({ kind: "payload", detail: "the payload is not base64url JSON", cause });

/**
 * The decoded payload of `token` — the middle segment, base64url JSON —
 * without any check on the signature.
 *
 * **Gotchas**
 *
 * Payload decoding deliberately does not verify signatures: runner-issued claims scope requests or are republished for another verifier and never authorize an action here. Keep core Base64Url's strict alphabet decoding, including - and _, rather than Node's forgiving decoder. unsignedJwt is the framing counterpart for token fixtures.
 *
 * **Example** (Read claims from an unsigned fixture)
 *
 * ```ts
 * import { payloadOf, unsignedJwt } from "@beep/github-actions/internal/jwt";
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
  const segments = Str.split(token, ".");
  const payload = segments[1];
  if (segments.length !== 3 || payload === undefined || payload === "") {
    return Result.fail(
      JwtSegmentsFailure.make({ kind: "segments", detail: `expected three segments, got ${segments.length}` })
    );
  }
  const json = Base64Url.decodeString(payload);
  if (Result.isFailure(json)) {
    return json.failure.pipe(codecFailure, Result.fail);
  }
  return Result.mapError(S.decodeResult(Json)(json.success), codecFailure);
};

/**
 * An **unsigned** JWT: `header.payload.unsigned`, each JSON segment
 * base64url-encoded. For building test doubles and nothing else — the
 * signature segment is a placeholder, so this token fails any verifier.
 *
 * **Example** (Build a token with a placeholder signature)
 *
 * ```ts
 * import { unsignedJwt } from "@beep/github-actions/internal/jwt";
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
