# Codex adversarial review — prior-synthesis snippet & claim audit

- **Date:** 2026-07-25  **Reviewer:** codex gpt-5.6-sol (xhigh)
- **Target:** research/prior-synthesis-legal-ontologies.md (adopted June-29 synthesis)
- **Scope:** code snippets, Effect v4 API fidelity, @beep/* API references, load-bearing repo claims

## Verdict summary

The synthesis is valuable historical prior art, but it is unsafe as a copy-paste engineering guide without a line-addressed erratum. All **56 TypeScript fences** were reviewed against vendored Effect **4.0.0-beta.101** and the current package sources. **20 snippets are clean on the scoped Effect/@beep surface; 36 contain at least one verified defect.** There are **13 distinct findings: 7 foundational, 5 significant, and 1 cosmetic.** The main failures are removed Schema APIs, incomplete runtime-validated metadata, invented identity symbols, nonexistent RDF exports, a falsely claimed publication gate, and a superseded ontology authoring roadmap.

## Findings

| # | doc location (§/line) | severity foundational\|significant\|cosmetic | issue | proof (file:line) |
|---:|---|---|---|---|
| 1 | §§1,3,5,6,8,9; App. A / 56, 232, 487, 563, 675, 946, 1008, 1291, 1413 | foundational | Nine snippets use removed `S.filter`; their `message` callbacks also violate the v4 annotation type. | `node_modules/effect/dist/Schema.d.ts:3990`, `:5066`, `:9792`; `packages/ontology/server/src/aggregates/Session/Session.file-store.ts:38-60` |
| 2 | §§3–6; App. A / 150, 397-402, 426, 609, 1480 | foundational | Five snippets use removed `S.pattern`. | `node_modules/effect/dist/Schema.d.ts:5157`; `packages/law-practice/domain/src/values/PatentNumber/PatentNumber.model.ts:35-40` |
| 3 | §§3–6,9; App. A / 198, 370, 540, 632, 650, 678, 768, 1010, 1302, 1497, 1509 | foundational | All eleven `makeSemanticSchemaMetadata` calls omit required fields and therefore fail statically or at validation. | `packages/foundation/modeling/rdf/src/SemanticSchemaMetadata.ts:272-290`, `:332-351` |
| 4 | §5 / 417-426 | foundational | `EntityId` is imported from the wrong package and the factory result is mistaken for an entity-id schema. | `packages/foundation/modeling/identity/src/index.ts:30-90`; `packages/shared/domain/src/entity/EntityId.ts:379-398`, `:544-557`; `packages/shared/domain/src/identity/LawPractice.ts:8-12` |
| 5 | §§1,3–5,8; App. A / 53, 172, 226-229, 246, 323, 944-945, 1287-1290, 1314, 1368, 1411-1412, 1530 | foundational | Eleven snippets use nonexistent `LawPractice.PartyId`. | `packages/shared/domain/src/identity/LawPractice.ts:8-12`, `:27-29`, `:65-67`, `:179-181`, `:217-219` |
| 6 | §§4,7,9; App. A / 405, 823-855, 884, 1037, 1082, 1461-1470 | foundational | The document alternately claims that a verification publication gate already exists and says it must be added. Current production models have no such gate. | `packages/epistemic/domain/src/values/ClaimGate/ClaimGateResult.model.ts:90-94`, `:124-136`; `packages/epistemic/use-cases/src/ClaimProjection/ClaimProjection.ts:85-101`; `packages/epistemic/domain/src/values/EvidenceSpan/EvidenceSpan.model.ts:89-96` |
| 7 | §§1,5,8,9 / 72, 550, 892, 1041-1055 | foundational | The roadmap says `@beep/ontology` does not exist and demonstrates a deliberately retired `Ontology.create` API. | `packages/foundation/modeling/ontology/package.json:2`, `:35-39`; `packages/foundation/modeling/ontology/src/index.ts:11-39`; `explorations/identity-as-iri/assets/identity-iri-fibration-handoff.md:47-52`; `explorations/ATLAS.md:232-240` |
| 8 | §5 / 501-510 | significant | `S.TaggedError` does not exist in vendored v4; the current API is `TaggedErrorClass`. | `node_modules/effect/dist/Schema.d.ts:8929-8937`; `packages/epistemic/domain/src/values/ClaimLifecycle/ClaimLifecycle.errors.ts:7-10`, `:30-40`, `:55-56` |
| 9 | §§7–8 / 832, 959 | significant | The PROV snippet imports two nonexistent constants, while the SKOS snippet imports an existing constant from the wrong barrel. | `packages/foundation/modeling/rdf/src/Vocab/Prov.ts:25-105`; `packages/foundation/modeling/rdf/src/Vocab/Skos.ts:295`; `packages/foundation/modeling/rdf/src/index.ts:30-72`; `packages/foundation/modeling/rdf/package.json:36-40` |
| 10 | §5 / 456-472 | significant | The fold matches `normKind`, so adding a modality does not make it non-exhaustive as claimed. | `node_modules/effect/dist/Match.d.ts:768`, `:897-901`, `:1899`; target `:459-468` |
| 11 | §§7–9; App. A / 819, 912, 1021, 1452 | significant | The proposed `AlignmentStatus` redeclares and diverges from the canonical repository schema. | `packages/foundation/capability/langextract/src/Extraction/index.ts:120-133`; `packages/law-practice/use-cases/src/IrToLaw/IrToLaw.service.ts:20-22`, `:79-80` |
| 12 | §§1,6,9 / 74, 730-741, 1086 | significant | The proposed package placement conflicts with current architecture routing for legal product language. | `standards/ARCHITECTURE.md:47-55`, `:244-250`; `standards/architecture/02-shared-kernel.md:167-170` |
| 13 | §3 / 247 | cosmetic | The fallback recommends removed `S.optionalWith` even though the preceding v4 form is correct. | `node_modules/effect/dist/Schema.d.ts:6372-6380`; `packages/ontology/use-cases/src/tools/OntologyToolkit.ts:26-29` |

### 1. Removed `S.filter` API

Broken excerpt:

```ts
const LegalRelator = LegalRelatorBase.pipe(
  S.filter((r) => r.holder !== r.counterparty, {
    message: () => "holder and counterparty must differ",
  }),
)
```

Vendored v4 exports `check` and `makeFilter`, not `Schema.filter`. Its filter annotation declares `message?: string`, so the callback form is also wrong. Current repository code constructs filters with `S.makeFilter(...)` and attaches them through `.check(...)`.

Corrected Effect-v4 form:

```ts
const LegalRelator = LegalRelatorBase.check(
  S.makeFilter((r) => r.holder !== r.counterparty, {
    message: "holder and counterparty must differ",
  }),
)
```

This correction applies to all nine locations listed in the table.

### 2. Removed `S.pattern` API

Broken excerpt:

```ts
const ECLI = S.String.pipe(
  S.pattern(/^ECLI:[A-Z]{2}:.+/),
  S.brand("ECLI"),
)
```

Vendored v4 exposes `S.isPattern(...)` as a check. Live repository schemas use `S.String.check(S.isPattern(...))`.

Corrected Effect-v4 form:

```ts
const ECLI = S.String.check(
  S.isPattern(/^ECLI:[A-Z]{2}:.+/),
).pipe(S.brand("ECLI"))
```

This correction applies to all five `S.pattern` snippets.

### 3. Invalid `makeSemanticSchemaMetadata` payloads

Broken excerpt:

```ts
const meta = makeSemanticSchemaMetadata({
  kind: "ontologyConstruct",
  canonicalName: "PatentApplication",
  canonicalIri: "https://beep.dev/ip#PatentApplication",
  preferredPrefix: "ip",
})
```

`makeSemanticSchemaMetadata` accepts `SemanticSchemaMetadata.Encoded` and immediately decodes it. The schema requires `overview`, `status`, a non-empty `specifications` array, and `equivalenceBasis` in addition to `kind` and `canonicalName`. A comment saying required fields were “elided” does not make the literal type-correct or runtime-valid.

Corrected form:

```ts
const meta = makeSemanticSchemaMetadata({
  kind: "ontologyConstruct",
  canonicalName: "PatentApplication",
  overview: "Patent-application ontology construct.",
  status: "experimental",
  specifications: [
    { name: "Internal legal ontology profile", disposition: "informative" },
  ],
  equivalenceBasis: "Identity by canonical application IRI.",
  canonicalIri: "https://beep.dev/ip#PatentApplication",
  preferredPrefix: "ip",
})
```

All eleven calls need complete payloads specific to their constructs.

### 4. Incorrect `EntityId` import and factory use

Broken excerpt:

```ts
import { EntityId } from "@beep/identity"

export const NormId = EntityId.factory("legal_norm", $I)
```

`@beep/identity` exports identity composers and vocabulary helpers, not the entity-id factory. The factory is the namespace module `@beep/shared-domain/entity/EntityId`. Moreover, `factory(slice, composer)` returns a maker; a second call supplies the entity name.

Corrected form:

```ts
import * as EntityId from "@beep/shared-domain/entity/EntityId"

const makeLegalCoreId = EntityId.factory("legal_core", $I)
export const NormId = makeLegalCoreId("norm", {
  description: "Identifier for a legal norm.",
})
```

If the norm remains law-practice-owned, it should instead be added through that slice’s existing identity registry.

### 5. Nonexistent `LawPractice.PartyId`

Broken excerpt:

```ts
RightDuty: {
  holder: LawPractice.PartyId,
  counterparty: LawPractice.PartyId,
  object: ActionOrOmission,
}
```

The live `LawPractice` registry defines concrete IDs such as `LegalClientId`, `LegalContactId`, `OfficeActionId`, and `ClaimId`; it declares no `PartyId`. A repository-wide production-source search found no `PartyId` declaration.

There is no honest substitution that covers every party role. The missing concept must first be modeled and exported:

```ts
// In the owning identity registry:
export const LegalAgentId = make("legal_agent", {
  description: "Identifier for a legal position-bearing agent.",
})

// At call sites:
holder: LawPractice.LegalAgentId
counterparty: LawPractice.LegalAgentId
```

Using `LegalClientId` as a blanket replacement would incorrectly exclude examiners, attorneys, institutions, and counterparties.

### 6. Nonexistent “already implemented” verification gate

Broken excerpt:

```text
the VerificationStatus (`verified | plausible_unverified | flagged`)
gate already do[es this]
```

The document later says `AssertionProvenance` and its projector must be added. Current `ClaimGateResult` is only `admitted | rejected`; `projectClaims` selects admitted lifecycle records without inspecting verification provenance; `EvidenceSpan` contains only `TextAnchorFields` and `confidence`.

Corrected present-state wording:

> Desired invariant: after `AssertionProvenance` and a publishing projector are implemented, only records with status `verified` may publish. The current claim gate and projection do not enforce this invariant.

A valid proposed v4 predicate can be shown, but must remain explicitly prospective:

```ts
const VerificationStatus = LiteralKit([
  "verified",
  "plausible_unverified",
  "flagged",
])

const isPublishable = (
  status: typeof VerificationStatus.Type,
): boolean => status === VerificationStatus.Enum.verified
```

Integration with persisted provenance and every public projection remains unimplemented.

### 7. Stale `@beep/ontology` state and dead authoring API

Broken excerpt:

```ts
`@beep/ontology`, which does not exist yet.

const { Ont, $I } = Ontology.create({ ... })
const PatentApplication = Ont.class("PatentApplication", { ... })
const turtle = projectTurtle([PatentApplication, LegalRelator])
```

As of the review date, `@beep/ontology` exists and exports current FOLIO models, semantic-foundation models, seed, loader, and registry surfaces. It does not export `Ontology.create` or `projectTurtle`. More importantly, the superseding identity-as-IRI decision explicitly says that the old `Ontology.create` authoring API “is dead and stays dead.”

Corrected form:

```ts
import * as Ontology from "@beep/ontology"

// Use only the current exports declared by @beep/ontology/src/index.ts.
// There is no current Ontology.create/projectTurtle call-for-call replacement.
```

The proposed snippet should be labeled “superseded pseudocode,” not used as a roadmap.

### 8. Removed `S.TaggedError`

Broken excerpt:

```ts
export class IllegalProsecutionStep
  extends S.TaggedError<IllegalProsecutionStep>($I`IllegalProsecutionStep`)(
    "IllegalProsecutionStep",
    { from: ProsecutionStatus, to: ProsecutionStatus },
  ) {}
```

Vendored v4 exports `TaggedErrorClass`. The repository wraps that constructor through `@beep/schema` and uses `.make(...)` in factory methods.

Corrected Effect-v4 form:

```ts
import { TaggedErrorClass } from "@beep/schema"

export class IllegalProsecutionStep
  extends TaggedErrorClass<IllegalProsecutionStep>($I`IllegalProsecutionStep`)(
    "IllegalProsecutionStep",
    { from: ProsecutionStatus, to: ProsecutionStatus },
    $I.annote("IllegalProsecutionStep", {
      description: "An illegal prosecution lifecycle transition.",
    }),
  ) {
  static between(
    from: typeof ProsecutionStatus.Type,
    to: typeof ProsecutionStatus.Type,
  ): IllegalProsecutionStep {
    return IllegalProsecutionStep.make({ from, to })
  }
}
```

### 9. Invalid RDF vocabulary imports

Broken excerpts:

```ts
import {
  PROV_ENTITY,
  PROV_WAS_ATTRIBUTED_TO,
  PROV_WAS_DERIVED_FROM,
} from "@beep/rdf/Vocab/Prov"

import { SKOS_EXACT_MATCH } from "@beep/rdf"
```

The PROV vocabulary module currently exports `PROV_NAMESPACE`, entity/activity/agent, `wasGeneratedBy`, and `used`; the two requested predicates are absent. `SKOS_EXACT_MATCH` exists, but only at the `@beep/rdf/Vocab/Skos` subpath, not the root barrel.

Corrected current form:

```ts
import { makeNamedNode } from "@beep/rdf/Rdf"
import {
  PROV_ENTITY,
  PROV_NAMESPACE,
} from "@beep/rdf/Vocab/Prov"
import { SKOS_EXACT_MATCH } from "@beep/rdf/Vocab/Skos"

const PROV_WAS_ATTRIBUTED_TO =
  makeNamedNode(`${PROV_NAMESPACE}wasAttributedTo`)
const PROV_WAS_DERIVED_FROM =
  makeNamedNode(`${PROV_NAMESPACE}wasDerivedFrom`)
```

Prefer adding the missing predicates to the canonical PROV vocabulary module if they will be reused.

### 10. False `Match.exhaustive` guarantee

Broken excerpt:

```ts
const ascribe = Match.type<typeof Norm.Type>().pipe(
  Match.discriminator("normKind")("regulative", activate),
  Match.discriminator("normKind")("constitutive", qualify),
  Match.exhaustive,
)

// “add a fifth modality and every fold fails to compile”
```

The matcher consumes the `normKind` discriminant, whose domain is only `constitutive | regulative`. `modality` is a nested field in the regulative branch. Adding a modality does not add an unmatched `normKind`, so this fold remains exhaustive.

Corrected Effect-v4 form:

```ts
const activateModality =
  Match.type<typeof DeonticModality.Type>().pipe(
    Match.when("obligation", activateObligation),
    Match.when("prohibition", activateProhibition),
    Match.when("permission", activatePermission),
    Match.when("power", activatePower),
    Match.exhaustive,
  )
```

Corrected claim: adding a new `normKind` breaks `ascribe`; adding a modality breaks only exhaustive folds over `DeonticModality.Type`.

### 11. Divergent `AlignmentStatus`

Broken excerpt:

```ts
const AlignmentStatus = LiteralKit([
  "match_exact",
  "match_greater",
  "match_lesser",
  "match_fuzzy",
])
```

The canonical repository schema is already exported from `@beep/langextract/Extraction` as:

```text
match_exact | match_lesser | match_fuzzy | unaligned
```

It contains no `match_greater` and is already consumed by the law-practice conversion service. Redeclaring a near-match creates incompatible provenance vocabularies.

Corrected form:

```ts
import { AlignmentStatus } from "@beep/langextract/Extraction"

class EvidenceSpan extends S.Class<EvidenceSpan>($I`EvidenceSpan`)({
  ...TextAnchorFields,
  alignmentStatus: AlignmentStatus,
  confidence: Confidence,
}) {}
```

Any desired new status must first change the canonical schema and its consumers.

### 12. Incorrect architecture placement

Broken excerpt:

```text
Foundational: generic Relator and multi-temporal LegalValidity
Legal core: standalone @beep/legal-core shared-kernel-tier package
law-practice/domain may import legal-core
```

Current architecture routes product behavior and product language to the owning slice. Language deliberately shared by multiple slices moves to `shared/*` only after the promotion gate. `foundation/*` is reserved for domain-agnostic substrate. A `LegalValidity` carrying legal-system, applicability, enforceability, and efficacy semantics is not domain-agnostic merely because multiple legal verticals might use it.

Corrected placement:

```text
Generic TimeInterval mechanics        -> foundation/modeling
Law-specific validity semantics       -> law-practice/domain initially
Proven cross-slice legal vocabulary   -> shared/domain after promotion
Standalone @beep/legal-core family    -> not a current canonical tier
```

### 13. Invalid `S.optionalWith` fallback

Broken excerpt:

```ts
withinRelator: S.OptionFromOptionalKey(RelatorId),
// otherwise S.optionalWith(RelatorId, { as: "Option" })
```

`S.OptionFromOptionalKey` is the vendored v4 API; `S.optionalWith` is absent. The main expression is correct, while the fallback sends readers back to a removed API.

Corrected repo-style form:

```ts
withinRelator: S.OptionFromOptionalKey(RelatorId).pipe(
  SchemaUtils.withNoneDefault,
)
```

## Coverage

- Read all 1,560 document lines and audited all 56 TypeScript fences.
- Enumerated every `S.*`, `Match.*`, `Effect.*`, `Layer.*`, `@beep/*`, identity, RDF-vocabulary, and semantic-metadata reference in those fences.
- Verified Effect APIs against vendored `effect` version `4.0.0-beta.101` (`node_modules/effect/package.json:2-4`), its public JavaScript/type declarations, and current repository usage.
- Checked all explicit `@beep/*` imports and named symbols against live package source and barrels. The disclosed candidate `@beep/legal-core` was not faulted merely for being prospective; its proposed placement was reviewed separately.
- Spot-checked the load-bearing claims around identity registries, `SemanticSchemaMetadata`, RDF vocabulary exports, `EvidenceSpan`, `ClaimGateResult`, `ClaimProjection`, `AlignmentStatus`, ontology package state, and package topology.
- “20 clean” means no evidence-backed defect was found in the scoped Effect/@beep surface. Many fences are intentionally fragmentary and contain ellipses, unbound conceptual locals, or external-library placeholders; they cannot honestly be certified as standalone compilable programs.
- External project APIs and the legal-scholarship conclusions were not reviewed. No attempt was made to reconstruct the June-29 checkout; this audit uses the requested current 2026-07-25 repository as ground truth.

## Recommendation

Preserve the June-29 synthesis verbatim as historical prior art. Add a prominent dated errata banner near the top that links to a separate review/errata artifact and states that code examples reflect a pre-current-v4/pre-current-architecture snapshot. Do not silently rewrite the historical text.

Errata are warranted for **all thirteen findings**, specifically:

1. Replace every `S.filter` form and callback-valued filter message.
2. Replace every `S.pattern` form.
3. Complete every `makeSemanticSchemaMetadata` payload.
4. Correct the `EntityId` import and two-stage factory call.
5. Mark `LawPractice.PartyId` nonexistent and require an owning-domain ID decision.
6. Reclassify the verification publication gate as proposed, not existing.
7. Mark the `Ontology.create` roadmap superseded and record the current package state.
8. Replace `S.TaggedError` with the repository’s `TaggedErrorClass`.
9. Correct the PROV and SKOS vocabulary imports.
10. Narrow the `Match.exhaustive` claim to the discriminant actually matched.
11. Import the canonical `AlignmentStatus` instead of redeclaring it.
12. Route legal product language through the owning slice/shared-kernel promotion rules.
13. Remove the `S.optionalWith` fallback.
