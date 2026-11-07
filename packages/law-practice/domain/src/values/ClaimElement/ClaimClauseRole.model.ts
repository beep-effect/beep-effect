/**
 * Atomic source-role plans for inspection; independent of NLP drivers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import { LiteralKit } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { PosInt } from "../../internal/PosInt.ts";
import { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";
import { ClaimInputDecomposition } from "./ClaimElement.inspection.model.ts";
import { ClaimTermDeterminer } from "./ClaimElement.model.ts";
import { ClaimLexicalEvidence, ClaimLexicalSourceIdentity, ClaimLexicalToken } from "./ClaimLexicalEvidence.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimClauseRole");
/**
 * Original aligned token data ordinal; it never indexes the proof registry.
 *
 * **Example** (Check an untrusted original lexical token ordinal value)
 *
 * ```ts
 * import { OriginalLexicalTokenOrdinal } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(OriginalLexicalTokenOrdinal)(1)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const OriginalLexicalTokenOrdinal = PosInt.pipe(
  S.brand("OriginalLexicalTokenOrdinal"),
  $I.annoteSchema("OriginalLexicalTokenOrdinal", {
    description: "One-based position in the authoritative original aligned token table.",
  })
);
/**
 * Original data ordinal type.
 * @category type-level
 * @since 0.0.0
 */
export type OriginalLexicalTokenOrdinal = typeof OriginalLexicalTokenOrdinal.Type;
/**
 * Proof-registry ordinal, distinct from original lexical data positions.
 *
 * **Example** (Check an untrusted claim source proof ordinal value)
 *
 * ```ts
 * import { ClaimSourceProofOrdinal } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceProofOrdinal)(1)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceProofOrdinal = PosInt.pipe(
  S.brand("ClaimSourceProofOrdinal"),
  $I.annoteSchema("ClaimSourceProofOrdinal", {
    description: "One-based identity of a typed ranked proof, never an original-input index.",
  })
);
/**
 * Proof ordinal type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceProofOrdinal = typeof ClaimSourceProofOrdinal.Type;
/**
 * Source-proven nominal policy roles, with explicit unknown/legacy cases.
 *
 * **Example** (Check an untrusted claim nominal policy role value)
 *
 * ```ts
 * import { ClaimNominalPolicyRole } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimNominalPolicyRole)("unknown")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimNominalPolicyRole = LiteralKit([
  "legacy",
  "unknown",
  "generic-plural",
  "quantified-introduction",
  "preamble-introduction",
  "explicit-name",
  "alias-reference",
  "demonstrative-reference",
]).pipe(
  $I.annoteSchema("ClaimNominalPolicyRole", {
    description: "A grammatical role never supplies countability or identity from POS alone.",
  })
);
/**
 * Nominal policy role type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimNominalPolicyRole = typeof ClaimNominalPolicyRole.Type;
/**
 * Nominal source ownership; emitted text is never invented.
 *
 * **Example** (Check an untrusted claim nominal span value)
 *
 * ```ts
 * import { ClaimNominalSpan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimNominalSpan)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimNominalSpan extends S.Opaque<ClaimNominalSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    head: TextAnchor,
    determiner: ClaimTermDeterminer,
    role: ClaimNominalPolicyRole,
  }).pipe(
    $I.annoteSchema("ClaimNominalSpan", {
      description: "A complete source nominal with its lexical head interval and supported or unknown policy role.",
    })
  )
) {}
/**
 * Functional predicate span proven by grammar plus lexical evidence.
 *
 * **Example** (Check an untrusted claim predicate span value)
 *
 * ```ts
 * import { ClaimPredicateSpan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimPredicateSpan)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimPredicateSpan extends S.Opaque<ClaimPredicateSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    kind: S.Literals([
      "finite",
      "infinitive",
      "gerund",
      "auxiliary",
      "auxiliary-head",
      "possession",
      "adjectival",
      "adjunct",
    ]),
  }).pipe(
    $I.annoteSchema("ClaimPredicateSpan", {
      description: "Consumed predicate/function source interval; no object NP is consumed.",
    })
  )
) {}
/**
 * Source-owned grammatical clause with explicit predicate and nominal proof links.
 *
 * **Example** (Check an untrusted claim clause span value)
 *
 * ```ts
 * import { ClaimClauseSpan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimClauseSpan)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimClauseSpan extends S.Opaque<ClaimClauseSpan, { readonly brand: unique symbol }>()(
  S.Struct({
    anchor: TextAnchor,
    kind: S.Literals(["main", "relative", "conditional", "complement"]),
    introducer: S.OptionFromNullOr(TextAnchor),
    predicates: S.Array(TextAnchor),
    nominals: S.Array(TextAnchor),
  }).pipe(
    $I.annoteSchema("ClaimClauseSpan", {
      description: "Grammatical ownership only; never physical ownership or a new dependency route.",
    })
  )
) {}
/**
 * Source certificates distinguish grammatical roles without lexical guessing.
 *
 * **Example** (Check an untrusted claim source proof value)
 *
 * ```ts
 * import { ClaimSourceProof } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceProof)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceProof = LiteralKit([
  "finite-pp",
  "reduced-adjective",
  "reduced-participle",
  "scalar-auxiliary",
  "action",
  "coordinated-action",
  "nominal-coordination",
  "quantity",
  "nominal-modifier",
])
  .toTaggedUnion("kind")({
    "finite-pp": {
      operator: TextAnchor,
      lexicalPredicate: TextAnchor,
      subject: TextAnchor,
      complement: TextAnchor,
      introducer: TextAnchor,
      labels: S.Array(TextAnchor),
      adjuncts: S.Array(TextAnchor),
    },
    "reduced-adjective": {
      operator: TextAnchor,
      nominal: TextAnchor,
      complement: TextAnchor,
      introducer: TextAnchor,
      governingPredicate: S.OptionFromNullOr(TextAnchor),
    },
    "reduced-participle": {
      operator: TextAnchor,
      nominal: TextAnchor,
      complement: TextAnchor,
      introducer: TextAnchor,
      governingPredicate: S.OptionFromNullOr(TextAnchor),
    },
    "scalar-auxiliary": {
      operator: TextAnchor,
      auxiliary: TextAnchor,
      scalar: TextAnchor,
      participle: TextAnchor,
      adjuncts: S.Array(TextAnchor),
      complement: TextAnchor,
      introducer: TextAnchor,
    },
    action: { operator: TextAnchor, governor: TextAnchor, object: TextAnchor },
    "coordinated-action": {
      operator: TextAnchor,
      governor: TextAnchor,
      firstAction: TextAnchor,
      coordinator: TextAnchor,
      object: TextAnchor,
    },
    "nominal-coordination": {
      core: TextAnchor,
      head: TextAnchor,
      branches: S.Array(TextAnchor),
      mode: S.Literals(["alternative", "shared-head"]),
    },
    quantity: { core: TextAnchor, head: TextAnchor, mode: S.Literals(["introduction", "reference", "cardinal"]) },
    "nominal-modifier": { core: TextAnchor, operator: TextAnchor, head: TextAnchor },
  })
  .pipe(
    $I.annoteSchema("ClaimSourceProof", {
      description:
        "Validated source-only evidence committed atomically with its element plan; no countability or identity from POS alone.",
    })
  );
/**
 * Source proof type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceProof = typeof ClaimSourceProof.Type;

/**
 * Finite membership slots of one source-local proof registry.
 *
 * **Example** (Check an untrusted claim source proof slot value)
 *
 * ```ts
 * import { ClaimSourceProofSlot } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceProofSlot)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceProofSlot = LiteralKit([
  "token",
  "scope",
  "boundary",
  "opening",
  "closure",
  "core",
  "operator",
  "argument",
  "attachment",
  "control",
  "intrinsic-noun",
]).pipe(
  $I.annoteSchema("ClaimSourceProofSlot", {
    description: "A reference resolves to this exact finite target role before atomic source commitment.",
  })
);
/**
 * Source proof membership type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceProofSlot = typeof ClaimSourceProofSlot.Type;
/**
 * Actual typed edge; registry ordinals never identify another source.
 *
 * **Example** (Check an untrusted claim source proof ref value)
 *
 * ```ts
 * import { ClaimSourceProofRef } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceProofRef)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSourceProofRef extends S.Opaque<ClaimSourceProofRef, { readonly brand: unique symbol }>()(
  S.Struct({ ordinal: ClaimSourceProofOrdinal, slot: ClaimSourceProofSlot }).pipe(
    $I.annoteSchema("ClaimSourceProofRef", {
      description: "An actual source-local field edge included in rank, membership and DAG validation.",
    })
  )
) {}
/**
 * Positive independent nominal opening variants.
 *
 * **Example** (Check an untrusted claim head opening value)
 *
 * ```ts
 * import { ClaimHeadOpening } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimHeadOpening)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimHeadOpening = LiteralKit([
  "determiner",
  "quantity",
  "unknown-number",
  "possessive",
  "qualified-start",
  "preposition-object",
  "lexical-object",
  "list-item",
]).pipe(
  $I.annoteSchema("ClaimHeadOpening", {
    description: "An actual source slot; no candidate reservation or failed predicate can prove this opening.",
  })
);
/**
 * Nominal opening type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimHeadOpening = typeof ClaimHeadOpening.Type;
/**
 * Independent raw closing boundaries, preceding nominal certification.
 *
 * **Example** (Check an untrusted claim head boundary value)
 *
 * ```ts
 * import { ClaimHeadBoundary } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimHeadBoundary)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimHeadBoundary = LiteralKit([
  "finite",
  "auxiliary",
  "adjunct",
  "reduced",
  "declaration",
  "reference-label",
  "relative",
  "determiner",
  "preposition",
  "separator",
  "terminal",
  "qualified-end",
]).pipe(
  $I.annoteSchema("ClaimHeadBoundary", {
    description: "A source boundary never relies on a subsequently derived argument or relative attachment.",
  })
);
/**
 * Nominal boundary type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimHeadBoundary = typeof ClaimHeadBoundary.Type;
/**
 * Finite operator licenses corroborated by source context and lexical facts.
 *
 * **Example** (Check an untrusted claim operator license value)
 *
 * ```ts
 * import { ClaimOperatorLicense } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimOperatorLicense)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimOperatorLicense = LiteralKit([
  "qualified-transition",
  "finite",
  "continued-finite",
  "auxiliary",
  "infinitive",
  "first-action",
  "continued-action",
  "event",
  "reduced",
]).pipe(
  $I.annoteSchema("ClaimOperatorLicense", {
    description: "A positive operator result; provisional, unsupported and rejected candidates are not certificates.",
  })
);
/**
 * Positive operator type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimOperatorLicense = typeof ClaimOperatorLicense.Type;
/**
 * Complete ordered argument segment; whitespace has explicit source coverage.
 *
 * **Example** (Check an untrusted claim argument coverage value)
 *
 * ```ts
 * import { ClaimArgumentCoverage } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimArgumentCoverage)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimArgumentCoverage = LiteralKit(["token", "gap"])
  .toTaggedUnion("kind")({
    token: {
      anchor: TextAnchor,
      proof: ClaimSourceProofRef,
      role: S.Literals(["operator", "adjunct", "adposition", "pp", "direct"]),
    },
    gap: { anchor: TextAnchor },
  })
  .pipe(
    $I.annoteSchema("ClaimArgumentCoverage", {
      description:
        "Every token and nonempty whitespace gap between the operator and complete direct argument is accounted for.",
    })
  );
/**
 * Argument segment coverage type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimArgumentCoverage = typeof ClaimArgumentCoverage.Type;
/**
 * Positive lexical-head witness from an actual singleton or existing source proof.
 *
 * **Example** (Check an untrusted claim operator head witness value)
 *
 * ```ts
 * import { ClaimOperatorHeadWitness } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimOperatorHeadWitness)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimOperatorHeadWitness = LiteralKit(["singleton", "finite-pp", "scalar", "reduced"])
  .toTaggedUnion("kind")({
    singleton: { token: ClaimSourceProofRef },
    "finite-pp": { token: ClaimSourceProofRef, proof: PosInt },
    scalar: { token: ClaimSourceProofRef, proof: PosInt },
    reduced: { token: ClaimSourceProofRef, proof: PosInt },
  })
  .pipe(
    $I.annoteSchema("ClaimOperatorHeadWitness", {
      description:
        "A uniquely licensed lexical head; primitive source proof ordinals are checked against their exact operator/token fields.",
    })
  );
/**
 * Operator head witness type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimOperatorHeadWitness = typeof ClaimOperatorHeadWitness.Type;
/**
 * Complete existing dependency-citation proof bound to its original qualification.
 *
 * **Example** (Check an untrusted claim citation witness value)
 *
 * ```ts
 * import { ClaimCitationWitness } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimCitationWitness)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimCitationWitness extends S.Opaque<ClaimCitationWitness, { readonly brand: unique symbol }>()(
  S.Struct({ claim: PatentClaim, keyword: ClaimSourceProofRef, tokens: S.Array(ClaimSourceProofRef) }).pipe(
    $I.annoteSchema("ClaimCitationWitness", {
      description:
        "Exact unquoted complete citation/introducer raw-token membership and the original qualified reference set; never a containment-only metadata assertion.",
    })
  )
) {}
/**
 * Ranked finite source proofs, constructed before public projection.
 * @category models
 * @since 0.0.0
 */
/**
 * Authoritative qualified source extents, derived directly from the original claim rather than proof records.
 *
 * **Example** (Check an untrusted claim original qualified scopes value)
 *
 * ```ts
 * import { ClaimOriginalQualifiedScopes } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimOriginalQualifiedScopes)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimOriginalQualifiedScopes extends S.Opaque<
  ClaimOriginalQualifiedScopes,
  { readonly brand: unique symbol }
>()(
  S.Struct({ preamble: TextAnchor, transition: TextAnchor, body: TextAnchor }).pipe(
    $I.annoteSchema("ClaimOriginalQualifiedScopes", {
      description: "Source characters retain their UTF-16 units; these data scopes are not proof-reference targets.",
    })
  )
) {}
/**
 * Head0 consumes only earlier raw/position facts; no equal-rank terminal join exists.
 *
 * **Example** (Check an untrusted claim head terminal evidence value)
 *
 * ```ts
 * import { ClaimHeadTerminalEvidence } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimHeadTerminalEvidence)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimHeadTerminalEvidence = LiteralKit(["lexical-terminal", "intrinsic-noun-terminal"])
  .toTaggedUnion("kind")({
    "lexical-terminal": {},
    "intrinsic-noun-terminal": {
      intrinsicNoun: ClaimSourceProofRef,
      rawAuxiliary: ClaimSourceProofRef,
      nonfiniteModifiers: S.NonEmptyArray(ClaimSourceProofRef),
      orderedModifiers: S.Array(ClaimSourceProofRef),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimHeadTerminalEvidence", {
      description:
        "The common head.terminal remains authoritative; every additional actual ref is enumerated and strictly lower than head0.",
    })
  );
/**
 * Terminal evidence type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimHeadTerminalEvidence = typeof ClaimHeadTerminalEvidence.Type;
/**
 * Finite typed source certificates with explicit ranked references.
 *
 * **Example** (Check an untrusted claim finite source proof value)
 *
 * ```ts
 * import { ClaimFiniteSourceProof } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimFiniteSourceProof)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimFiniteSourceProof = LiteralKit([
  "token",
  "scope",
  "intrinsic-noun",
  "boundary",
  "citation-boundary",
  "verbal-boundary",
  "opening",
  "closure",
  "head",
  "operator",
  "ordered-arguments",
  "description",
  "selection",
  "opaque-core",
  "attachment",
])
  .toTaggedUnion("kind")({
    token: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-3),
      tokenOrdinal: OriginalLexicalTokenOrdinal,
      token: ClaimLexicalToken,
    },
    "intrinsic-noun": {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-3),
      source: ClaimLexicalSourceIdentity,
      originalTokenDataOrdinal: OriginalLexicalTokenOrdinal,
      anchor: TextAnchor,
      rawForm: S.NonEmptyString,
      baseNoun: S.tag(true),
      oov: S.tag(false),
    },
    scope: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-3),
      role: S.Literals(["preamble", "transition", "body"]),
      extent: TextAnchor,
    },
    boundary: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-2),
      mode: ClaimHeadBoundary,
      token: ClaimSourceProofRef,
      scope: ClaimSourceProofRef,
      successor: S.OptionFromNullOr(ClaimSourceProofRef),
    },
    "citation-boundary": {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-2),
      scope: ClaimSourceProofRef,
      token: ClaimSourceProofRef,
      extent: TextAnchor,
      witness: ClaimCitationWitness,
    },
    "verbal-boundary": {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-2),
      mode: S.Literals(["auxiliary-complement", "infinitive-complement", "infinitive-introducer"]),
      token: ClaimSourceProofRef,
      governor: ClaimSourceProofRef,
      scope: ClaimSourceProofRef,
    },
    opening: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-1),
      mode: ClaimHeadOpening,
      coreStart: S.Int,
      scope: ClaimSourceProofRef,
      evidence: S.Array(ClaimSourceProofRef),
    },
    closure: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(-1),
      coreEnd: S.Int,
      scope: ClaimSourceProofRef,
      boundary: S.OptionFromNullOr(ClaimSourceProofRef),
      gap: S.OptionFromNullOr(TextAnchor),
    },
    head: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(0),
      core: TextAnchor,
      head: TextAnchor,
      terminal: ClaimSourceProofRef,
      opening: ClaimSourceProofRef,
      closure: ClaimSourceProofRef,
      tokens: S.Array(ClaimSourceProofRef),
      terminalEvidence: ClaimHeadTerminalEvidence.pipe(
        S.withConstructorDefault(Effect.succeed(ClaimHeadTerminalEvidence.cases["lexical-terminal"].make({})))
      ),
    },
    operator: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(1),
      mode: ClaimOperatorLicense,
      extent: TextAnchor,
      head: ClaimOperatorHeadWitness,
      headRole: S.Literals(["auxiliary", "predicate"]),
      lexical: S.Array(ClaimSourceProofRef),
      subject: S.OptionFromNullOr(ClaimSourceProofRef),
      position: S.OptionFromNullOr(ClaimSourceProofRef),
    },
    "ordered-arguments": {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(2),
      extent: TextAnchor,
      operator: ClaimSourceProofRef,
      adposition: ClaimSourceProofRef,
      pp: ClaimSourceProofRef,
      ppEnd: ClaimSourceProofRef,
      renewal: ClaimSourceProofRef,
      direct: ClaimSourceProofRef,
      directEnd: ClaimSourceProofRef,
      coverage: S.Array(ClaimArgumentCoverage),
    },
    description: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(2),
      extent: TextAnchor,
      operator: ClaimSourceProofRef,
      introducer: ClaimSourceProofRef,
      candidate: ClaimSourceProofRef,
    },
    selection: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(2),
      content: TextAnchor,
      operator: ClaimSourceProofRef,
      linkage: ClaimSourceProofRef,
      selector: S.Array(ClaimSourceProofRef),
      mode: S.Literals(["nominal-complement", "direct-argument"]),
      owner: S.OptionFromNullOr(ClaimSourceProofRef),
      branches: S.Array(ClaimSourceProofRef),
    },
    "opaque-core": {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(3),
      core: TextAnchor,
      head: TextAnchor,
      selection: ClaimSourceProofRef,
    },
    attachment: {
      ordinal: ClaimSourceProofOrdinal,
      rank: S.tag(3),
      extent: TextAnchor,
      mode: S.Literals(["relative", "complement", "coordinate", "declaration"]),
      operator: ClaimSourceProofRef,
      arguments: S.Array(ClaimSourceProofRef),
      inherited: S.OptionFromNullOr(ClaimSourceProofRef),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimFiniteSourceProof", {
      description:
        "Every actual typed edge is checked for source membership, target slot, strictly earlier rank and acyclicity; raw scopes match qualified input exactly.",
    })
  );
/**
 * Ranked source proof type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimFiniteSourceProof = typeof ClaimFiniteSourceProof.Type;
/**
 * Internal uncertain candidate; never a public term or introduction.
 *
 * **Example** (Check an untrusted claim private basis candidate value)
 *
 * ```ts
 * import { ClaimPrivateBasisCandidate } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimPrivateBasisCandidate)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimPrivateBasisCandidate extends S.Opaque<
  ClaimPrivateBasisCandidate,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    core: TextAnchor,
    head: TextAnchor,
    outer: TextAnchor,
    origin: S.Literals(["description", "opaque-branch"]),
    seed: ClaimSourceProofRef,
    certificate: ClaimSourceProofRef,
  }).pipe(
    $I.annoteSchema("ClaimPrivateBasisCandidate", {
      description:
        "A complete source-owned possible basis whose unknown identity remains adverse on compatible actual later routes.",
    })
  )
) {}
/**
 * One opaque public group with ordered private analyses and no alias donors.
 *
 * **Example** (Check an untrusted claim opaque selection value)
 *
 * ```ts
 * import { ClaimOpaqueSelection } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimOpaqueSelection)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimOpaqueSelection extends S.Opaque<ClaimOpaqueSelection, { readonly brand: unique symbol }>()(
  S.Struct({
    operator: TextAnchor,
    core: TextAnchor,
    head: TextAnchor,
    proof: ClaimSourceProofRef,
    group: ClaimSourceProofRef,
    branches: S.Array(ClaimPrivateBasisCandidate),
  }).pipe(
    $I.annoteSchema("ClaimOpaqueSelection", {
      description:
        "Only an exact unmodified one-of construction; branch identity, number, suffix and abbreviation never introduce or alias the whole group.",
    })
  )
) {}

/**
 * One-way source candidate lifecycle; an unproved candidate cannot donate roles.
 *
 * **Example** (Check an untrusted claim nominal candidate state value)
 *
 * ```ts
 * import { ClaimNominalCandidateState } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimNominalCandidateState)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimNominalCandidateState = LiteralKit(["unproved", "proved"])
  .toTaggedUnion("kind")({
    unproved: { nominal: ClaimNominalSpan },
    proved: {
      nominal: ClaimNominalSpan,
      proof: ClaimSourceProofRef,
      use: S.Literals(["public", "description", "branch", "opaque"]),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimNominalCandidateState", {
      description:
        "Only an independent head or opaque construction licenses a core; unproved metadata requires a positive existing exclusion before complete source commitment.",
    })
  );
/**
 * Source candidate lifecycle type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimNominalCandidateState = typeof ClaimNominalCandidateState.Type;
/**
 * Atomic plan, accepted only after source/work/coherence validation.
 *
 * **Example** (Check an untrusted claim clause role plan value)
 *
 * ```ts
 * import { ClaimClauseRolePlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimClauseRolePlan)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimClauseRolePlan extends S.Opaque<ClaimClauseRolePlan, { readonly brand: unique symbol }>()(
  S.Struct({
    qualifiedText: S.NonEmptyString,
    qualifiedClaim: S.OptionFromNullOr(PatentClaim).pipe(S.withConstructorDefault(Effect.succeedNone)),
    originalLexicalInput: S.OptionFromNullOr(ClaimLexicalEvidence).pipe(S.withConstructorDefault(Effect.succeedNone)),
    stage: S.Literals(["candidates", "committed"]).pipe(S.withConstructorDefault(Effect.succeed("candidates"))),
    remainingWork: S.Int,
    nominals: S.Array(ClaimNominalSpan),
    predicates: S.Array(ClaimPredicateSpan),
    clauses: S.Array(ClaimClauseSpan),
    proofs: S.Array(ClaimSourceProof),
    certificates: S.Array(ClaimFiniteSourceProof).pipe(S.withConstructorDefault(Effect.succeed([]))),
    candidateStates: S.Array(ClaimNominalCandidateState).pipe(S.withConstructorDefault(Effect.succeed([]))),
    privateCandidates: S.Array(ClaimPrivateBasisCandidate).pipe(S.withConstructorDefault(Effect.succeed([]))),
    opaqueSelections: S.Array(ClaimOpaqueSelection).pipe(S.withConstructorDefault(Effect.succeed([]))),
  }).pipe(
    $I.annoteSchema("ClaimClauseRolePlan", {
      description: "One deterministic qualified-source plan shared by current and ancestor extraction.",
    })
  )
) {}

/**
 * Source attachment proof, independent of structural or physical ownership.
 *
 * **Example** (Check an untrusted claim frame attachment value)
 *
 * ```ts
 * import { ClaimFrameAttachment } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimFrameAttachment)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimFrameAttachment = LiteralKit([
  "main",
  "relative",
  "event-complement",
  "complement",
  "condition",
  "adjunct",
  "coordinate",
  "composition-child",
]).pipe(
  $I.annoteSchema("ClaimFrameAttachment", {
    description: "An admitted grammatical attachment; ambiguity declines the complete source plan.",
  })
);
/**
 * Grammatical attachment type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimFrameAttachment = typeof ClaimFrameAttachment.Type;
/**
 * Anchored grammatical argument, separate from physical or antecedent ownership.
 *
 * **Example** (Check an untrusted claim frame argument value)
 *
 * ```ts
 * import { ClaimFrameArgument } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimFrameArgument)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFrameArgument extends S.Opaque<ClaimFrameArgument, { readonly brand: unique symbol }>()(
  S.Struct({
    role: S.Literals([
      "subject",
      "object",
      "prepositional-complement",
      "nominal-modifier",
      "selection-value",
      "unknown",
    ]),
    nominal: TextAnchor,
    predicate: S.OptionFromNullOr(TextAnchor),
    ownerNominal: S.OptionFromNullOr(TextAnchor),
  }).pipe(
    $I.annoteSchema("ClaimFrameArgument", {
      description:
        "Only source-attached syntactic argument proof; unknown does not supply identity or an introduction.",
    })
  )
) {}
/**
 * Nonowning complete private argument of an existing proved grammatical frame.
 *
 * **Example** (Check an untrusted claim private frame argument value)
 *
 * ```ts
 * import { ClaimPrivateFrameArgument } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimPrivateFrameArgument)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimPrivateFrameArgument = LiteralKit(["predicate", "selection"])
  .toTaggedUnion("kind")({
    predicate: {
      candidate: ClaimSourceProofRef,
      certificate: ClaimSourceProofRef,
      core: TextAnchor,
      predicate: TextAnchor,
      origin: S.tag("description"),
    },
    selection: {
      candidate: ClaimSourceProofRef,
      certificate: ClaimSourceProofRef,
      core: TextAnchor,
      marker: TextAnchor,
      group: ClaimSourceProofRef,
      owner: S.OptionFromNullOr(ClaimSourceProofRef),
      origin: S.tag("opaque-branch"),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimPrivateFrameArgument", {
      description:
        "Predicate-owned descriptive values and nominal-selection-owned branches are distinct; neither creates a public core, introduction, functional predicate or alias.",
    })
  );
/**
 * Private argument governor type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimPrivateFrameArgument = typeof ClaimPrivateFrameArgument.Type;
/**
 * Actual complete lexical slot of a committed operator span.
 *
 * **Example** (Check an untrusted claim operator lexical slot value)
 *
 * ```ts
 * import { ClaimOperatorLexicalSlot } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimOperatorLexicalSlot)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimOperatorLexicalSlot = LiteralKit(["lexical", "adjunct", "gap"])
  .toTaggedUnion("kind")({
    lexical: { token: ClaimSourceProofRef, certificate: ClaimSourceProofRef, extent: TextAnchor },
    adjunct: { token: ClaimSourceProofRef, certificate: ClaimSourceProofRef, extent: TextAnchor },
    gap: { extent: TextAnchor },
  })
  .pipe(
    $I.annoteSchema("ClaimOperatorLexicalSlot", {
      description:
        "Ordered actual source/grammar membership reconstructs the whole committed operator, including licensed adjuncts and gaps.",
    })
  );
/**
 * Committed lexical slot type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimOperatorLexicalSlot = typeof ClaimOperatorLexicalSlot.Type;
/**
 * Lossless same-frame operator binding with a uniquely proved argument head.
 *
 * **Example** (Check an untrusted claim source operator binding value)
 *
 * ```ts
 * import { ClaimSourceOperatorBinding } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceOperatorBinding)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSourceOperatorBinding extends S.Opaque<
  ClaimSourceOperatorBinding,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    frame: PosInt,
    operator: TextAnchor,
    slots: S.Array(ClaimOperatorLexicalSlot),
    head: S.OptionFromNullOr(
      S.Struct({
        token: ClaimSourceProofRef,
        certificate: ClaimSourceProofRef,
        rule: S.Literals(["single-operator", "auxiliary-complement", "scalar-participle", "reduced-modifier"]),
      })
    ),
  }).pipe(
    $I.annoteSchema("ClaimSourceOperatorBinding", {
      description:
        "Preserves committed operator spans and derives lexical views by actual proof joins; no last-token or containment-only head inference.",
    })
  )
) {}
/**
 * Positive same-source parent-frame subject use; never a new public core donor.
 *
 * **Example** (Check an untrusted claim frame subject inheritance value)
 *
 * ```ts
 * import { ClaimFrameSubjectInheritance } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimFrameSubjectInheritance)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFrameSubjectInheritance extends S.Opaque<
  ClaimFrameSubjectInheritance,
  { readonly brand: unique symbol }
>()(
  S.Struct({ fromFrame: PosInt, nominal: TextAnchor }).pipe(
    $I.annoteSchema("ClaimFrameSubjectInheritance", {
      description:
        "An already proved attached relative or controlled complement uses the exact actual parent's nominal; public ownership is unchanged.",
    })
  )
) {}
/**
 * One enclosing frame with explicit attached-parent and argument provenance.
 *
 * **Example** (Check an untrusted claim source frame value)
 *
 * ```ts
 * import { ClaimSourceFrame } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceFrame)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSourceFrame extends S.Opaque<ClaimSourceFrame, { readonly brand: unique symbol }>()(
  S.Struct({
    ordinal: PosInt,
    publicOwner: PosInt,
    extent: TextAnchor,
    lexicalHeader: TextAnchor,
    parent: S.OptionFromNullOr(PosInt),
    attachment: ClaimFrameAttachment,
    introducer: S.OptionFromNullOr(TextAnchor),
    predicates: S.Array(TextAnchor),
    nominals: S.Array(TextAnchor),
    coordination: S.OptionFromNullOr(PosInt),
    sharedSubject: S.OptionFromNullOr(TextAnchor),
    inheritedSubject: S.OptionFromNullOr(ClaimFrameSubjectInheritance).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    subject: S.OptionFromNullOr(TextAnchor),
    arguments: S.Array(ClaimFrameArgument),
    privateArguments: S.Array(ClaimPrivateFrameArgument).pipe(S.withConstructorDefault(Effect.succeed([]))),
  }).pipe(
    $I.annoteSchema("ClaimSourceFrame", {
      description: "Enclosing source frame retained around subordinate frames; never a physical ownership assertion.",
    })
  )
) {}
/**
 * Separate nominal core, lexical head and attached outer extent.
 *
 * **Example** (Check an untrusted claim attached nominal value)
 *
 * ```ts
 * import { ClaimAttachedNominal } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimAttachedNominal)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimAttachedNominal extends S.Opaque<ClaimAttachedNominal, { readonly brand: unique symbol }>()(
  S.Struct({ core: TextAnchor, head: TextAnchor, outer: TextAnchor, nominal: ClaimNominalSpan }).pipe(
    $I.annoteSchema("ClaimAttachedNominal", {
      description: "Public term projects the validated core; attached outer arguments never overlap its lexical head.",
    })
  )
) {}
/**
 * Source-backed element grouping production.
 *
 * **Example** (Check an untrusted claim element grouping value)
 *
 * ```ts
 * import { ClaimElementGrouping } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimElementGrouping)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimElementGrouping = LiteralKit([
  "preamble",
  "explicit-list-header",
  "enumeration-child",
  "composition-header",
  "composition-child",
  "independent-coordinate",
  "introduced-restriction",
  "shared-subject-continuation",
  "single-restriction",
  "nominal-leaf",
  "adjectival-property",
]).pipe(
  $I.annoteSchema("ClaimElementGrouping", {
    description: "Admitted structural production; no source IDs or expected counts participate.",
  })
);
/**
 * Structural grouping type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimElementGrouping = typeof ClaimElementGrouping.Type;
/**
 * Existing positive source membership licensing one public nominal owner.
 *
 * **Example** (Check an untrusted claim term owner certificate value)
 *
 * ```ts
 * import { ClaimTermOwnerCertificate } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimTermOwnerCertificate)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimTermOwnerCertificate = LiteralKit(["existing-element-nominal", "preamble-clause-nominal"])
  .toTaggedUnion("kind")({
    "existing-element-nominal": {
      element: PosInt,
      production: ClaimElementGrouping,
      lexicalRegion: TextAnchor,
      roleNominal: PosInt,
    },
    "preamble-clause-nominal": {
      element: PosInt,
      roleNominal: PosInt,
      sourceClause: PosInt,
      clauseNominal: TextAnchor,
      preamble: TextAnchor,
    },
  })
  .pipe(
    $I.annoteSchema("ClaimTermOwnerCertificate", {
      description:
        "Exact existing production or accepted preamble clause membership; containment alone is no ownership proof.",
    })
  );
/**
 * Source membership certificate type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimTermOwnerCertificate = typeof ClaimTermOwnerCertificate.Type;
/**
 * Exact construction-origin qualified header membership, preserving the raw record.
 *
 * **Example** (Check an untrusted claim qualified header membership value)
 *
 * ```ts
 * import { ClaimQualifiedHeaderMembership } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimQualifiedHeaderMembership)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimQualifiedHeaderMembership extends S.Opaque<
  ClaimQualifiedHeaderMembership,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    qualifiedText: S.NonEmptyString,
    frame: PosInt,
    owner: PosInt,
    scope: ClaimSourceProofRef,
    proof: ClaimSourceProofRef,
    core: TextAnchor,
    head: TextAnchor,
    header: TextAnchor,
    region: PosInt,
    construction: ClaimTermOwnerCertificate,
    rawOrdinal: PosInt,
    argument: ClaimFrameArgument,
  }).pipe(
    $I.annoteSchema("ClaimQualifiedHeaderMembership", {
      description:
        "Only a unique unknown/no-predicate/no-owner self entry joined to the actual qualified-root construction; its uncertainty and ordinal survive demultiplexing.",
    })
  )
) {}
/**
 * Generic lossless lexical view of one committed grammatical frame.
 *
 * **Example** (Check an untrusted claim frame lexical view value)
 *
 * ```ts
 * import { ClaimFrameLexicalView } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimFrameLexicalView)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimFrameLexicalView extends S.Opaque<ClaimFrameLexicalView, { readonly brand: unique symbol }>()(
  S.Struct({
    frame: PosInt,
    predicates: S.Array(TextAnchor),
    arguments: S.Array(ClaimFrameArgument),
    privateArguments: S.Array(ClaimPrivateFrameArgument),
    sourceArgumentOrdinals: S.Array(PosInt),
    headerMembership: S.OptionFromNullOr(ClaimQualifiedHeaderMembership),
  }).pipe(
    $I.annoteSchema("ClaimFrameLexicalView", {
      description:
        "Exact actual operator-slot expansion and uniquely proved head joins; all other frame fields retain their committed identities.",
    })
  )
) {}
/**
 * Exclusive complete core region, independently bounded from the grammatical header.
 *
 * **Example** (Check an untrusted claim owned term region value)
 *
 * ```ts
 * import { ClaimOwnedTermRegion } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimOwnedTermRegion)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimOwnedTermRegion extends S.Opaque<ClaimOwnedTermRegion, { readonly brand: unique symbol }>()(
  S.Struct({
    ordinal: PosInt,
    ownerElement: PosInt,
    core: PosInt,
    extent: TextAnchor,
    certificate: ClaimTermOwnerCertificate,
  }).pipe(
    $I.annoteSchema("ClaimOwnedTermRegion", {
      description: "One source-local attached nominal index and its exact positively certified public owner region.",
    })
  )
) {}
/**
 * Finite source barriers; a protected quote may still be contained by a complete named core.
 *
 * **Example** (Check an untrusted claim source exclusion value)
 *
 * ```ts
 * import { ClaimSourceExclusion } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceExclusion)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceExclusion = LiteralKit([
  "qualified-transition",
  "declaration-metadata",
  "dependency-citation",
  "quoted-protection",
])
  .toTaggedUnion("kind")({
    "qualified-transition": { extent: TextAnchor, preamble: TextAnchor, body: TextAnchor },
    "declaration-metadata": { extent: TextAnchor, owner: PosInt },
    "dependency-citation": {
      extent: TextAnchor,
      claimReferences: S.Array(PosInt),
      witness: S.OptionFromNullOr(ClaimCitationWitness).pipe(S.withConstructorDefault(Effect.succeedNone)),
    },
    "quoted-protection": { extent: TextAnchor },
  })
  .pipe(
    $I.annoteSchema("ClaimSourceExclusion", {
      description:
        "Typed qualified syntax, declaration labels, exact dependency citations and balanced quote barriers; never lexical exception lists.",
    })
  );
/**
 * Source exclusion type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceExclusion = typeof ClaimSourceExclusion.Type;
/**
 * Canonical source declaration; unlabelled items never fabricate label anchors.
 *
 * **Example** (Check an untrusted claim source declaration value)
 *
 * ```ts
 * import { ClaimSourceDeclaration } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceDeclaration)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceDeclaration = LiteralKit(["labelled", "composition", "action"])
  .toTaggedUnion("kind")({
    labelled: {
      owner: PosInt,
      frame: PosInt,
      anchor: TextAnchor,
      items: S.Array(S.Struct({ child: PosInt, extent: TextAnchor, label: TextAnchor })),
    },
    composition: {
      owner: PosInt,
      frame: PosInt,
      anchor: TextAnchor,
      items: S.Array(S.Struct({ child: PosInt, extent: TextAnchor })),
    },
    action: {
      owner: PosInt,
      frame: PosInt,
      anchor: TextAnchor,
      items: S.Array(S.Struct({ child: PosInt, extent: TextAnchor })),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimSourceDeclaration", {
      description:
        "An explicit qualified/header declaration binds real item extents to their structural and grammatical owners.",
    })
  );
/**
 * Source declaration type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceDeclaration = typeof ClaimSourceDeclaration.Type;

/**
 * Complete local element identity before source-ordered path assignment.
 *
 * **Example** (Check an untrusted claim planned element value)
 *
 * ```ts
 * import { ClaimPlannedElement } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimPlannedElement)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimPlannedElement extends S.Opaque<ClaimPlannedElement, { readonly brand: unique symbol }>()(
  S.Struct({
    ordinal: PosInt,
    parent: S.OptionFromNullOr(PosInt),
    extent: TextAnchor,
    lexicalHeader: TextAnchor,
    kind: S.Literals(["preamble-subject", "limitation", "sub-limitation", "functional-relation"]),
    grouping: ClaimElementGrouping,
    nominals: S.Array(ClaimNominalSpan),
    ownedTermRegions: S.Array(ClaimOwnedTermRegion),
  }).pipe(
    $I.annoteSchema("ClaimPlannedElement", {
      description:
        "Atomic enhanced element extent, parent and exclusive nominal ownership before public path projection.",
    })
  )
) {}
/**
 * Accepted complete structural plan; failed candidates donate no source facts.
 *
 * **Example** (Check an untrusted claim list declaration value)
 *
 * ```ts
 * import { ClaimListDeclaration } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimListDeclaration)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimListDeclaration extends S.Opaque<ClaimListDeclaration, { readonly brand: unique symbol }>()(
  S.Struct({ owner: PosInt, anchor: TextAnchor, items: S.Array(S.Struct({ label: TextAnchor, child: PosInt })) }).pipe(
    $I.annoteSchema("ClaimListDeclaration", {
      description:
        "Exact declaration and excluded source labels bound to their admitted structural owner and child ordinals.",
    })
  )
) {}
/**
 * Finite existing-source evidence for a structural token disposition.
 *
 * **Example** (Check an untrusted claim source control evidence value)
 *
 * ```ts
 * import { ClaimSourceControlEvidence } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceControlEvidence)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceControlEvidence = LiteralKit([
  "scope",
  "argument-link",
  "opening",
  "boundary",
  "operator-position",
  "operator-adjunct",
  "argument-introducer",
  "argument-coordinate",
  "operator-coordinate",
  "frame-coordinate",
  "element-coordinate",
  "role-adjunct",
  "frame-introducer",
  "exclusion",
  "declaration-gap",
  "punctuation",
])
  .toTaggedUnion("kind")({
    scope: { proof: ClaimSourceProofRef },
    "argument-link": { proof: ClaimSourceProofRef },
    opening: { proof: ClaimSourceProofRef },
    boundary: { proof: ClaimSourceProofRef },
    "operator-position": { proof: ClaimSourceProofRef },
    "operator-adjunct": { binding: PosInt, certificate: ClaimSourceProofRef },
    "argument-introducer": { frame: PosInt, argument: PosInt },
    "argument-coordinate": { frame: PosInt, left: PosInt, right: PosInt },
    "operator-coordinate": { left: PosInt, right: PosInt },
    "frame-coordinate": { left: PosInt, right: PosInt },
    "element-coordinate": { left: PosInt, right: PosInt },
    "role-adjunct": { predicate: PosInt, token: ClaimSourceProofRef },
    "frame-introducer": { frame: PosInt },
    exclusion: { exclusion: PosInt },
    "declaration-gap": { declaration: PosInt, left: PosInt, right: PosInt },
    punctuation: {},
  })
  .pipe(
    $I.annoteSchema("ClaimSourceControlEvidence", {
      description:
        "Every control consumes an actual qualified scope, independently proved link/boundary, attached introducer or complete declaration/exclusion; there is no free-form certificate or word whitelist.",
    })
  );
/**
 * Structural-token evidence type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceControlEvidence = typeof ClaimSourceControlEvidence.Type;
/**
 * Exclusive whole-source token disposition, retaining private descriptive values.
 *
 * **Example** (Check an untrusted claim source token ownership value)
 *
 * ```ts
 * import { ClaimSourceTokenOwnership } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceTokenOwnership)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimSourceTokenOwnership = LiteralKit(["public-core", "private-value", "predicate", "control"])
  .toTaggedUnion("kind")({
    "public-core": { token: ClaimSourceProofRef, extent: TextAnchor, core: PosInt, owner: PosInt },
    "private-value": {
      token: ClaimSourceProofRef,
      extent: TextAnchor,
      candidate: ClaimSourceProofRef,
      certificate: ClaimSourceProofRef,
    },
    predicate: {
      token: ClaimSourceProofRef,
      extent: TextAnchor,
      binding: PosInt,
      frame: PosInt,
      certificate: ClaimSourceProofRef,
    },
    control: { token: ClaimSourceProofRef, extent: TextAnchor, evidence: ClaimSourceControlEvidence },
  })
  .pipe(
    $I.annoteSchema("ClaimSourceTokenOwnership", {
      description:
        "Every raw source token occurs exactly once. Public cores retain unique public owners; private values and opaque branch analyses cannot disappear or donate public introductions.",
    })
  );
/**
 * Whole-source token ownership type.
 * @category type-level
 * @since 0.0.0
 */
export type ClaimSourceTokenOwnership = typeof ClaimSourceTokenOwnership.Type;
/**
 * Accepted complete structural plan with source declarations and role proofs.
 *
 * **Example** (Check an untrusted claim source element plan value)
 *
 * ```ts
 * import { ClaimSourceElementPlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimSourceElementPlan)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimSourceElementPlan extends S.Opaque<ClaimSourceElementPlan, { readonly brand: unique symbol }>()(
  S.Struct({
    qualifiedText: S.NonEmptyString,
    tokenOwnership: S.Array(ClaimSourceTokenOwnership).pipe(S.withConstructorDefault(Effect.succeed([]))),
    remainingWork: S.Int,
    frames: S.Array(ClaimSourceFrame),
    nominals: S.Array(ClaimAttachedNominal),
    sourceExclusions: S.Array(ClaimSourceExclusion),
    elements: S.Array(ClaimPlannedElement),
    declarations: S.Array(ClaimListDeclaration),
    declarationPlans: S.Array(ClaimSourceDeclaration),
    operatorBindings: S.Array(ClaimSourceOperatorBinding).pipe(S.withConstructorDefault(Effect.succeed([]))),
    headerMemberships: S.Array(ClaimQualifiedHeaderMembership).pipe(S.withConstructorDefault(Effect.succeed([]))),
    proofs: S.Array(ClaimSourceProof),
    roles: ClaimClauseRolePlan,
  }).pipe(
    $I.annoteSchema("ClaimSourceElementPlan", {
      description:
        "One immutable source plan shared by every current and ancestor appearance; route resolution cannot mutate it.",
    })
  )
) {}

/**
 * Accepted whole-source plan keyed by its prepared claim identity.
 *
 * **Example** (Check an untrusted claim bound role plan value)
 *
 * ```ts
 * import { ClaimBoundRolePlan } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimBoundRolePlan)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimBoundRolePlan extends S.Opaque<ClaimBoundRolePlan, { readonly brand: unique symbol }>()(
  S.Struct({ claimNumber: PosInt, plan: ClaimClauseRolePlan, sourcePlan: ClaimSourceElementPlan }).pipe(
    $I.annoteSchema("ClaimBoundRolePlan", { description: "Accepted atomic source plan for a qualified unique claim." })
  )
) {}
/**
 * Decompositions with only successfully projected atomic plans.
 *
 * **Example** (Check an untrusted claim role decomposition value)
 *
 * ```ts
 * import { ClaimRoleDecomposition } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ClaimRoleDecomposition)({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ClaimRoleDecomposition extends S.Opaque<ClaimRoleDecomposition, { readonly brand: unique symbol }>()(
  S.Struct({ decompositions: S.Array(ClaimInputDecomposition), plans: S.Array(ClaimBoundRolePlan) }).pipe(
    $I.annoteSchema("ClaimRoleDecomposition", {
      description: "No failed source plan can donate partial lexical or policy roles.",
    })
  )
) {}
