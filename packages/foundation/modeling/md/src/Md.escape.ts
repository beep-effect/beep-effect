/**
 * Markdown and HTML escaping and URL-sanitization helpers.
 *
 * These functions are the XSS/injection boundary for rendered Markdown and HTML
 * output: every public escaper here normalizes and neutralizes untrusted input
 * before it reaches a render adapter.
 *
 * @packageDocumentation \@beep/md/Md.escape
 * @since 0.0.0
 */

import { $MdId } from "@beep/identity";
import { Markdown, SchemaUtils } from "@beep/schema";
import { A, Html, Str, thunkEmptyStr } from "@beep/utils";
import { Match, Number as N, SchemaTransformation } from "effect";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { CodeFenceLanguage } from "./Md.model.ts";

const $I = $MdId.create("Md.escape");
const trimBlock = Str.replace(/^\n+|\n+$/g, "");
// Only active script protocols are blocked by default.
// file:, blob:, and filesystem: are intentionally not treated as execution sinks in this boundary.
const unsafeUrlProtocolPattern = /^(?:javascript|vbscript|data):/i;
const urlProtocolDetectionIgnoredPattern = /[\u0000-\u001f\u007f\s]+/g;
const urlSchemePrefixPattern = /^([A-Za-z][A-Za-z0-9+.-]*):/u;
const htmlCharacterReferencePattern = /&(?:#(\d+);?|#x([\da-f]+);?|(bsol|colon|newline|sol|tab);?)/gi;
const percentEncodedBytePattern = /%([0-9a-f]{2})/gi;
const percentEncodedOctetPattern = /%25([0-9a-f]{2})/gi;
const invalidSurrogatePattern = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const lineSeparatorPattern = /\r\n?|\n/;
const lineBreakPattern = /[\r\n]/;
const backtickRunPattern = /`+/g;
const maxUnicodeCodePoint = 0x10ffff;
const maxUrlDecodePasses = 4;
const urlSchemePattern = /^[a-z][a-z0-9+.-]*:$/u;

const StringArray = S.Array(S.String).pipe(
  $I.annoteSchema("StringArray", {
    description: "Rendered string array accepted by Markdown utility helpers.",
  }),
  SchemaUtils.withCodecStatics
);
const UnsafeUrlProtocolDestination = S.String.check(
  S.isPattern(unsafeUrlProtocolPattern, {
    identifier: $I`UnsafeUrlProtocolDestinationCheck`,
    title: "Unsafe URL Protocol Destination",
    description: "A normalized URL destination that starts with an active unsafe protocol.",
    message: "URL destination must not start with javascript:, vbscript:, or data:",
  })
).pipe(
  $I.annoteSchema("UnsafeUrlProtocolDestination", {
    description: "Normalized URL destination that starts with an active unsafe protocol.",
  }),
  SchemaUtils.withCodecStatics
);

class LegacyUrlPolicy extends S.Class<LegacyUrlPolicy>($I`UrlPolicy`)(
  {
    allowedProtocols: S.Array(S.String).pipe(SchemaUtils.withEmptyArrayDefaults<string>()).annotateKey({
      description: "Lowercase URL protocols accepted by this sink. Empty means compatibility mode.",
    }),
    allowRelative: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether relative URL destinations are accepted.",
    }),
    allowProtocolRelative: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether protocol-relative destinations such as //example.com are accepted.",
    }),
    allowBackslashRelative: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether relative destinations containing backslashes are accepted.",
    }),
  },
  $I.annote("UrlPolicy", {
    description: "URL destination policy for a rendering sink.",
  })
) {}

/**
 * Legacy URL destination policy constructor for a rendering sink.
 *
 * An empty `allowedProtocols` list preserves compatibility behavior: active
 * script/data protocols are blocked, but other absolute protocols pass through.
 *
 * @example
 * ```ts
 * import { UrlPolicy } from "@beep/md/Md.escape"
 *
 * const policy = UrlPolicy.make({ allowedProtocols: ["https:"], allowRelative: false })
 * console.log(policy.allowedProtocols[0]) // "https:"
 * ```
 *
 * @deprecated Prefer the schema-owned {@link UrlPolicySpec}. This constructor
 * remains as a compatibility adapter for existing call sites.
 * @category models
 * @since 0.0.0
 */
export const UrlPolicy = LegacyUrlPolicy;

/**
 * Instance type constructed by the deprecated {@link UrlPolicy} adapter.
 *
 * @example
 * ```ts
 * import { UrlPolicy } from "@beep/md/Md.escape"
 * import type { UrlPolicy as UrlPolicyType } from "@beep/md/Md.escape"
 *
 * const policy: UrlPolicyType = UrlPolicy.make({})
 * console.log(policy.allowRelative) // true
 * ```
 *
 * @deprecated Prefer the schema-owned {@link UrlPolicySpec} type.
 * @category models
 * @since 0.0.0
 */
export type UrlPolicy = LegacyUrlPolicy;

const LegacyUrlPolicySchema = LegacyUrlPolicy;

const NormalizedUrlScheme = S.Trim.pipe(
  S.decode(SchemaTransformation.toLowerCase()),
  S.check(
    S.isPattern(urlSchemePattern, {
      identifier: $I`NormalizedUrlSchemeCheck`,
      title: "Normalized URL Scheme",
      description: "A lowercase RFC 3986 scheme name followed by a colon.",
      message: "URL schemes must be lowercase RFC 3986 scheme names ending in ':'.",
    })
  ),
  $I.annoteSchema("NormalizedUrlScheme", {
    description: "A schema-normalized lowercase URL scheme including its trailing colon.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Historical URL behavior: reject active script/data protocols while retaining
 * all other absolute and relative destinations.
 *
 * @example
 * ```ts
 * import { CompatibilityUrlPolicy } from "@beep/md/Md.escape"
 *
 * console.log(CompatibilityUrlPolicy.make({})._tag) // "Compatibility"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CompatibilityUrlPolicy extends S.TaggedClass<CompatibilityUrlPolicy>($I`CompatibilityUrlPolicy`)(
  "Compatibility",
  {},
  $I.annote("CompatibilityUrlPolicy", {
    description: "Compatibility URL behavior retained for legacy Markdown output.",
  })
) {}

/**
 * Explicit allow-list URL policy.
 *
 * Schemes decode to lowercase once at the schema boundary. Relative,
 * protocol-relative, and backslash-relative behavior is modeled independently
 * so callers cannot accidentally inherit browser-ambiguous behavior.
 *
 * @example
 * ```ts
 * import { AllowListUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * const policy = AllowListUrlPolicySpec.make({ schemes: ["https:"] })
 * console.log(policy.schemes) // ["https:"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AllowListUrlPolicySpec extends S.TaggedClass<AllowListUrlPolicySpec>($I`AllowListUrlPolicySpec`)(
  "AllowList",
  {
    schemes: S.Array(NormalizedUrlScheme).annotateKey({
      description: "Lowercase URL schemes accepted by the policy.",
    }),
    allowRelative: SchemaUtils.BoolKeyDefaultTrue.annotateKey({
      description: "Whether ordinary relative and fragment destinations are accepted.",
    }),
    allowProtocolRelative: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Whether protocol-relative destinations such as //example.com are accepted.",
    }),
    allowBackslashRelative: SchemaUtils.BoolKeyDefaultFalse.annotateKey({
      description: "Whether relative destinations containing backslashes are accepted.",
    }),
  },
  $I.annote("AllowListUrlPolicySpec", {
    description: "Explicit URL scheme and relative-destination allow list.",
  })
) {}

/**
 * Canonical schema-owned URL policy used by Markdown and downstream editor
 * codecs.
 *
 * @example
 * ```ts
 * import { UrlPolicySpec } from "@beep/md/Md.escape"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(UrlPolicySpec)({ _tag: "AllowList", schemes: [" HTTPS: "] })
 * console.log(policy._tag === "AllowList" ? policy.schemes : []) // ["https:"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UrlPolicySpec = S.Union([CompatibilityUrlPolicy, AllowListUrlPolicySpec]).pipe(
  $I.annoteSchema("UrlPolicySpec", {
    description: "Canonical tagged URL destination policy.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UrlPolicySpec}.
 *
 * @example
 * ```ts
 * import { CompatibilityUrlPolicySpec } from "@beep/md/Md.escape"
 * import type { UrlPolicySpec } from "@beep/md/Md.escape"
 *
 * const policy: UrlPolicySpec = CompatibilityUrlPolicySpec
 * console.log(policy._tag) // "Compatibility"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UrlPolicySpec = typeof UrlPolicySpec.Type;

/**
 * Canonical compatibility policy.
 *
 * @example
 * ```ts
 * import { CompatibilityUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * console.log(CompatibilityUrlPolicySpec._tag) // "Compatibility"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const CompatibilityUrlPolicySpec = CompatibilityUrlPolicy.make({});

/**
 * Canonical browser-safe policy retained for editor links and images.
 *
 * @example
 * ```ts
 * import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * console.log(BrowserSafeUrlPolicySpec.schemes.includes("artifact:")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const BrowserSafeUrlPolicySpec = AllowListUrlPolicySpec.make({
  schemes: ["http:", "https:", "mailto:", "tel:", "artifact:"],
  allowProtocolRelative: false,
  allowBackslashRelative: false,
});

/**
 * Canonical product-agnostic web policy.
 *
 * @example
 * ```ts
 * import { StrictWebUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * console.log(StrictWebUrlPolicySpec.schemes.includes("artifact:")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const StrictWebUrlPolicySpec = AllowListUrlPolicySpec.make({
  schemes: ["http:", "https:", "mailto:"],
  allowProtocolRelative: false,
  allowBackslashRelative: false,
});

/**
 * Canonical user-authored link policy.
 *
 * @example
 * ```ts
 * import { UserContentLinkUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * console.log(UserContentLinkUrlPolicySpec.schemes.includes("tel:")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const UserContentLinkUrlPolicySpec = AllowListUrlPolicySpec.make({
  schemes: ["https:", "mailto:", "tel:"],
  allowProtocolRelative: false,
  allowBackslashRelative: false,
});

/**
 * Canonical user-authored image policy.
 *
 * @example
 * ```ts
 * import { UserContentImageUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * console.log(UserContentImageUrlPolicySpec.schemes) // ["https:"]
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const UserContentImageUrlPolicySpec = AllowListUrlPolicySpec.make({
  schemes: ["https:"],
  allowProtocolRelative: false,
  allowBackslashRelative: false,
});

/**
 * Schema accepted while compatibility URL policy adapters remain supported.
 *
 * New code should decode or construct {@link UrlPolicySpec}; the legacy
 * {@link UrlPolicy} member keeps existing renderer options wire-compatible.
 *
 * @example
 * ```ts
 * import { UrlPolicyInput } from "@beep/md/Md.escape"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownSync(UrlPolicyInput)({ _tag: "Compatibility" })
 * console.log("_tag" in policy) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UrlPolicyInput = S.Union([UrlPolicySpec, LegacyUrlPolicySchema]).pipe(
  $I.annoteSchema("UrlPolicyInput", {
    description: "Canonical URL policy or deprecated legacy adapter.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link UrlPolicyInput}.
 *
 * @example
 * ```ts
 * import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape"
 * import type { UrlPolicyInput } from "@beep/md/Md.escape"
 *
 * const policy: UrlPolicyInput = BrowserSafeUrlPolicySpec
 * console.log("schemes" in policy) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UrlPolicyInput = typeof UrlPolicyInput.Type;

/**
 * Compatibility URL policy matching the historical `@beep/md` sanitizer.
 *
 * @example
 * ```ts
 * import { CompatUrlPolicy } from "@beep/md/Md.escape"
 *
 * console.log(CompatUrlPolicy.allowRelative) // true
 * ```
 *
 * @deprecated Prefer {@link CompatibilityUrlPolicySpec}.
 * @category utilities
 * @since 0.0.0
 */
export const CompatUrlPolicy = LegacyUrlPolicySchema.make({});

/**
 * Browser anchor/image URL policy for HTML sinks.
 *
 * @example
 * ```ts
 * import { BrowserSafeUrlPolicy } from "@beep/md/Md.escape"
 *
 * console.log(BrowserSafeUrlPolicy.allowedProtocols.includes("artifact:")) // true
 * ```
 *
 * @deprecated Prefer {@link BrowserSafeUrlPolicySpec}.
 * @category utilities
 * @since 0.0.0
 */
export const BrowserSafeUrlPolicy = LegacyUrlPolicySchema.make({
  allowedProtocols: ["http:", "https:", "mailto:", "tel:", "artifact:"],
  allowProtocolRelative: false,
  allowBackslashRelative: false,
});

/**
 * Strict web URL policy for product-agnostic web output.
 *
 * @example
 * ```ts
 * import { StrictWebUrlPolicy } from "@beep/md/Md.escape"
 *
 * console.log(StrictWebUrlPolicy.allowedProtocols.includes("artifact:")) // false
 * ```
 *
 * @deprecated Prefer {@link StrictWebUrlPolicySpec}.
 * @category utilities
 * @since 0.0.0
 */
export const StrictWebUrlPolicy = LegacyUrlPolicySchema.make({
  allowedProtocols: ["http:", "https:", "mailto:"],
  allowProtocolRelative: false,
  allowBackslashRelative: false,
});

const isValidCodePoint = (codePoint: number): boolean => codePoint >= 0 && codePoint <= maxUnicodeCodePoint;
const parseCodePoint: {
  (value: string, radix: 10 | 16): number;
  (radix: 10 | 16): (value: string) => number;
} = dual(2, (value: string, radix: 10 | 16): number => globalThis.Number.parseInt(value, radix));
const codePointToString = (codePoint: number): string => globalThis.String.fromCodePoint(codePoint);
const replaceHtmlCharacterReferences: {
  (
    value: string,
    replacer: (
      match: string,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      named: string | undefined
    ) => string
  ): string;
  (
    replacer: (
      match: string,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      named: string | undefined
    ) => string
  ): (value: string) => string;
} = dual(
  2,
  (
    value: string,
    replacer: (
      match: string,
      decimal: string | undefined,
      hexadecimal: string | undefined,
      named: string | undefined
    ) => string
  ): string =>
    pipe(
      value,
      Str.replaceAllWith(htmlCharacterReferencePattern, (match, decimal, hexadecimal, named) =>
        replacer(
          match,
          P.isString(decimal) ? decimal : undefined,
          P.isString(hexadecimal) ? hexadecimal : undefined,
          P.isString(named) ? named : undefined
        )
      )
    )
);

const decodeHtmlCharacterReferences = (value: string): string =>
  replaceHtmlCharacterReferences(
    value,
    (_match, decimal: string | undefined, hexadecimal: string | undefined, named: string | undefined) => {
      const codePoint = pipe(
        [
          pipe(
            O.fromUndefinedOr(named),
            O.map((value) =>
              Match.value(Str.toLowerCase(value)).pipe(
                Match.when("bsol", () => 92),
                Match.when("sol", () => 47),
                Match.when("tab", () => 9),
                Match.when("newline", () => 10),
                Match.orElse(() => 58)
              )
            )
          ),
          pipe(
            O.fromUndefinedOr(hexadecimal),
            O.map((value) => parseCodePoint(value, 16))
          ),
        ],
        O.firstSomeOf,
        O.getOrElse(() => parseCodePoint(O.getOrThrow(O.fromUndefinedOr(decimal)), 10))
      );

      return isValidCodePoint(codePoint) ? codePointToString(codePoint) : _match;
    }
  );

const decodePercentEncodedByte: (value: string) => string = Str.replaceAllWith(
  percentEncodedBytePattern,
  (match, hex) => (P.isString(hex) ? codePointToString(parseCodePoint(hex, 16)) : match)
);

// Repeatedly decode percent-encoded bytes until the value stabilizes or the
// pass budget is exhausted, defeating multiply-encoded protocol obfuscation
// (e.g. `%256a` -> `%6a` -> `j`) without an imperative mutable loop.
const decodePercentEncodedBytesFrom = (current: string, pass: number): string => {
  const next = pass >= maxUrlDecodePasses ? current : decodePercentEncodedByte(current);

  return next === current ? next : decodePercentEncodedBytesFrom(next, pass + 1);
};

const decodePercentEncodedBytes = (value: string): string => decodePercentEncodedBytesFrom(value, 0);

const normalizeUrlProtocolCandidate = flow(
  Str.trim,
  Str.replace(urlProtocolDetectionIgnoredPattern, ""),
  Str.toLowerCase
);

const destinationProtocol = (destination: string): O.Option<string> =>
  pipe(
    Str.trim(destination),
    Str.match(urlSchemePrefixPattern),
    O.flatMap(A.get(1)),
    O.map((protocol) => `${Str.toLowerCase(protocol)}:`)
  );

const normalizeLegacyScheme = flow(Str.trim, Str.toLowerCase, (scheme) =>
  Str.endsWith(":")(scheme) ? scheme : `${scheme}:`
);

/**
 * Normalizes a legacy policy adapter into the canonical tagged policy once.
 *
 * Empty legacy protocol arrays intentionally retain compatibility semantics.
 *
 * @example
 * ```ts
 * import { normalizeUrlPolicy, UrlPolicy } from "@beep/md/Md.escape"
 *
 * const policy = normalizeUrlPolicy(UrlPolicy.make({ allowedProtocols: ["HTTPS"] }))
 * console.log(policy._tag) // "AllowList"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const normalizeUrlPolicy = (policy: UrlPolicyInput): UrlPolicySpec => {
  if (UrlPolicySpec.is(policy)) {
    return policy;
  }

  if (!A.isReadonlyArrayNonEmpty(policy.allowedProtocols)) {
    return CompatibilityUrlPolicySpec;
  }

  return AllowListUrlPolicySpec.make({
    schemes: pipe(
      policy.allowedProtocols,
      A.map(normalizeLegacyScheme),
      A.filter((scheme) => urlSchemePattern.test(scheme))
    ),
    allowRelative: policy.allowRelative,
    allowProtocolRelative: policy.allowProtocolRelative,
    allowBackslashRelative: policy.allowBackslashRelative,
  });
};

const hasAllowedProtocol = (policy: UrlPolicySpec, protocol: string): boolean =>
  Match.value(policy).pipe(
    Match.tag("Compatibility", () => true),
    Match.tag("AllowList", ({ schemes }) => A.contains(schemes, protocol)),
    Match.exhaustive
  );

const isAllowedRelativeDestination = (policy: UrlPolicySpec, destination: string): boolean =>
  Match.value(policy).pipe(
    Match.tag("Compatibility", () => true),
    Match.tag(
      "AllowList",
      ({ allowBackslashRelative, allowProtocolRelative, allowRelative }) =>
        allowRelative &&
        (allowProtocolRelative || !Str.startsWith("//")(destination)) &&
        (allowBackslashRelative || !Str.includes("\\")(destination))
    ),
    Match.exhaustive
  );

const isAllowedByPolicy = (policy: UrlPolicySpec, destination: string): boolean => {
  const normalized = normalizeUrlProtocolCandidate(destination);

  return pipe(
    destinationProtocol(normalized),
    O.match({
      // URL parsers discard embedded ASCII whitespace before interpreting
      // special-scheme slashes. Apply the relative-destination flags to that
      // same canonical candidate so `/\n/host` cannot become `//host` later.
      onNone: () => isAllowedRelativeDestination(policy, normalized),
      onSome: (protocol) => hasAllowedProtocol(policy, protocol),
    })
  );
};

const encodeUrlDestination = flow(
  Str.replace(invalidSurrogatePattern, "\uFFFD"),
  encodeURI,
  Str.replace(percentEncodedOctetPattern, "%$1")
);

const urlSafetyCandidates = (destination: string): ReadonlyArray<string> => {
  const decodedHtml = decodeHtmlCharacterReferences(destination);
  const decodedPercent = decodePercentEncodedBytes(destination);
  const decodedHtmlAndPercent = decodePercentEncodedBytes(decodedHtml);
  const decodedPercentAndHtml = decodeHtmlCharacterReferences(decodedPercent);
  const decodedHtmlPercentAndHtml = decodeHtmlCharacterReferences(decodedHtmlAndPercent);

  return [
    destination,
    decodedHtml,
    decodedPercent,
    decodedHtmlAndPercent,
    decodedPercentAndHtml,
    decodedHtmlPercentAndHtml,
  ];
};

/**
 * Evaluates a URL destination against a canonical or legacy policy without
 * mutating the destination.
 *
 * HTML character references and repeated percent encoding are evaluated as
 * alternate protocol candidates so downstream codecs share the same
 * browser-safe decision.
 *
 * @example
 * ```ts
 * import { StrictWebUrlPolicySpec, isUrlDestinationAllowedWithPolicy } from "@beep/md/Md.escape"
 *
 * console.log(isUrlDestinationAllowedWithPolicy("https://example.com", StrictWebUrlPolicySpec)) // true
 * console.log(isUrlDestinationAllowedWithPolicy("artifact:123", StrictWebUrlPolicySpec)) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isUrlDestinationAllowedWithPolicy: {
  (destination: string, policy: UrlPolicyInput): boolean;
  (policy: UrlPolicyInput): (destination: string) => boolean;
} = dual(2, (destination: string, policyInput: UrlPolicyInput): boolean => {
  const policy = normalizeUrlPolicy(policyInput);
  const candidates = urlSafetyCandidates(destination);
  const hasUnsafeProtocol = pipe(
    candidates,
    A.map(normalizeUrlProtocolCandidate),
    A.some(UnsafeUrlProtocolDestination.is)
  );

  return !hasUnsafeProtocol && A.every(candidates, (candidate) => isAllowedByPolicy(policy, candidate));
});

/**
 * Evaluates a URL destination using the historical compatibility policy.
 *
 * @example
 * ```ts
 * import { isUrlDestinationAllowed } from "@beep/md/Md.escape"
 *
 * console.log(isUrlDestinationAllowed("javascript:alert(1)")) // false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isUrlDestinationAllowed = isUrlDestinationAllowedWithPolicy(CompatibilityUrlPolicySpec);

/**
 * Joins rendered Markdown blocks with one blank line between blocks.
 *
 * @example
 * ```ts
 * import { joinBlocks } from "@beep/md/Md.escape"
 *
 * const markdown = joinBlocks(["# Title", "Body text"])
 * console.log(markdown) // "# Title\n\nBody text"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const joinBlocks = (blocks: string | ReadonlyArray<string>): Markdown => {
  const blockList = P.isString(blocks) ? [blocks] : blocks;

  return pipe(blockList, A.map(trimBlock), A.filter(P.isTruthy), A.join("\n\n"), Markdown.make);
};

/**
 * Prefixes every line of text with the provided marker.
 *
 * @example
 * ```ts
 * import { prefixLines } from "@beep/md/Md.escape"
 *
 * const quoted = prefixLines("alpha\nbeta", "> ")
 * console.log(quoted) // "> alpha\n> beta"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const prefixLines: {
  (text: string, prefix: string): string;
  (prefix: string): (text: string) => string;
} = dual(2, (text: string, prefix: string): string =>
  pipe(text, Str.split(lineSeparatorPattern), A.map(Str.prefix(prefix)), A.join("\n"))
);

/**
 * Escapes Markdown control characters in plain text.
 *
 * @example
 * ```ts
 * import { escapeMarkdownText } from "@beep/md/Md.escape"
 *
 * const escaped = escapeMarkdownText("# title")
 * console.log(escaped) // "\\# title"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeMarkdownText = Str.replace(/([\\`*_{}[\]()#+\-.|<>~])/g, "\\$1");

/**
 * Normalizes URL-like destinations before rendering Markdown or HTML output.
 *
 * Unsafe active protocols are replaced with a harmless fragment destination.
 *
 * @example
 * ```ts
 * import { sanitizeUrlDestination } from "@beep/md/Md.escape"
 *
 * console.log(sanitizeUrlDestination("javascript:alert(1)")) // "#"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeUrlDestinationWithPolicy: {
  (destination: string, policy: UrlPolicyInput): string;
  (policy: UrlPolicyInput): (destination: string) => string;
} = dual(2, (destination: string, policyInput: UrlPolicyInput): string =>
  // Evaluate normalized/decoded candidates, but preserve the original destination when safe.
  isUrlDestinationAllowedWithPolicy(destination, policyInput) ? destination : "#"
);

/**
 * Normalizes URL-like destinations before rendering Markdown or HTML output.
 *
 * Unsafe active protocols are replaced with a harmless fragment destination.
 *
 * @example
 * ```ts
 * import { sanitizeUrlDestination } from "@beep/md/Md.escape"
 *
 * console.log(sanitizeUrlDestination("javascript:alert(1)")) // "#"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeUrlDestination = sanitizeUrlDestinationWithPolicy(CompatibilityUrlPolicySpec);

/**
 * Escapes Markdown link or image destination delimiters.
 *
 * @example
 * ```ts
 * import { escapeMarkdownDestination } from "@beep/md/Md.escape"
 *
 * const escaped = escapeMarkdownDestination("https://example.com/a)b")
 * console.log(escaped) // "https://example.com/a\\)b"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeMarkdownDestinationWithPolicy: {
  (destination: string, policy: UrlPolicyInput): string;
  (policy: UrlPolicyInput): (destination: string) => string;
} = dual(2, (destination: string, policy: UrlPolicyInput): string =>
  pipe(sanitizeUrlDestinationWithPolicy(destination, policy), encodeUrlDestination, Str.replace(/[\\()]/g, "\\$&"))
);

/**
 * Escapes Markdown link or image destination delimiters with the compatibility
 * URL policy.
 *
 * @example
 * ```ts
 * import { escapeMarkdownDestination } from "@beep/md/Md.escape"
 *
 * console.log(escapeMarkdownDestination("https://example.com/a)b")) // "https://example.com/a\\)b"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeMarkdownDestination = flow(
  sanitizeUrlDestinationWithPolicy(CompatibilityUrlPolicySpec),
  encodeUrlDestination,
  Str.replace(/[\\()]/g, "\\$&")
);

/**
 * Escapes a URL-like destination for use inside an HTML attribute.
 *
 * @example
 * ```ts
 * import { escapeHtmlUrlAttribute } from "@beep/md/Md.escape"
 *
 * console.log(escapeHtmlUrlAttribute("a b")) // "a%20b"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeHtmlUrlAttributeWithPolicy: {
  (destination: string, policy: UrlPolicyInput): string;
  (policy: UrlPolicyInput): (destination: string) => string;
} = dual(2, (destination: string, policy: UrlPolicyInput): string =>
  pipe(sanitizeUrlDestinationWithPolicy(destination, policy), encodeUrlDestination, Html.escapeHtml)
);

/**
 * Escapes a URL for an HTML attribute using the browser-safe URL policy.
 *
 * @example
 * ```ts
 * import { escapeHtmlUrlAttribute } from "@beep/md/Md.escape"
 *
 * console.log(escapeHtmlUrlAttribute("https://example.com?a=1&b=2")) // "https://example.com?a=1&amp;b=2"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeHtmlUrlAttribute = flow(
  sanitizeUrlDestinationWithPolicy(BrowserSafeUrlPolicySpec),
  encodeUrlDestination,
  Html.escapeHtml
);

/**
 * Returns the length of the longest contiguous backtick run in text.
 *
 * @example
 * ```ts
 * import { Str } from "@beep/utils"
 * import { maxBackticks } from "@beep/md/Md.escape"
 *
 * const triple = Str.repeat("`", 3)
 * const count = maxBackticks(`\`one\` and ${triple}three${triple}`)
 * console.log(count) // 3
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const maxBackticks: (text: string) => number = flow(
  Str.match(backtickRunPattern),
  O.map(
    flow(
      A.map(Str.length),
      A.reduce(0, (longest, run) => N.max(longest, run))
    )
  ),
  O.getOrElse(() => 0)
);

/**
 * Builds a Markdown inline code span with an adaptive backtick fence.
 *
 * @example
 * ```ts
 * import { renderInlineCode } from "@beep/md/Md.escape"
 *
 * const code = renderInlineCode("`single`")
 * console.log(code) // "`` `single` ``"
 * ```
 *
 * Empty and multiline payloads fall back to raw `<code>` HTML because Markdown
 * code spans normalize whitespace and cannot preserve those payloads exactly.
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderInlineCode = (text: string): string => {
  if (text === "" || lineBreakPattern.test(text)) {
    // Preserve exact payload for empty/multiline spans instead of lossy Markdown normalization.
    return `<code>${Html.escapeHtml(text)}</code>`;
  }

  const backticks = pipe("`", Str.repeat(maxBackticks(text) + 1));
  const needsPadding =
    Str.startsWith("`")(text) || Str.endsWith("`")(text) || Str.startsWith(" ")(text) || Str.endsWith(" ")(text);
  const padding = needsPadding ? " " : "";

  return `${backticks}${padding}${text}${padding}${backticks}`;
};

/**
 * Builds a Markdown fenced code block with an adaptive backtick fence.
 *
 * The info string is folded through {@link CodeFenceLanguage} so only a single
 * safe language token is ever emitted; non-conforming values are dropped.
 *
 * @example
 * ```ts
 * import { Str } from "@beep/utils"
 * import { renderFencedCode } from "@beep/md/Md.escape"
 *
 * const block = renderFencedCode("console.log('beep')", "ts")
 * const fence = Str.repeat("`", 3)
 * console.log(Str.includes(`${fence}ts`)(block)) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const renderFencedCode: {
  (text: string, language: string): string;
  (language: string): (text: string) => string;
} = dual(2, (text: string, language: string): string => {
  const fence = pipe("`", Str.repeat(N.max(maxBackticks(text), 2) + 1));
  const info = O.getOrElse(CodeFenceLanguage.decodeOption(Str.trim(language)), thunkEmptyStr);

  return `${fence}${info}\n${text}\n${fence}`;
});

/**
 * Type guard for rendered string arrays accepted by {@link joinBlocks}.
 *
 * @example
 * ```ts
 * import { isStringArray } from "@beep/md/Md.escape"
 *
 * console.log(isStringArray(["a", "b"])) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isStringArray = StringArray.is;
