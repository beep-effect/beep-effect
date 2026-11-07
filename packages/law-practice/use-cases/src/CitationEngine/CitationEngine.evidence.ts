/** Server-only verified source lineage and explicit unverified outcomes.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeUseCasesId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { VerifiedSourceText } from "@beep/provenance/VerifiedTextAnchor";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";
import { CitationEngineAbsoluteMaxima } from "./CitationEngine.limits.ts";

const $I = $LawPracticeUseCasesId.create("CitationEngine/CitationEngine.evidence");
type EvidenceFields = { readonly source: S.Codec<VerifiedSourceText>; readonly parent: typeof SourceTextIdentity };
const EvidenceFields: EvidenceFields = { source: VerifiedSourceText, parent: SourceTextIdentity };
/** Verified source lineage issued by the canonical verifier. Structural source
 * identities alone cannot construct a valid proof. This is a server capability,
 * not a client transport codec.
 * **Example** (Inspect the unchanged branch)
 * ```ts
 * import { CitationEngineSourceEvidence } from "@beep/law-practice-use-cases/server"
 * console.log(CitationEngineSourceEvidence.cases.Unchanged !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationEngineSourceEvidence = S.TaggedUnion({
  Unchanged: EvidenceFields,
  Derived: { ...EvidenceFields, derivation: Sha256Hex },
}).pipe(
  $I.annoteSchema("CitationEngineSourceEvidence", {
    description:
      "An existing manifestation proof or a newly verified derived manifestation with its parent artifact lineage.",
  })
);
/** Schema-derived verified source lineage.
 * @category models
 * @since 0.0.0
 */
export type CitationEngineSourceEvidence = typeof CitationEngineSourceEvidence.Type;
const UnverifiedReason = LiteralKit(["shortcut", "invalid-span", "native-point-layout"]).pipe(
  $I.annoteSchema("UnverifiedReason", {
    description: "Semantic objects retained explicitly when no canonical source occurrence can be asserted.",
  })
);
const Unverified = S.Struct({ index: S.Natural, citation: Citation, reason: UnverifiedReason }).pipe(
  $I.annoteSchema("Unverified", {
    description: "Retained semantic value and original result index without occurrence authority.",
  })
);
const ComponentIssue = S.Struct({ index: S.Natural, name: S.tag("fullSpan"), reason: S.tag("invalid-span") }).pipe(
  $I.annoteSchema("ComponentIssue", {
    description: "An original full span that cannot issue canonical component evidence.",
  })
);
const UnboundWarning = S.Struct({
  previousModel: S.Natural,
  currentModel: S.Natural,
  reason: S.Literals(["unavailable-occurrence", "same-occurrence"]),
}).pipe(
  $I.annoteSchema("UnboundWarning", {
    description: "Original warning event whose verified endpoint identities cannot form a valid document edge.",
  })
);
/** Explicit outcomes for semantic values and source events that cannot issue
 * verified anchor evidence. These remain data beside successfully verified
 * mentions; they do not turn unverified spans into authority.
 * **Example** (Inspect unverified result ownership)
 * ```ts
 * import { CitationExtractionDiagnostics } from "@beep/law-practice-use-cases/server"
 * console.log(CitationExtractionDiagnostics.fields.unverified !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationExtractionDiagnostics extends S.Opaque<
  CitationExtractionDiagnostics,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    unverified: S.Array(Unverified).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    unverifiedComponents: S.Array(ComponentIssue).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
    unboundWarnings: S.Array(UnboundWarning).check(S.isMaxLength(CitationEngineAbsoluteMaxima.candidates)),
  }).pipe(
    $I.annoteSchema("CitationExtractionDiagnostics", {
      description:
        "Original ordered unverified semantic/component and unbound warning outcomes, without fabricated anchors.",
    })
  )
) {}
