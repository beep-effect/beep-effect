/**
 * Shared SSRF guard for outbound HTTP(S) requests.
 *
 * Classifies the *literal* hostname or IP of a target URL before any
 * `HttpClient` request is issued and rejects loopback, link-local, RFC1918/ULA
 * private, and cloud-metadata (`169.254.169.254`) targets. This bounds the SSRF
 * surface of drivers that accept attacker-influenced URLs (USPTO, Box, the NLP
 * MCP dataset loaders, and friends): a prompt-injected or malicious caller must
 * not be able to reach those ranges via a literal address.
 *
 * The module exposes a pure boolean predicate ({@link isBlockedRemoteHost}) and
 * two fail-closed Effect assertions ({@link assertAllowedRemoteHost} and
 * {@link assertAllowedRemoteUrl}) that reject with a typed
 * {@link BlockedHostError}. An optional allowlist permits explicitly trusted
 * hosts (matched case-insensitively against the normalized hostname).
 *
 * @remarks
 * By default the guard only inspects the literal hostname/IP and does **not**
 * perform DNS resolution: a public DNS name that resolves to `127.0.0.1` or
 * `169.254.169.254` is not caught unless a resolver is supplied. To close that
 * gap, callers may pass `options.resolve` to {@link assertAllowedRemoteHost} /
 * {@link assertAllowedRemoteUrl}; every resolved A/AAAA address is then run
 * through the same internal-range classifier and the request is rejected if any
 * resolved address is internal.
 *
 * Resolution is opt-in by injection so this foundation schema package stays free
 * of direct `node:dns` I/O (driver packages provide the resolver). Even with a
 * resolver, a DNS-rebinding attacker can return a public address to this guard
 * and an internal address to the subsequent connection (a TOCTOU window):
 * eliminating that residual risk requires pinning the resolved IP at the HTTP
 * client connection layer, which is out of scope for this schema-level guard.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity";
import { TaggedErrorClass } from "@beep/schema/TaggedErrorClass";
import { Effect, Number as N, pipe, Result } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as SchemaUtils from "./SchemaUtils/index.ts";

const $I = $SchemaId.create("SafeRemoteHost");

// Options accepted by the SSRF guard predicate and assertions: an optional
// `allowlist` of hostnames permitted even when they resolve to internal space
// (matched case-insensitively against the normalized hostname), plus an optional
// `resolve` hook injected by callers to resolve a hostname to its A/AAAA
// addresses for post-resolution classification. Inlined at each call site rather
// than exported as a pure-data interface, per schema-first.

// Opt-in DNS resolver: a hostname-to-addresses Effect supplied by driver
// packages so this foundation schema stays free of direct `node:dns` I/O. The
// resolver must surface a `BlockedHostError` (fail-closed) when resolution
// fails, so the guard never proceeds on a name it could not evaluate.
type RemoteHostResolver = (hostname: string) => Effect.Effect<ReadonlyArray<string>, BlockedHostError>;

/**
 * Typed failure raised when a hostname or URL targets internal network space
 * or cannot be parsed into a hostname.
 *
 * Fails closed: an unparseable URL is treated as blocked rather than allowed.
 *
 * @example
 * ```ts
 * import { BlockedHostError } from "@beep/schema"
 * import * as O from "effect/Option"
 *
 * const error = BlockedHostError.make({
 *   host: "169.254.169.254",
 *   url: O.some("http://169.254.169.254/latest/meta-data"),
 *   message: "Refusing to reach a cloud metadata endpoint: 169.254.169.254",
 *   cause: O.none()
 * })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class BlockedHostError extends TaggedErrorClass<BlockedHostError>($I`BlockedHostError`)(
  "BlockedHostError",
  {
    host: S.String.annotateKey({
      description: "Normalized hostname that was rejected (lowercased, brackets stripped).",
    }),
    url: S.OptionFromOptionalKey(S.String).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Originating URL when the guard was invoked on a full URL.",
      })
    ),
    message: S.String.annotateKey({
      description: "Safe diagnostic message explaining why the host was blocked.",
    }),
    cause: S.OptionFromOptionalKey(S.Defect({ includeStack: true })).pipe(
      SchemaUtils.withNoneDefault,
      S.annotateKey({
        description: "Underlying parse failure when the URL could not be decoded.",
      })
    ),
  },
  $I.annote("BlockedHostError", {
    description: "Raised when an outbound request targets internal network space or an unparseable URL.",
  })
) {}

/**
 * Normalize a hostname for comparison: lowercase and strip the surrounding
 * brackets that wrap IPv6 literals (e.g. `[::1]` becomes `::1`).
 */
const normalizeHost = (hostname: string): string => pipe(Str.toLowerCase(hostname), Str.replace(/^\[|\]$/g, ""));

/**
 * Report whether a normalized host is present in an optional allowlist.
 */
const isAllowlisted = (host: string, allowlist: ReadonlyArray<string> | undefined): boolean =>
  pipe(
    O.fromNullishOr(allowlist),
    O.map(A.map(normalizeHost)),
    O.map((entries) => A.contains(entries, host)),
    O.getOrElse(() => false)
  );

/**
 * Classify a bare IPv4 dotted-quad host as loopback, link-local, RFC1918
 * private, or cloud-metadata space. Shared by the direct-IPv4 path and by the
 * IPv4 embedded in an IPv4-mapped IPv6 address (see {@link extractMappedIpv4}),
 * so a mapped address can never reach a range that its bare form would block.
 */
const isInternalIpv4 = (host: string): boolean =>
  Str.startsWith("127.")(host) ||
  Str.startsWith("169.254.")(host) ||
  Str.startsWith("10.")(host) ||
  Str.startsWith("192.168.")(host) ||
  isPrivate172(host);

/**
 * Decode the IPv4 embedded in an IPv4-mapped IPv6 host into dotted-decimal form.
 *
 * `new URL(...).hostname` normalizes IPv4-mapped IPv6 to compressed *hex*
 * (`::ffff:192.168.1.1` becomes `::ffff:c0a8:101`), so a dotted-prefix check
 * never fires for URL-parsed input — that gap let `http://[::ffff:c0a8:101]/`
 * reach `192.168.1.1`. Both the hex suffix (`::ffff:hhhh:hhhh`) and the dotted
 * suffix (`::ffff:a.b.c.d`, reachable for raw-host callers) are decoded so mapped
 * RFC1918/loopback/link-local space classifies identically to its bare IPv4
 * form. Returns none for non-mapped hosts.
 */
const extractMappedIpv4 = (host: string): O.Option<string> =>
  pipe(
    Str.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/)(host),
    O.flatMap((groups) => O.all([A.get(groups, 1), A.get(groups, 2)])),
    O.map(([hi, lo]) => {
      const high = Number.parseInt(hi, 16);
      const low = Number.parseInt(lo, 16);
      return `${(high >> 8) & 0xff}.${high & 0xff}.${(low >> 8) & 0xff}.${low & 0xff}`;
    }),
    O.orElse(() => pipe(Str.match(/^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/)(host), O.flatMap(A.get(1))))
  );

/**
 * Core blocked-host classifier mirroring the loopback, link-local,
 * RFC1918/ULA private, and cloud-metadata ranges blocked by the dataset loader.
 */
// SSRF host classifier: the explicit loopback/link-local/RFC1918/ULA/metadata
// range checks are intentionally exhaustive and flat for auditability; folding
// them behind abstraction would obscure which ranges are blocked. IPv4-mapped
// IPv6 is decoded back to its IPv4 form (extractMappedIpv4) so mapped private
// ranges classify through the same isInternalIpv4 checks.
// fallow-ignore-next-line complexity -- flat SSRF checks keep every blocked network class independently auditable
const isInternalHost = (host: string): boolean =>
  // SSRF guard duplicated with @beep/nlp-mcp DatasetLoader.isBlockedRemoteHost by
  // design: each slice owns a self-contained, independently auditable blocklist
  // rather than coupling a foundation schema to a driver's internals.
  // fallow-ignore-next-line code-duplication -- SSRF blocklist mirrors DatasetLoader for independent security auditing
  host === "localhost" ||
  Str.endsWith(".localhost")(host) ||
  host === "0.0.0.0" ||
  host === "::" ||
  host === "::1" ||
  Str.startsWith("fe80:")(host) ||
  Str.startsWith("fc")(host) ||
  Str.startsWith("fd")(host) ||
  isInternalIpv4(host) ||
  O.exists(extractMappedIpv4(host), isInternalIpv4);

/**
 * RFC1918 `172.16.0.0/12` covers `172.16.` through `172.31.`; check the second
 * octet explicitly rather than with a broad `172.` prefix that would also block
 * public `172.x` addresses.
 */
const parsePrivate172SecondOctet = (host: string): O.Option<number> =>
  pipe(
    Str.match(/^172\.(\d{1,3})\./)(host),
    O.flatMap(A.get(1)),
    O.map((octet) => Number.parseInt(octet, 10)),
    O.filter((octet) => !Number.isNaN(octet)),
    O.filter(N.between({ minimum: 16, maximum: 31 }))
  );

const isPrivate172 = (host: string): boolean => O.isSome(parsePrivate172SecondOctet(host));

/**
 * Resolve a hostname through the injected resolver and reject if ANY resolved
 * A/AAAA address classifies as internal network space.
 *
 * Skipped entirely when no resolver is supplied (back-compat: literal-host
 * classification only) or when the literal host is allowlisted (an explicit
 * operator trust decision overrides post-resolution blocking). Resolved
 * addresses are normalized before classification so IPv6 forms match the same
 * ranges as the literal-host path.
 *
 * @since 0.0.0
 */
const assertResolvedAddressesAllowed: (
  hostname: string,
  url: O.Option<string>,
  options: {
    readonly allowlist?: ReadonlyArray<string> | undefined;
    readonly resolve?: RemoteHostResolver | undefined;
  }
) => Effect.Effect<void, BlockedHostError> = Effect.fnUntraced(function* (hostname, url, options) {
  const host = normalizeHost(hostname);
  // No resolver -> literal-host classification only (back-compat). Allowlisted
  // literal hosts are explicitly trusted and skip resolution-based blocking.
  if (options.resolve === undefined || isAllowlisted(host, options.allowlist)) {
    return;
  }
  const addresses = yield* options.resolve(hostname);
  const internal = pipe(
    addresses,
    A.map(normalizeHost),
    A.findFirst((address) => isInternalHost(address))
  );
  if (O.isSome(internal)) {
    return yield* BlockedHostError.make({
      host: internal.value,
      url,
      message: `Refusing to reach ${host}: it resolves to a loopback, link-local, private, or metadata address: ${internal.value}`,
    });
  }
});

/**
 * Report whether a hostname should be blocked as loopback, link-local,
 * private (RFC1918/ULA), or a cloud metadata endpoint.
 *
 * Pure boolean predicate. Hostnames present in `options.allowlist` are never
 * blocked. The input is normalized (lowercased, IPv6 brackets stripped) before
 * matching, so `[::1]`, `::1`, and `LOCALHOST` all classify consistently.
 *
 * @example
 * ```ts
 * import { isBlockedRemoteHost } from "@beep/schema"
 *
 * console.log(isBlockedRemoteHost("169.254.169.254")) // true
 * console.log(isBlockedRemoteHost("example.com")) // false
 * console.log(isBlockedRemoteHost("10.0.0.5", { allowlist: ["10.0.0.5"] })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isBlockedRemoteHost: {
  (options?: { readonly allowlist?: ReadonlyArray<string> | undefined }): (hostname: string) => boolean;
  (hostname: string, options?: { readonly allowlist?: ReadonlyArray<string> | undefined }): boolean;
} = dual(
  (args) => P.isString(args[0]),
  (hostname: string, options: { readonly allowlist?: ReadonlyArray<string> | undefined } = {}): boolean => {
    const host = normalizeHost(hostname);
    if (isAllowlisted(host, options.allowlist)) {
      return false;
    }
    return isInternalHost(host);
  }
);

/**
 * Fail-closed assertion that a hostname does not target internal network space.
 *
 * Succeeds with `void` when the host is allowed; fails with a typed
 * {@link BlockedHostError} when the literal host classifies as loopback,
 * link-local, private, or cloud-metadata space and is not allowlisted.
 *
 * When `options.resolve` is supplied, the hostname is additionally resolved to
 * its A/AAAA addresses and the request is rejected if **any** resolved address
 * classifies as internal — catching public DNS names that point at internal IPs.
 * Resolution is skipped (literal-host classification only) when no resolver is
 * supplied or when the literal host is allowlisted. See the module
 * `@remarks` for the residual DNS-rebinding TOCTOU limitation.
 *
 * @example
 * ```ts
 * import { assertAllowedRemoteHost } from "@beep/schema"
 * import * as Effect from "effect/Effect"
 *
 * const program = assertAllowedRemoteHost("example.com")
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @effects Fails with `BlockedHostError` when the host is blocked; otherwise
 * succeeds with `void`. Emits a `SafeRemoteHost.assertAllowedRemoteHost` span.
 *
 * @category assertions
 * @since 0.0.0
 */
export const assertAllowedRemoteHost: {
  (options?: {
    readonly allowlist?: ReadonlyArray<string> | undefined;
    readonly resolve?: RemoteHostResolver | undefined;
  }): (hostname: string) => Effect.Effect<void, BlockedHostError>;
  (
    hostname: string,
    options?: {
      readonly allowlist?: ReadonlyArray<string> | undefined;
      readonly resolve?: RemoteHostResolver | undefined;
    }
  ): Effect.Effect<void, BlockedHostError>;
} = dual(
  (args) => P.isString(args[0]),
  Effect.fn("SafeRemoteHost.assertAllowedRemoteHost")(function* (
    hostname: string,
    options: {
      readonly allowlist?: ReadonlyArray<string> | undefined;
      readonly resolve?: RemoteHostResolver | undefined;
    } = {}
  ) {
    const host = normalizeHost(hostname);
    if (isBlockedRemoteHost(hostname, options)) {
      return yield* BlockedHostError.make({
        host,
        message: `Refusing to reach a loopback, link-local, private, or metadata host: ${host}`,
      });
    }
    yield* assertResolvedAddressesAllowed(hostname, O.none(), options);
  })
);

/**
 * Fail-closed assertion that a full URL does not target internal network space.
 *
 * Parses the URL, extracts its hostname, and delegates to the same
 * classification used by {@link isBlockedRemoteHost}. An unparseable URL fails
 * with a typed {@link BlockedHostError} carrying the parse defect, so callers
 * never proceed on a URL the guard could not evaluate.
 *
 * When `options.resolve` is supplied, the parsed hostname is additionally
 * resolved to its A/AAAA addresses and the request is rejected if **any**
 * resolved address classifies as internal — catching public DNS names that point
 * at internal IPs. Resolution is opt-in (drivers inject a resolver) and skipped
 * when no resolver is supplied or the literal host is allowlisted; see the module
 * `@remarks` for the residual DNS-rebinding TOCTOU limitation.
 *
 * @example
 * ```ts
 * import { assertAllowedRemoteUrl } from "@beep/schema"
 * import * as Effect from "effect/Effect"
 *
 * const program = assertAllowedRemoteUrl("https://api.uspto.gov/data")
 * console.log(Effect.isEffect(program))
 * ```
 *
 * @effects Fails with `BlockedHostError` when the URL cannot be parsed or its
 * host is blocked; otherwise succeeds with `void`. Emits a
 * `SafeRemoteHost.assertAllowedRemoteUrl` span.
 *
 * @category assertions
 * @since 0.0.0
 */
export const assertAllowedRemoteUrl: {
  (options?: {
    readonly allowlist?: ReadonlyArray<string> | undefined;
    readonly resolve?: RemoteHostResolver | undefined;
  }): (url: string) => Effect.Effect<void, BlockedHostError>;
  (
    url: string,
    options?: {
      readonly allowlist?: ReadonlyArray<string> | undefined;
      readonly resolve?: RemoteHostResolver | undefined;
    }
  ): Effect.Effect<void, BlockedHostError>;
} = dual(
  (args) => P.isString(args[0]),
  Effect.fn("SafeRemoteHost.assertAllowedRemoteUrl")(function* (
    url: string,
    options: {
      readonly allowlist?: ReadonlyArray<string> | undefined;
      readonly resolve?: RemoteHostResolver | undefined;
    } = {}
  ) {
    const parsed = Result.try({
      try: () => new URL(url).hostname,
      catch: (cause) =>
        BlockedHostError.make({
          host: "",
          url: O.some(url),
          message: `Refusing to load from an unparseable URL: ${url}`,
          cause: O.some(cause),
        }),
    });

    const hostname = yield* pipe(
      parsed,
      Result.match({
        onFailure: Effect.fail,
        onSuccess: Effect.succeed,
      })
    );

    const host = normalizeHost(hostname);
    if (isBlockedRemoteHost(hostname, options)) {
      return yield* BlockedHostError.make({
        host,
        url: O.some(url),
        message: `Refusing to load from a loopback, link-local, private, or metadata host: ${host}`,
      });
    }
    yield* assertResolvedAddressesAllowed(hostname, O.some(url), options);
  })
);
