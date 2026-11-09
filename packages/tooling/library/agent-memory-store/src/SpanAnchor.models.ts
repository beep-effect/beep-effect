/**
 * Occurrence anchors that tie a memory node to an exact span of a source file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { MarkdownRange } from "@beep/markdown";
import { SourceTextIdentity, TextAnchor } from "@beep/provenance";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $AgentMemoryStoreId.create("SpanAnchor.models");

/**
 * Unit the anchor offsets count in.
 *
 * **Details**
 *
 * Only `utf16` exists in P0: `@beep/markdown` `MarkdownRange` and
 * `@beep/provenance` `TextAnchor` both count UTF-16 code units.
 *
 * **Example** (Check the text unit)
 *
 * ```ts
 * import { TextUnit } from "@beep/agent-memory-store"
 *
 * console.log(TextUnit.is.utf16("utf16"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TextUnit = LiteralKit(["utf16"]).pipe(
  $I.annoteSchema("TextUnit", {
    description: "Unit anchor offsets count in; UTF-16 code units only.",
  })
);

/**
 * Runtime type for {@link TextUnit}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TextUnit = typeof TextUnit.Type;

/**
 * Occurrence preimage of a node span: source identity, unit, range and quote.
 *
 * **Details**
 *
 * This is the occurrence shape of `text-knowledge-stack-rebuild`, built from
 * the `@beep/provenance` classes, so the store never mints a second span
 * identity (decision `identity-depends-on-provenance`).
 *
 * **Example** (Anchor a node to a source span)
 *
 * ```ts
 * import { OccurrenceAnchor } from "@beep/agent-memory-store"
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const digest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const anchor = OccurrenceAnchor.make({
 *   source: SourceTextIdentity.make({
 *     scopeRef: "memory",
 *     sourceRef: "notes",
 *     locator: PosixPath.make("notes/decisions.md"),
 *     sourceDigest: digest,
 *     textDigest: digest,
 *     extractor: SourceTextExtractor.make({ name: "markdown", version: "1" }),
 *     normalizationVersion: "1",
 *   }),
 *   unit: "utf16",
 *   anchor: TextAnchor.make({ startChar: 0, endChar: 4, quote: "fact" }),
 * })
 * console.log(anchor.unit)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class OccurrenceAnchor extends S.Opaque<OccurrenceAnchor, { readonly brand: unique symbol }>()(
  S.Struct({
    source: SourceTextIdentity.annotateKey({ description: "Identity of the exact source text manifestation." }),
    unit: TextUnit.annotateKey({ description: "Unit the anchor offsets count in." }),
    anchor: TextAnchor.annotateKey({ description: "Half-open range and exact quote inside the source text." }),
  }).pipe(
    $I.annoteSchema("OccurrenceAnchor", {
      description: "Occurrence preimage of a node span: source identity, unit, range and quote.",
    })
  )
) {}

/**
 * Projects an occurrence anchor onto a `@beep/markdown` range.
 *
 * **Details**
 *
 * `offset` is the anchor's `startChar` and `length` is `endChar - startChar`;
 * both count UTF-16 code units, so no unit conversion happens.
 *
 * **Example** (Project an anchor to a Markdown range)
 *
 * ```ts
 * import { OccurrenceAnchor, toMarkdownRange } from "@beep/agent-memory-store"
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import { PosixPath } from "@beep/schema/PosixPath"
 *
 * const digest = SourceTextDigest.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * const range = toMarkdownRange(
 *   OccurrenceAnchor.make({
 *     source: SourceTextIdentity.make({
 *       scopeRef: "memory",
 *       sourceRef: "notes",
 *       locator: PosixPath.make("notes/decisions.md"),
 *       sourceDigest: digest,
 *       textDigest: digest,
 *       extractor: SourceTextExtractor.make({ name: "markdown", version: "1" }),
 *       normalizationVersion: "1",
 *     }),
 *     unit: "utf16",
 *     anchor: TextAnchor.make({ startChar: 6, endChar: 10, quote: "fact" }),
 *   })
 * )
 * console.log(range.offset, range.length) // 6 4
 * ```
 *
 * @param anchor - The occurrence anchor to project.
 * @returns The equivalent Markdown range.
 * @category utilities
 * @since 0.0.0
 */
export const toMarkdownRange = (anchor: OccurrenceAnchor): MarkdownRange =>
  MarkdownRange.make({
    offset: anchor.anchor.startChar,
    length: anchor.anchor.endChar - anchor.anchor.startChar,
  });
