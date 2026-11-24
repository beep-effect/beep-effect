/**
 * Occurrence anchors that tie a memory node to an exact span of a source file.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import { MarkdownRange } from "@beep/markdown";
import { LiteralKit } from "@beep/schema";
import { SourceTextIdentity, TextAnchor } from "@beep/text";
import { Anchored, mintOccurrenceId } from "@beep/text/Occurrence";
import { TextAnchorVerificationReceipt } from "@beep/text/VerifiedTextAnchor";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { OccurrenceId, PreimageMintError } from "@beep/text/Occurrence";
import type * as Digest from "effect/crypto/Digest";

const $I = $AgentMemoryStoreId.create("SpanAnchor.models");

/**
 * **Details**
 *
 * Only `utf16` exists in P0: `@beep/markdown` `MarkdownRange` and
 * `@beep/text` `TextAnchor` both count UTF-16 code units.
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
 * @category type-level
 * @since 0.0.0
 */
export type TextUnit = typeof TextUnit.Type;

/**
 * **Details**
 *
 * This is the occurrence shape of `text-knowledge-stack-rebuild`, built from
 * the `@beep/text` classes, so the store never mints a second span
 * identity (decision `identity-depends-on-provenance`).
 *
 * **Example** (Anchor a node to a source span)
 *
 * ```ts
 * import { OccurrenceAnchor } from "@beep/agent-memory-store"
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import { TextAnchor } from "@beep/text/TextAnchor"
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
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import { TextAnchor } from "@beep/text/TextAnchor"
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

/**
 * Derives the `@beep/text` occurrence id of a stored anchor.
 *
 * **Details**
 *
 * Builds the verification receipt from `source` and `anchor`, maps the
 * stored unit to the canonical `utf16-code-unit` (a new {@link TextUnit}
 * literal fails to compile here) and mints the `occurrence/v1` id. The id is
 * derived at read time: the stored event keeps its bytes and the payload
 * schema needs no service. A quote with a lone surrogate, which `TextAnchor`
 * admits, fails with the schema error of `PreimageMintError`.
 *
 * **Example** (Derive the occurrence id of an anchor)
 *
 * ```ts
 * import { OccurrenceAnchor, occurrenceIdOf } from "@beep/agent-memory-store"
 * import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/text/SourceTextIdentity"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 * import { PosixPath } from "@beep/schema/PosixPath"
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
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
 *   anchor: TextAnchor.make({ startChar: 6, endChar: 10, quote: "fact" }),
 * })
 * const id = occurrenceIdOf(anchor).pipe(Effect.provide(Digest.layerWebCrypto))
 * console.log(Effect.isEffect(id)) // true
 * ```
 *
 * @param anchor - The stored occurrence anchor.
 * @returns The occurrence id of the anchored span.
 * @category utilities
 * @since 0.0.0
 */
export const occurrenceIdOf = Effect.fn("OccurrenceAnchor.occurrenceId")(function* (
  anchor: OccurrenceAnchor
): Effect.fn.Return<OccurrenceId, PreimageMintError, Digest.Digest> {
  const anchored = TextUnit.match(anchor.unit, {
    utf16: () =>
      Anchored.make({
        receipt: TextAnchorVerificationReceipt.make({ source: anchor.source, anchor: anchor.anchor }),
      }),
  });
  return yield* mintOccurrenceId(anchored);
});
