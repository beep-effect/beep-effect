/**
 * Concept-local value objects for patent citation events.
 *
 * @packageDocumentation
 * @category value-objects
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("entities/PatentCitationEvent/PatentCitationEvent.values");
const PatentCitationActorBase = LiteralKit(["Examiner", "Applicant", "ThirdParty"]);
const PatentCitationQuarantineReasonBase = LiteralKit(["unknown-code", "malformed-record"]);

/**
 * Party recorded as having cited a reference in the observed source.
 *
 * **When to use**
 *
 * Use to record who the observed source attributes the citation act to, as
 * distinct from how the occurrence was discovered.
 *
 * **Details**
 *
 * The three members mirror the parties whose citation acts United States
 * prosecution practice distinguishes: examiner citations, applicant
 * submissions, and third-party submissions. Actor is deliberately a separate
 * field from face-list presence, office-action reliance, and model similarity;
 * collapsing them would assert claims the observation does not support.
 *
 * **Gotchas**
 *
 * Actor never implies materiality, reliance, or approval. It records
 * attribution as observed and nothing else.
 *
 * **Example** (Narrow a recorded actor)
 *
 * ```ts
 * import { PatentCitationActor } from "@beep/law-practice-domain"
 *
 * console.log(PatentCitationActor.is.Examiner("Examiner")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PatentCitationActor = PatentCitationActorBase.pipe(
  $I.annoteSchema("PatentCitationActor", {
    description: "Party recorded as having cited a patent reference in the observed source.",
  }),
  SchemaUtils.withLiteralKitStatics(PatentCitationActorBase)
);

/**
 * Runtime type for {@link PatentCitationActor}.
 *
 * @see {@link PatentCitationActor} for the runtime schema and member meanings.
 * @category models
 * @since 0.0.0
 */
export type PatentCitationActor = typeof PatentCitationActor.Type;

/**
 * Discovery provenance for an occurrence observed in a prosecution document.
 *
 * **Example** (Record an examiner-observed occurrence)
 *
 * ```ts
 * import { ExaminerObservedDiscovery } from "@beep/law-practice-domain"
 *
 * const discovery = ExaminerObservedDiscovery.make({ kind: "ExaminerObserved" })
 * console.log(discovery.kind) // "ExaminerObserved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExaminerObservedDiscovery extends S.Class<ExaminerObservedDiscovery>($I`ExaminerObservedDiscovery`)(
  {
    kind: S.tag("ExaminerObserved").annotateKey({
      description: "Discovery discriminator for an occurrence read from an examiner-authored record.",
    }),
  },
  $I.annote("ExaminerObservedDiscovery", {
    description: "Occurrence observed directly in an examiner-authored prosecution record.",
  })
) {}

/**
 * Named and versioned model credited with an AI-discovered occurrence.
 *
 * **Example** (Attribute a finding to an exact model build)
 *
 * ```ts
 * import { DiscoveryModel } from "@beep/law-practice-domain"
 *
 * const model = DiscoveryModel.make({ name: "reference-extractor", version: "3" })
 * console.log(model.version) // "3"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DiscoveryModel extends S.Class<DiscoveryModel>($I`DiscoveryModel`)(
  {
    name: S.NonEmptyString.annotateKey({
      description: "Stable model implementation name credited with the discovery.",
    }),
    version: S.NonEmptyString.annotateKey({
      description: "Pinned model implementation version credited with the discovery.",
    }),
  },
  $I.annote("DiscoveryModel", {
    description: "Named and versioned model implementation credited with discovering an occurrence.",
  })
) {}

/**
 * Discovery provenance for an occurrence surfaced by a model.
 *
 * **Details**
 *
 * This is the only member of {@link PatentCitationDiscovery} that the candor
 * gate quantifies over. Recording the model name and version keeps the finding
 * attributable to an exact build rather than to "the system".
 *
 * **Example** (Record an AI-discovered occurrence)
 *
 * ```ts
 * import { AiDiscovery, DiscoveryModel } from "@beep/law-practice-domain"
 *
 * const discovery = AiDiscovery.make({
 *   kind: "AiDiscovered",
 *   model: DiscoveryModel.make({ name: "reference-extractor", version: "3" }),
 * })
 * console.log(discovery.model.name) // "reference-extractor"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AiDiscovery extends S.Class<AiDiscovery>($I`AiDiscovery`)(
  {
    kind: S.tag("AiDiscovered").annotateKey({
      description: "Discovery discriminator for an occurrence surfaced by a model.",
    }),
    model: DiscoveryModel.annotateKey({
      description: "Named and versioned model credited with surfacing the occurrence.",
    }),
  },
  $I.annote("AiDiscovery", {
    description: "Occurrence surfaced by a named and versioned model rather than read from an examiner record.",
  })
) {}

/**
 * How an occurrence of a patent reference came to be recorded.
 *
 * **When to use**
 *
 * Use as the durable record of how an event entered the system. It does not
 * decide whether the event participates in the candor gate.
 *
 * **Details**
 *
 * The union stays deliberately narrow at this rung: exactly the two provenances
 * whose provenance behavior the spec settles. Examiner-observed and
 * AI-discovered occurrences now share the same fail-closed gating posture.
 * Adding a member is still a domain decision, not a schema convenience, which
 * is why the `CitationMention` handoff waits on its own goal.
 *
 * **Example** (Branch on discovery provenance)
 *
 * ```ts
 * import { PatentCitationDiscovery } from "@beep/law-practice-domain"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const program = S.decodeUnknownEffect(PatentCitationDiscovery)({ kind: "ExaminerObserved" })
 *
 * Effect.runPromise(program).then((discovery) => console.log(discovery.kind))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PatentCitationDiscovery = S.Union([ExaminerObservedDiscovery, AiDiscovery]).pipe(
  $I.annoteSchema("PatentCitationDiscovery", {
    description: "Tagged provenance describing how an occurrence of a patent reference came to be recorded.",
  }),
  S.toTaggedUnion("kind"),
  SchemaUtils.withCodecStatics
);

/**
 * Runtime type for {@link PatentCitationDiscovery}.
 *
 * @see {@link PatentCitationDiscovery} for the runtime schema and gating rules.
 * @category models
 * @since 0.0.0
 */
export type PatentCitationDiscovery = typeof PatentCitationDiscovery.Type;

/**
 * Machine-readable reason an observation could not be trusted as recorded.
 *
 * **Details**
 *
 * The vocabulary is intentionally small because no live producer exists yet:
 * quarantine is proven against hand-constructed fixtures until the prosecution
 * read goal lands raw-preserving unknown-code failures. Members are added with
 * their producer, never ahead of one.
 *
 * **Example** (Narrow a quarantine reason)
 *
 * ```ts
 * import { PatentCitationQuarantineReason } from "@beep/law-practice-domain"
 *
 * console.log(PatentCitationQuarantineReason.is["unknown-code"]("unknown-code")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PatentCitationQuarantineReason = PatentCitationQuarantineReasonBase.pipe(
  $I.annoteSchema("PatentCitationQuarantineReason", {
    description: "Machine-readable reason an observed occurrence was quarantined rather than trusted.",
  }),
  SchemaUtils.withLiteralKitStatics(PatentCitationQuarantineReasonBase)
);

/**
 * Runtime type for {@link PatentCitationQuarantineReason}.
 *
 * @see {@link PatentCitationQuarantineReason} for the runtime schema and vocabulary policy.
 * @category models
 * @since 0.0.0
 */
export type PatentCitationQuarantineReason = typeof PatentCitationQuarantineReason.Type;

/**
 * Explicit quarantine marker attached to an observation.
 *
 * **When to use**
 *
 * Use when an observation was ingested but cannot be trusted as recorded, and
 * the raw detail must survive for later human reading.
 *
 * **Gotchas**
 *
 * Quarantine never rewrites the evidence it marks. The anchor, receipt, and
 * source identity stay exactly as observed; quarantine is additional
 * information layered beside them, and it makes the event uncovered.
 *
 * **Example** (Quarantine an observation while preserving its raw detail)
 *
 * ```ts
 * import { PatentCitationQuarantine } from "@beep/law-practice-domain"
 *
 * const quarantine = PatentCitationQuarantine.make({
 *   rawDetail: "kind code ZZ is not in the pinned vocabulary",
 *   reason: "unknown-code",
 * })
 * console.log(quarantine.reason) // "unknown-code"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PatentCitationQuarantine extends S.Class<PatentCitationQuarantine>($I`PatentCitationQuarantine`)(
  {
    rawDetail: S.NonEmptyString.annotateKey({
      description: "Raw, unnormalized detail preserved verbatim from the producer that quarantined the observation.",
    }),
    reason: PatentCitationQuarantineReason.annotateKey({
      description: "Machine-readable quarantine reason.",
    }),
  },
  $I.annote("PatentCitationQuarantine", {
    description: "Explicit quarantine marker recording why an observation cannot be trusted as recorded.",
  })
) {}
