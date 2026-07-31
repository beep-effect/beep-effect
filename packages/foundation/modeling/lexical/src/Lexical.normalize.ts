/**
 * Leaf normalization helpers for the Lexical schema boundary.
 *
 * These pure functions sanitize untrusted serialized presentation state (inline
 * CSS) and fold legacy decorator inputs (YouTube URLs) into their canonical
 * form. They import `@beep/md` and `@beep/schema` only — never the Lexical model
 * — so the schema getters in `Lexical.model.ts` can consume them while the model
 * top stays free of imperative sanitization noise.
 *
 * @packageDocumentation \@beep/lexical-schema/Lexical.normalize
 * @since 0.0.0
 */

import { BrowserSafeUrlPolicySpec, sanitizeUrlDestinationWithPolicy } from "@beep/md/Md.escape";
// cspell:word youtu
import * as Md from "@beep/md/Md.model";
import { A, O, Str, thunkEmptyStr } from "@beep/utils";
import { flow, Match } from "effect";
import { pipe } from "effect/Function";

const wwwPrefix = /^www\./u;
const embedOrShortsPrefix = /^\/(?:embed|shorts)\//u;

const firstPathSegment = (pathname: string): string =>
  pipe(Str.split(pathname, "/"), A.findFirst(Str.isNonEmpty), O.getOrElse(thunkEmptyStr));

/**
 * Parses a string into a `URL` without throwing: an unparseable input becomes
 * `None`. Uses the total `URL.parse` constructor (no `try`/`catch`).
 */
const safeUrl = (value: string): O.Option<URL> => O.fromNullishOr(URL.parse(value));

const youtubeVideoIdFromUrl = (url: URL): O.Option<string> =>
  Match.value(Str.replace(wwwPrefix, "")(url.hostname)).pipe(
    Match.when("youtu.be", () => O.some(firstPathSegment(url.pathname))),
    Match.when(
      (host: string) => host === "youtube.com" || Str.endsWith(".youtube.com")(host),
      () =>
        O.some(
          pipe(
            O.fromNullishOr(url.searchParams.get("v")),
            O.getOrElse(() => firstPathSegment(Str.replace(embedOrShortsPrefix, "")(url.pathname)))
          )
        )
    ),
    Match.orElse(O.none<string>)
  );

/**
 * Folds a legacy serialized YouTube embed value into a bare candidate video id.
 *
 * Already-bare ids pass through; `watch`, `embed`, `shorts`, and `youtu.be`
 * URLs decode to their canonical 11-character id; anything else (including an
 * unparseable string) returns the trimmed input unchanged so the downstream
 * `YouTubeVideoId` schema makes the accept/reject decision.
 *
 * @example
 * ```ts
 * import { legacyYouTubeVideoId } from "@beep/lexical-schema/Lexical.normalize"
 *
 * console.log(legacyYouTubeVideoId("https://youtu.be/M7lc1UVf-VE")) // "M7lc1UVf-VE"
 * ```
 *
 * @param value - Raw serialized YouTube embed value (bare id or legacy URL).
 * @returns The bare candidate video id, or the trimmed input when no id is found.
 * @category normalization
 * @since 0.0.0
 */
export const legacyYouTubeVideoId = (value: string): string => {
  const trimmed = Str.trim(value);
  return Md.YouTubeVideoId.is(trimmed)
    ? trimmed
    : pipe(
        safeUrl(trimmed),
        O.flatMap(youtubeVideoIdFromUrl),
        O.getOrElse(() => trimmed)
      );
};

/**
 * Sanitizes a serialized Lexical link URL before it reaches an anchor `href`.
 *
 * Uses the canonical browser-safe `@beep/md` URL policy so every browser URL
 * sink in the document stack shares one protocol and relative-path contract.
 *
 * @example
 * ```ts
 * import { sanitizeUrl } from "@beep/lexical-schema/Lexical.normalize"
 *
 * console.log(sanitizeUrl("javascript:alert(1)")) // "#"
 * ```
 *
 * @param value - Raw serialized Lexical link URL.
 * @returns The safe URL destination, or `#` when the input is unsafe for an anchor href.
 * @category normalization
 * @since 0.0.0
 */
export const sanitizeUrl = flow(Str.trim, sanitizeUrlDestinationWithPolicy(BrowserSafeUrlPolicySpec));

/**
 * Allowlist of inline CSS properties that are safe to preserve on serialized
 * Lexical text/element nodes. Anything outside this set — positioning, overlay,
 * stacking, animation, transforms, and any URL-bearing or function-call value —
 * is dropped, because a serialized editor state can originate from untrusted
 * persisted/synced content and Lexical renders these strings directly as DOM
 * `style` attributes (UI redressing / external resource beacons otherwise).
 */
const SAFE_INLINE_STYLE_PROPERTIES: ReadonlyArray<string> = [
  "color",
  "background-color",
  "font-weight",
  "font-style",
  "font-family",
  "font-size",
  "text-decoration",
  "text-decoration-line",
  "text-decoration-style",
  "text-decoration-color",
  "text-align",
  "text-transform",
  "letter-spacing",
  "line-height",
  "vertical-align",
  "white-space",
];

const isSafeStyleValue = (value: string): boolean =>
  Str.isNonEmpty(value) && !Str.includes("url(")(value) && !Str.includes("(")(value) && !Str.includes("\\")(value);

const parseSafeDeclaration = (declaration: string): O.Option<string> => {
  const colon = Str.indexOf(":")(declaration);
  return O.flatMap(colon, (index) => {
    const property = Str.toLowerCase(Str.trim(Str.takeLeft(declaration, index)));
    const value = Str.trim(Str.slice(index + 1)(declaration));
    return A.contains(SAFE_INLINE_STYLE_PROPERTIES, property) && isSafeStyleValue(value)
      ? O.some(`${property}: ${value}`)
      : O.none();
  });
};

/**
 * Sanitizes a serialized Lexical inline `style`/`textStyle` string down to an
 * allowlist of safe presentation declarations, dropping anything that could be
 * weaponized for UI redressing or external resource fetches. Empty input (the
 * common Lexical default) round-trips to the empty string.
 *
 * @example
 * ```ts
 * import { sanitizeInlineStyle } from "@beep/lexical-schema/Lexical.normalize"
 *
 * console.log(sanitizeInlineStyle("position:fixed;color:red")) // "color: red"
 * ```
 *
 * @param style - Raw serialized inline CSS declaration list.
 * @returns The sanitized declaration list restricted to safe presentation properties.
 * @category normalization
 * @since 0.0.0
 */
export const sanitizeInlineStyle = (style: string): string =>
  Str.isEmpty(Str.trim(style)) ? "" : A.join(A.getSomes(A.map(Str.split(style, ";"), parseSafeDeclaration)), "; ");

/**
 * Sanitizes a serialized Lexical bare CSS value (e.g. a table cell
 * `backgroundColor` or `verticalAlign`) that Lexical renders into a single DOM
 * `style` declaration. Any value that smuggles a second declaration (`;`), a
 * function call / URL (`(`), or an escape (`\`) is dropped to the empty string,
 * preventing the bare-value sink from being used for CSS injection.
 *
 * @example
 * ```ts
 * import { sanitizeStyleValue } from "@beep/lexical-schema/Lexical.normalize"
 *
 * console.log(sanitizeStyleValue("red; position: fixed")) // ""
 * ```
 *
 * @param value - Raw serialized single CSS value.
 * @returns The value when it is a safe single declaration, otherwise the empty string.
 * @category normalization
 * @since 0.0.0
 */
export const sanitizeStyleValue = (value: string): string => {
  const trimmed = Str.trim(value);
  return isSafeStyleValue(trimmed) && !Str.includes(";")(trimmed) && !Str.includes(":")(trimmed) ? trimmed : "";
};
