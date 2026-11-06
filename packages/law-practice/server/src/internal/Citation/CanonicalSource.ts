/** Verified text manifestations derived from an authenticated input artifact.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { SourceTextDigest, SourceTextExtractor, SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import {
  VerifiedSourceText,
  VerifySourceTextIdentityInput,
  verifySourceTextIdentity,
} from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex, Sha256HexFromBytes } from "@beep/schema";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CitationExtractionEntryInput } from "./ExtractionEntry.ts";
import { makeCitationPythonUnicode } from "./PythonUnicode.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationEngineLimits, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import type * as Digest from "effect/crypto/Digest";
import type { CitationPythonUnicodeFailure } from "./PythonUnicode.ts";

const $I = $LawPracticeServerId.create("internal/Citation/CanonicalSource");
const Reason = LiteralKit(["invalid-input", "unverifiable-text", "identity-failed"]).pipe(
  $I.annoteSchema("Reason", {
    description: "Closed canonical text derivation failures without source content or nested causes.",
  })
);
/** @internal @category errors @since 0.0.0 */
export class CitationCanonicalSourceFailure extends S.TaggedError<
  CitationCanonicalSourceFailure,
  { readonly brand: unique symbol }
>($I`CitationCanonicalSourceFailure`)(
  "CitationCanonicalSourceFailure",
  { reason: Reason },
  $I.annoteError<CitationCanonicalSourceFailure>("CitationCanonicalSourceFailure", {
    description: "Canonical manifestation derivation failed without source-bearing diagnostics.",
  })
) {}
const failed = (reason: typeof Reason.Type) => CitationCanonicalSourceFailure.make({ reason });
/** @internal @category models @since 0.0.0 */
export const CitationSourceRole = LiteralKit(["plain", "markup"]).pipe(
  $I.annoteSchema("CitationSourceRole", {
    description: "Which original primitive argument receives the authenticated source text.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationSourceRole = typeof CitationSourceRole.Type;
/** @internal @category models @since 0.0.0 */
export class CitationSourceDerivationModes extends S.Opaque<
  CitationSourceDerivationModes,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    role: CitationSourceRole,
    cleanSteps: CitationExtractionEntryInput.fields.cleanSteps,
    container: CitationExtractionEntryInput.fields.container,
  }).pipe(
    $I.annoteSchema("CitationSourceDerivationModes", {
      description: "Named primitive cleaning invocation data included in changed-text derivation identity.",
    })
  )
) {}
const Modes = S.toType(CitationSourceDerivationModes);
const ModesJson = Modes.pipe(S.toCodecJson);
type EvidenceFields = { readonly source: S.Codec<VerifiedSourceText>; readonly parent: typeof SourceTextIdentity };
const EvidenceFields: EvidenceFields = { source: VerifiedSourceText, parent: SourceTextIdentity };
/** @internal @category models @since 0.0.0 */
export const CitationCanonicalSourceResult = S.TaggedUnion({
  Unchanged: EvidenceFields,
  Derived: { ...EvidenceFields, derivation: Sha256Hex },
}).pipe(
  $I.annoteSchema("CitationCanonicalSourceResult", {
    description:
      "An existing manifestation proof or a newly verified derived manifestation with its parent artifact lineage.",
  })
);
/** @internal @category models @since 0.0.0 */
export type CitationCanonicalSourceResult = typeof CitationCanonicalSourceResult.Type;
const Derivation = S.fromJsonString(
  S.Tuple([S.tag("citation-source-derivation/v1"), SourceTextIdentity, Sha256Hex, Modes, SourceTextDigest])
).pipe(
  $I.annoteSchema("Derivation", {
    description: "Ordered versioned parent/engine/mode/output-digest commitment for changed text.",
  })
);
const identityHash = Effect.fn("Citation.hashSourceManifestation")(function* (text: string) {
  return yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(text)).pipe(
    Effect.mapError(() => failed("identity-failed")),
    Effect.catchDefect(() => Effect.fail(failed("identity-failed")))
  );
});
/** Retain an unchanged canonical manifestation without inventing another extractor.
 * The original parent proof is genuine, immutable and preserved by identity.
 * @internal @category operations @since 0.0.0
 */
export const retainCitationCanonicalSource: (
  input: unknown
) => Effect.Effect<CitationCanonicalSourceResult, CitationCanonicalSourceFailure> = Effect.fn(
  "Citation.retainCanonicalSource"
)(function* (input: unknown): Effect.fn.Return<CitationCanonicalSourceResult, CitationCanonicalSourceFailure> {
  const source = yield* S.decodeUnknownEffect(VerifiedSourceText)(input).pipe(
    Effect.mapError(() => failed("invalid-input"))
  );
  return CitationCanonicalSourceResult.cases.Unchanged.make({ source, parent: source.source });
});
/** Derive text evidence for actual native tokenizer output. Composition must
 * itself invoke extraction from the authenticated parent text; this helper does
 * not independently certify a supplied computation. The public verifier alone
 * issues the output capability. Locator normalization and artifact identity stay
 * with the parent; a changed manifestation has its own extractor/text identity.
 * @internal @category operations @since 0.0.0
 */
export const deriveCitationCanonicalSource: {
  (
    engineArtifact: Sha256Hex,
    parentInput: unknown,
    native: unknown,
    modesInput: unknown
  ): (
    limits: CitationEngineLimits
  ) => Effect.Effect<
    CitationCanonicalSourceResult,
    CitationCanonicalSourceFailure | CitationPythonUnicodeFailure | CitationSafetyLimitExceeded,
    Digest.Digest | CitationTextBudget
  >;
  (
    limits: CitationEngineLimits,
    engineArtifact: Sha256Hex,
    parentInput: unknown,
    native: unknown,
    modesInput: unknown
  ): Effect.Effect<
    CitationCanonicalSourceResult,
    CitationCanonicalSourceFailure | CitationPythonUnicodeFailure | CitationSafetyLimitExceeded,
    Digest.Digest | CitationTextBudget
  >;
} = dual(
  5,
  Effect.fn("Citation.deriveCanonicalSource")(function* (
    limits: CitationEngineLimits,
    engineArtifact: Sha256Hex,
    parentInput: unknown,
    native: unknown,
    modesInput: unknown
  ): Effect.fn.Return<
    CitationCanonicalSourceResult,
    CitationCanonicalSourceFailure | CitationPythonUnicodeFailure | CitationSafetyLimitExceeded,
    Digest.Digest | CitationTextBudget
  > {
    const parent = yield* S.decodeUnknownEffect(VerifiedSourceText)(parentInput).pipe(
      Effect.mapError(() => failed("invalid-input"))
    );
    const modes = yield* S.decodeUnknownEffect(Modes)(modesInput).pipe(Effect.mapError(() => failed("invalid-input")));
    const encoded = yield* S.encodeEffect(ModesJson)(modes).pipe(Effect.mapError(() => failed("invalid-input")));
    const captured = yield* S.decodeEffect(ModesJson)(encoded).pipe(Effect.mapError(() => failed("invalid-input")));
    const budget = yield* CitationTextBudget;
    const unicode = yield* makeCitationPythonUnicode(limits);
    const output = yield* unicode.fromStorageReserved(native, budget.reserve);
    if (output.text === parent.sourceText) return yield* retainCitationCanonicalSource(parent);
    const outputHash = yield* identityHash(output.text);
    const textDigest = SourceTextDigest.make(`sha256:${outputHash}`);
    const parentIdentity = parent.source;
    const key = yield* S.encodeEffect(Derivation)([
      "citation-source-derivation/v1",
      parentIdentity,
      engineArtifact,
      captured,
      textDigest,
    ]).pipe(Effect.mapError(() => failed("identity-failed")));
    yield* budget.reserve(Str.length(key));
    const derivation = yield* identityHash(key);
    const identity = SourceTextIdentity.make({
      ...parentIdentity,
      textDigest,
      extractor: SourceTextExtractor.make({ name: "citation-document-text", version: `csd1:${derivation}` }),
    });
    const source = yield* verifySourceTextIdentity(
      VerifySourceTextIdentityInput.make({
        expectedSource: identity,
        source: identity,
        sourceText: output.text,
      })
    ).pipe(Effect.mapError(() => failed("unverifiable-text")));
    return CitationCanonicalSourceResult.cases.Derived.make({ source, parent: parentIdentity, derivation });
  })
);
