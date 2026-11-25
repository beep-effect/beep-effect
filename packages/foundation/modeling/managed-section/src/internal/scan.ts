import { $ManagedSectionId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PlacedSection, Section } from "../Section.ts";
import type { CommentStyle } from "../CommentStyle.ts";
import type { Eol, SectionDialect } from "../SectionDialect.ts";

const $I = $ManagedSectionId.create("internal/scan");

/**
 * The ways a document can be structurally unreadable.
 *
 * **Example** (Validate a structural failure reason)
 *
 * ```ts
 * import { ScanFailureReason } from "@beep/managed-section/internal/scan";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ScanFailureReason)("orphanedEnd")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScanFailureReason = LiteralKit([
  "unterminatedSection",
  "orphanedEnd",
  "overlappingSections",
  "duplicateSection",
]).pipe(
  $I.annoteSchema("ScanFailureReason", { description: "The ambiguities refused by the managed-section scanner." })
);
/**
 * The structural ambiguity reason validated by {@link ScanFailureReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScanFailureReason = typeof ScanFailureReason.Type;

/**
 * The existing ordered list of scanner failure reasons.
 *
 * **Example** (Read the first scanner failure reason)
 *
 * ```ts
 * import { SCAN_FAILURE_REASONS } from "@beep/managed-section/internal/scan";
 *
 * console.log(SCAN_FAILURE_REASONS[0]) // unterminatedSection
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SCAN_FAILURE_REASONS = ScanFailureReason.literals;

/**
 * A scanner failure retains its required, explicitly undefined-capable key.
 *
 * **Example** (Validate a failure with an unknown key)
 *
 * ```ts
 * import { ScanFailure } from "@beep/managed-section/internal/scan";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ScanFailure)({ reason: "orphanedEnd", line: 1, key: undefined })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ScanFailure extends S.Opaque<ScanFailure, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: ScanFailureReason.pipe(
      $I.annoteKey("ScanFailure.reason", { description: "The first structural ambiguity found." })
    ),
    line: S.Finite.pipe(
      $I.annoteKey("ScanFailure.line", { description: "The one-based line of the offending marker." })
    ),
    key: S.UndefinedOr(S.String).pipe(
      $I.annoteKey("ScanFailure.key", { description: "The section key, explicitly undefined when unknown." })
    ),
  }).pipe(
    $I.annoteSchema("ScanFailure", { description: "A plain scanner failure with its reason and marker location." })
  )
) {}

/**
 * The successful variant of {@link ScanResult}: every located section, in
 * source order.
 *
 * **Example** (Construct an empty successful scan)
 *
 * ```ts
 * import { ScanSucceeded } from "@beep/managed-section/internal/scan";
 *
 * const result = ScanSucceeded.make({ ok: true, sections: [] });
 * console.log(result.sections.length) // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ScanSucceeded extends S.Opaque<ScanSucceeded, { readonly brand: unique symbol }>()(
  S.Struct({
    ok: S.tag(true).pipe($I.annoteKey("ScanResult.ok", { description: "The scan succeeded." })),
    sections: S.Array(S.suspend(() => PlacedSection)).pipe(
      $I.annoteKey("ScanResult.sections", { description: "Located sections in source order." })
    ),
  }).pipe($I.annoteSchema("ScanSucceeded", { description: "A scan that located every section unambiguously." }))
) {}

/**
 * **Example** (Construct a failed scan)
 *
 * ```ts
 * import { ScanFailed, ScanFailure } from "@beep/managed-section/internal/scan";
 *
 * const result = ScanFailed.make({
 *   ok: false,
 *   failure: ScanFailure.make({ reason: "orphanedEnd", line: 3, key: "tool" }),
 * });
 * console.log(result.failure.reason) // orphanedEnd
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ScanFailed extends S.Opaque<ScanFailed, { readonly brand: unique symbol }>()(
  S.Struct({
    ok: S.tag(false).pipe($I.annoteKey("ScanResult.ok", { description: "The scan failed." })),
    failure: ScanFailure.pipe($I.annoteKey("ScanResult.failure", { description: "The first structural failure." })),
  }).pipe($I.annoteSchema("ScanFailed", { description: "A scan refused at its first structural ambiguity." }))
) {}

/**
 * Plain scan results keep the boolean `ok` discriminant and variant-specific fields.
 *
 * **Example** (Validate a successful empty scan)
 *
 * ```ts
 * import { ScanResult } from "@beep/managed-section/internal/scan";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ScanResult)({ ok: true, sections: [] })) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ScanResult = S.Union([ScanSucceeded, ScanFailed]).pipe(
  $I.annoteSchema("ScanResult", {
    description: "Either located sections or the first ambiguity, in plain-object form.",
  })
);
/**
 * The success or failure shape validated by {@link ScanResult}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScanResult = typeof ScanResult.Type;

const failedAt = (reason: ScanFailureReason, line: number, key: string): ScanResult =>
  ScanFailed.make({ ok: false, failure: ScanFailure.make({ reason, line, key }) });

/**
 * Detects a document's dominant line ending.
 *
 * **Details**
 *
 * Any CRLF makes the document CRLF.
 *
 * **Example** (Detect CRLF in mixed line endings)
 *
 * ```ts
 * import { detectEol } from "@beep/managed-section/internal/scan";
 *
 * console.log(detectEol("first\nsecond\r\n") === "\r\n") // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const detectEol = (text: string): Eol => (Str.includes("\r\n")(text) ? "\r\n" : "\n");

/**
 * Collapse CRLF to LF.
 *
 * **Details**
 *
 * Applied to section content at parse time so that the `Section` values the
 * rest of the package compares are already canonical. Doing it here rather
 * than inside equality keeps `Equal.equals` honest for a consumer comparing
 * two sections directly, and it is what stops a CRLF document from reporting
 * drift on every single run.
 *
 * **Example** (Normalize section content to LF)
 *
 * ```ts
 * import { normalizeEol } from "@beep/managed-section/internal/scan";
 *
 * console.log(normalizeEol("first\r\nsecond") === "first\nsecond") // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const normalizeEol = (text: string): string => Str.replace(/\r\n/g, "\n")(text);

const stripOneLeadingBreak = (text: string): string =>
  Str.startsWith("\r\n")(text) ? Str.slice(2)(text) : Str.startsWith("\n")(text) ? Str.slice(1)(text) : text;

const stripOneTrailingBreak = (text: string): string =>
  Str.endsWith("\r\n")(text) ? Str.slice(0, -2)(text) : Str.endsWith("\n")(text) ? Str.slice(0, -1)(text) : text;

const lineStarts = (text: string): ReadonlyArray<number> => {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }
  return starts;
};

const lineAt: {
  (starts: ReadonlyArray<number>, offset: number): number;
  (offset: number): (starts: ReadonlyArray<number>) => number;
} = dual(2, (starts: ReadonlyArray<number>, offset: number): number => {
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if (A.getUnsafe(starts, mid) <= offset) {
      low = mid;
    } else {
      high = mid - 1;
    }
  }
  return low + 1;
});

interface MarkerHit {
  readonly attributes?: Record<string, string>;
  readonly end: number;
  readonly key: string;
  readonly kind: "BEGIN" | "END";
  readonly start: number;
  readonly style: CommentStyle;
}

/**
 * The identity two sections must share to be duplicates of each other.
 *
 * **Details**
 *
 * The key and comment-style identity are separated by NUL. Content and attributes
 * do not participate in this identity.
 *
 * **Example** (Compare direct and curried section identities)
 *
 * ```ts
 * import { identityOf } from "@beep/managed-section/internal/scan";
 * import { CommentStyle } from "@beep/managed-section/CommentStyle";
 *
 * console.log(identityOf("tool", CommentStyle.hash) === identityOf(CommentStyle.hash)("tool")) // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const identityOf: {
  (key: string, style: CommentStyle): string;
  (style: CommentStyle): (key: string) => string;
} = dual(2, (key: string, style: CommentStyle): string => `${key}\u0000${style.id}`);

const collectHits: {
  (text: string, dialect: SectionDialect): ReadonlyArray<MarkerHit>;
  (dialect: SectionDialect): (text: string) => ReadonlyArray<MarkerHit>;
} = dual(2, (text: string, dialect: SectionDialect): ReadonlyArray<MarkerHit> => {
  const hits: Array<MarkerHit> = [];
  const countedMarkerStarts = MutableHashSet.empty<number>();
  for (const [style, match, attributes] of dialect.markerMatches(text)) {
    const start = O.getOrThrow(O.fromUndefinedOr(match.index));
    const alreadyCountedByEarlierStyle = MutableHashSet.has(countedMarkerStarts, start);
    if (alreadyCountedByEarlierStyle) continue;
    MutableHashSet.add(countedMarkerStarts, start);
    hits.push({
      kind: match[1] === "BEGIN" ? "BEGIN" : "END",
      key: A.getUnsafe(match, 2),
      style,
      start,
      end: start + match[0].length,
      attributes,
    });
  }
  return A.sort(
    hits,
    Order.mapInput(Order.Number, (hit: MarkerHit) => hit.start)
  );
});

interface ScanState {
  readonly firstSeenAt: MutableHashMap.MutableHashMap<string, number>;
  open: MarkerHit | undefined;
  readonly sections: Array<PlacedSection>;
  readonly starts: ReadonlyArray<number>;
  readonly text: string;
}

const beginSection = (state: ScanState, hit: MarkerHit): ScanResult | undefined => {
  if (state.open !== undefined) {
    return failedAt("overlappingSections", lineAt(state.starts, hit.start), hit.key);
  }
  state.open = hit;
  return undefined;
};

const placeSection = (state: ScanState, open: MarkerHit, hit: MarkerHit): PlacedSection => {
  const inner = stripOneTrailingBreak(stripOneLeadingBreak(Str.slice(open.end, hit.start)(state.text)));
  const attributesOmittedWhenBareSoDefaultFills = O.getSomesStruct({ attributes: O.fromUndefinedOr(open.attributes) });
  return PlacedSection.make({
    section: Section.make({
      key: open.key,
      commentStyle: open.style,
      content: normalizeEol(inner),
      ...attributesOmittedWhenBareSoDefaultFills,
    }),
    start: open.start,
    end: hit.end,
    line: lineAt(state.starts, open.start),
  });
};

const closesSameKeyAndStyle = (open: MarkerHit, hit: MarkerHit): boolean =>
  open.key === hit.key && open.style.id === hit.style.id;

const endSection = (state: ScanState, hit: MarkerHit): ScanResult | undefined => {
  const open = state.open;
  if (open === undefined || !closesSameKeyAndStyle(open, hit)) {
    return failedAt("orphanedEnd", lineAt(state.starts, hit.start), hit.key);
  }
  const identity = identityOf(open.key, open.style);
  if (MutableHashMap.has(state.firstSeenAt, identity)) {
    return failedAt("duplicateSection", lineAt(state.starts, open.start), open.key);
  }
  MutableHashMap.set(state.firstSeenAt, identity, open.start);
  state.sections.push(placeSection(state, open, hit));
  state.open = undefined;
  return undefined;
};

const finishScan = (state: ScanState): ScanResult =>
  state.open === undefined
    ? ScanSucceeded.make({ ok: true, sections: state.sections })
    : failedAt("unterminatedSection", lineAt(state.starts, state.open.start), state.open.key);

/**
 * Locate every managed section, in document order.
 *
 * **Details**
 *
 * A bounded linear pass — no recursion, so no stack-overflow surface on
 * hostile input. Sections cannot nest: a begin marker encountered while
 * another section is open is `overlappingSections`, not an inner block.
 *
 * **Example** (Locate a section from generated marker lines)
 *
 * ```ts
 * import { scan } from "@beep/managed-section/internal/scan";
 * import { CommentStyle } from "@beep/managed-section/CommentStyle";
 * import { SectionId } from "@beep/managed-section/Section";
 * import { SectionDialect } from "@beep/managed-section/SectionDialect";
 *
 * const dialect = SectionDialect.default;
 * const id = SectionId.make({ key: "tool", commentStyle: CommentStyle.hash });
 * const text = [dialect.beginMarker(id), "echo hello", dialect.endMarker(id)].join("\n");
 * const result = scan(text, dialect);
 * console.log(result.ok && result.sections[0]?.section.content) // echo hello
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const scan: {
  (text: string, dialect: SectionDialect): ScanResult;
  (dialect: SectionDialect): (text: string) => ScanResult;
} = dual(2, (text: string, dialect: SectionDialect): ScanResult => {
  const state: ScanState = {
    text,
    starts: lineStarts(text),
    sections: [],
    firstSeenAt: MutableHashMap.empty<string, number>(),
    open: undefined,
  };
  for (const hit of collectHits(text, dialect)) {
    const failure = hit.kind === "BEGIN" ? beginSection(state, hit) : endSection(state, hit);
    if (failure !== undefined) {
      return failure;
    }
  }
  return finishScan(state);
});
