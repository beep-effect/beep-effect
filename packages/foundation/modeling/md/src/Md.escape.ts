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
  SchemaUtils.withCodecStatics(["is"])
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
  SchemaUtils.withCodecStatics(["is"])
);

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
  })
);

/**
 * Historical URL behavior: reject active script/data protocols while retaining
 * all other absolute and relative destinations.
 *
 * **Example** (Create compatibility policy)
 *
 * ```ts import.meta.vitest name="Create compatibility policy"
 * import { CompatibilityUrlPolicy } from "@beep/md/Md.escape"
 *
 * CompatibilityUrlPolicy.make({})._tag // => "Compatibility"
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
 * **Details**
 *
 * Schemes decode to lowercase once at the schema boundary. Relative,
 * protocol-relative, and backslash-relative behavior is modeled independently
 * so callers cannot accidentally inherit browser-ambiguous behavior.
 *
 * **Example** (Make HTTPS allow-list)
 *
 * ```ts import.meta.vitest name="Make HTTPS allow-list"
 * import { AllowListUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * const policy = AllowListUrlPolicySpec.make({ schemes: ["https:"] })
 * policy.schemes // => ["https:"]
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
 * **Example** (Decode allow-list policy)
 *
 * ```ts import.meta.vitest name="Decode allow-list policy"
 * import { UrlPolicySpec } from "@beep/md/Md.escape"
 * import { Result } from "effect"
 * import * as S from "effect/Schema"
 *
 * const policy = S.decodeUnknownResult(UrlPolicySpec)({ _tag: "AllowList", schemes: [" HTTPS: "] })
 * Result.isSuccess(policy) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const UrlPolicySpec = S.Union([CompatibilityUrlPolicy, AllowListUrlPolicySpec]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("UrlPolicySpec", {
    description: "Canonical tagged URL destination policy.",
  })
);

/**
 * Type for {@link UrlPolicySpec}.
 *
 * **Example** (Assign compatibility policy type)
 *
 * ```ts import.meta.vitest name="Assign compatibility policy type"
 * import { CompatibilityUrlPolicySpec } from "@beep/md/Md.escape"
 * import type { UrlPolicySpec } from "@beep/md/Md.escape"
 *
 * const policy: UrlPolicySpec = CompatibilityUrlPolicySpec
 * policy._tag // => "Compatibility"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type UrlPolicySpec = typeof UrlPolicySpec.Type;

/**
 * Canonical compatibility policy.
 *
 * **Example** (Read compatibility policy tag)
 *
 * ```ts import.meta.vitest name="Read compatibility policy tag"
 * import { CompatibilityUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * CompatibilityUrlPolicySpec._tag // => "Compatibility"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const CompatibilityUrlPolicySpec = CompatibilityUrlPolicy.make({});

/**
 * Canonical browser-safe policy retained for editor links and images.
 *
 * **Example** (Include artifact scheme)
 *
 * ```ts import.meta.vitest name="Include artifact scheme"
 * import { BrowserSafeUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * BrowserSafeUrlPolicySpec.schemes.includes("artifact:") // => true
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
 * **Example** (Exclude artifact scheme)
 *
 * ```ts import.meta.vitest name="Exclude artifact scheme"
 * import { StrictWebUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * StrictWebUrlPolicySpec.schemes.includes("artifact:") // => false
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
 * **Example** (Include tel scheme)
 *
 * ```ts import.meta.vitest name="Include tel scheme"
 * import { UserContentLinkUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * UserContentLinkUrlPolicySpec.schemes.includes("tel:") // => true
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
 * **Example** (List HTTPS image schemes)
 *
 * ```ts import.meta.vitest name="List HTTPS image schemes"
 * import { UserContentImageUrlPolicySpec } from "@beep/md/Md.escape"
 *
 * UserContentImageUrlPolicySpec.schemes // => ["https:"]
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
            O.map(Str.toLowerCase),
            O.map(
              Match.type<Lowercase<string>>().pipe(
                Match.when("bsol", () => 92),
                Match.when("sol", () => 47),
                Match.when("tab", () => 9),
                Match.when("newline", () => 10),
                Match.orElse(() => 58)
              )
            )
          ),
          pipe(O.fromUndefinedOr(hexadecimal), O.map(parseCodePoint(16))),
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

const hasAllowedProtocol: {
  (policy: UrlPolicySpec, protocol: string): boolean;
  (protocol: string): (policy: UrlPolicySpec) => boolean;
} = dual(2, (policy: UrlPolicySpec, protocol: string): boolean =>
  Match.value(policy).pipe(
    Match.tagsExhaustive({
      Compatibility: () => true,
      AllowList: P.Struct({
        schemes: A.contains(protocol),
      }),
    })
  )
);

const isAllowedRelativeDestination = (policy: UrlPolicySpec, destination: string): boolean =>
  Match.value(policy).pipe(
    Match.tagsExhaustive({
      Compatibility: () => true,
      AllowList: ({ allowBackslashRelative, allowProtocolRelative, allowRelative }) =>
        allowRelative &&
        (allowProtocolRelative || !Str.startsWith("//")(destination)) &&
        (allowBackslashRelative || !Str.includes("\\")(destination)),
    })
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
 * Evaluates a URL destination against a canonical policy without mutating the
 * destination.
 *
 * **Details**
 *
 * HTML character references and repeated percent encoding are evaluated as
 * alternate protocol candidates so downstream codecs share the same
 * browser-safe decision.
 *
 * **Example** (Allow and reject destinations)
 *
 * ```ts import.meta.vitest name="Allow and reject destinations"
 * import { StrictWebUrlPolicySpec, isUrlDestinationAllowedWithPolicy } from "@beep/md/Md.escape"
 *
 * isUrlDestinationAllowedWithPolicy("https://example.com", StrictWebUrlPolicySpec) // => true
 * isUrlDestinationAllowedWithPolicy("artifact:123", StrictWebUrlPolicySpec) // => false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isUrlDestinationAllowedWithPolicy: {
  (destination: string, policy: UrlPolicySpec): boolean;
  (policy: UrlPolicySpec): (destination: string) => boolean;
} = dual(2, (destination: string, policy: UrlPolicySpec): boolean => {
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
 * **Example** (Reject javascript destination)
 *
 * ```ts import.meta.vitest name="Reject javascript destination"
 * import { isUrlDestinationAllowed } from "@beep/md/Md.escape"
 *
 * isUrlDestinationAllowed("javascript:alert(1)") // => false
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const isUrlDestinationAllowed = isUrlDestinationAllowedWithPolicy(CompatibilityUrlPolicySpec);

/**
 * Joins rendered Markdown blocks with one blank line between blocks.
 *
 * **Example** (Join title and body)
 *
 * ```ts import.meta.vitest name="Join title and body"
 * import { joinBlocks } from "@beep/md/Md.escape"
 *
 * const markdown = joinBlocks(["# Title", "Body text"])
 * markdown // => "# Title\n\nBody text"
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
 * **Example** (Prefix lines as blockquote)
 *
 * ```ts import.meta.vitest name="Prefix lines as blockquote"
 * import { prefixLines } from "@beep/md/Md.escape"
 *
 * const quoted = prefixLines("alpha\nbeta", "> ")
 * quoted // => "> alpha\n> beta"
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
 * **Example** (Escape hash character)
 *
 * ```ts import.meta.vitest name="Escape hash character"
 * import { escapeMarkdownText } from "@beep/md/Md.escape"
 *
 * const escaped = escapeMarkdownText("# title")
 * escaped // => "\\# title"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeMarkdownText = Str.replace(/([\\`*_{}[\]()#+\-.|<>~])/g, "\\$1");

/**
 * Normalizes URL-like destinations before rendering Markdown or HTML output.
 *
 * **Details**
 *
 * Unsafe active protocols are replaced with a harmless fragment destination.
 *
 * **Example** (Replace javascript with fragment)
 *
 * ```ts import.meta.vitest name="Replace javascript with fragment"
 * import { sanitizeUrlDestination } from "@beep/md/Md.escape"
 *
 * sanitizeUrlDestination("javascript:alert(1)") // => "#"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeUrlDestinationWithPolicy: {
  (destination: string, policy: UrlPolicySpec): string;
  (policy: UrlPolicySpec): (destination: string) => string;
} = dual(2, (destination: string, policy: UrlPolicySpec): string =>
  // Evaluate normalized/decoded candidates, but preserve the original destination when safe.
  isUrlDestinationAllowedWithPolicy(destination, policy) ? destination : "#"
);

/**
 * Normalizes URL-like destinations before rendering Markdown or HTML output.
 *
 * **Details**
 *
 * Unsafe active protocols are replaced with a harmless fragment destination.
 *
 * **Example** (Replace javascript with fragment)
 *
 * ```ts import.meta.vitest name="Replace javascript with fragment"
 * import { sanitizeUrlDestination } from "@beep/md/Md.escape"
 *
 * sanitizeUrlDestination("javascript:alert(1)") // => "#"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const sanitizeUrlDestination = sanitizeUrlDestinationWithPolicy(CompatibilityUrlPolicySpec);

/**
 * Escapes Markdown link or image destination delimiters.
 *
 * **Example** (Escape parenthesis in destination)
 *
 * ```ts import.meta.vitest name="Escape parenthesis in destination"
 * import { escapeMarkdownDestination } from "@beep/md/Md.escape"
 *
 * const escaped = escapeMarkdownDestination("https://example.com/a)b")
 * escaped // => "https://example.com/a\\)b"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeMarkdownDestinationWithPolicy: {
  (destination: string, policy: UrlPolicySpec): string;
  (policy: UrlPolicySpec): (destination: string) => string;
} = dual(2, (destination: string, policy: UrlPolicySpec): string =>
  pipe(sanitizeUrlDestinationWithPolicy(destination, policy), encodeUrlDestination, Str.replace(/[\\()]/g, "\\$&"))
);

/**
 * Escapes Markdown link or image destination delimiters with the compatibility
 * URL policy.
 *
 * **Example** (Escape parenthesis in destination)
 *
 * ```ts import.meta.vitest name="Escape parenthesis in destination"
 * import { escapeMarkdownDestination } from "@beep/md/Md.escape"
 *
 * escapeMarkdownDestination("https://example.com/a)b") // => "https://example.com/a\\)b"
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
 * **Example** (Percent-encode space)
 *
 * ```ts import.meta.vitest name="Percent-encode space"
 * import { escapeHtmlUrlAttribute } from "@beep/md/Md.escape"
 *
 * escapeHtmlUrlAttribute("a b") // => "a%20b"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const escapeHtmlUrlAttributeWithPolicy: {
  (destination: string, policy: UrlPolicySpec): string;
  (policy: UrlPolicySpec): (destination: string) => string;
} = dual(2, (destination: string, policy: UrlPolicySpec): string =>
  pipe(sanitizeUrlDestinationWithPolicy(destination, policy), encodeUrlDestination, Html.escapeHtml)
);

/**
 * Escapes a URL for an HTML attribute using the browser-safe URL policy.
 *
 * **Example** (Escape ampersand in attribute)
 *
 * ```ts import.meta.vitest name="Escape ampersand in attribute"
 * import { escapeHtmlUrlAttribute } from "@beep/md/Md.escape"
 *
 * escapeHtmlUrlAttribute("https://example.com?a=1&b=2") // => "https://example.com?a=1&amp;b=2"
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
 * **Example** (Measure longest backtick run)
 *
 * ```ts import.meta.vitest name="Measure longest backtick run"
 * import { Str } from "@beep/utils"
 * import { maxBackticks } from "@beep/md/Md.escape"
 *
 * const triple = Str.repeat("`", 3)
 * const count = maxBackticks(`\`one\` and ${triple}three${triple}`)
 * count // => 3
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
 * **Example** (Fence nested backtick code)
 *
 * ```ts import.meta.vitest name="Fence nested backtick code"
 * import { renderInlineCode } from "@beep/md/Md.escape"
 *
 * const code = renderInlineCode("`single`")
 * code // => "`` `single` ``"
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
 * **Details**
 *
 * The info string is folded through {@link CodeFenceLanguage} so only a single
 * safe language token is ever emitted; non-conforming values are dropped.
 *
 * **Example** (Render TypeScript code fence)
 *
 * ```ts import.meta.vitest name="Render TypeScript code fence"
 * import { Str } from "@beep/utils"
 * import { renderFencedCode } from "@beep/md/Md.escape"
 *
 * const block = renderFencedCode("console.log('beep')", "ts")
 * const fence = Str.repeat("`", 3)
 * Str.includes(`${fence}ts`)(block) // => true
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
 * **Example** (Guard rendered string array)
 *
 * ```ts import.meta.vitest name="Guard rendered string array"
 * import { isStringArray } from "@beep/md/Md.escape"
 *
 * isStringArray(["a", "b"]) // => true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isStringArray = StringArray.is;
