/**
 * Patent citation event entity model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { TextAnchorVerificationReceipt } from "@beep/provenance/VerifiedTextAnchor";
import { SchemaUtils } from "@beep/schema";
import * as EntitySchema from "@beep/schema/EntitySchema";
import { BaseEntity } from "@beep/shared-domain/entity/BaseEntity";
import * as LawPractice from "@beep/shared-domain/identity/LawPractice";
import * as S from "effect/Schema";
import { CitingApplicationIdentity } from "../../values/CitingApplicationIdentity/index.ts";
import { ObservationVersionRef } from "../../values/ObservationVersionRef/index.ts";
import { PatentReference } from "../../values/PatentMetadata/index.ts";
import {
  PatentCitationActor,
  PatentCitationDiscovery,
  PatentCitationQuarantine,
} from "./PatentCitationEvent.values.ts";

const $I = $LawPracticeDomainId.create("entities/PatentCitationEvent/PatentCitationEvent.model");

/**
 * One observed occurrence of a patent reference cited against a filing.
 *
 * **When to use**
 *
 * Use to record an occurrence exactly as observed, so an attorney can later
 * dispose of it. One event is one observation of one source version; a newer
 * observation of the same source is a new event, never an edit to this one.
 *
 * **Details**
 *
 * The observation version this event is bound to lives inside `grounding`: a
 * verification receipt carries both the text anchor and the exact
 * `SourceTextIdentity` it was verified against, so the version needs no
 * separate field and cannot drift from the evidence.
 *
 * Two explicit states are recorded beside the evidence rather than written
 * into it. `supersedes` is declared by a newer observation and is the only
 * mechanism by which currency moves. `quarantine` marks an observation that
 * was ingested but cannot be trusted. `possibleDuplicateOf` records a
 * suspected duplicate without resolving it.
 *
 * **Gotchas**
 *
 * A persisted receipt is not live proof. Anything asserting that this event is
 * current must resolve the canonical source text and re-run
 * `verifyTextAnchor`; receipt existence proves only that a verification once
 * happened.
 *
 * Only an `AiDiscovered` event participates in the candor gate's quantified
 * set. Examiner-observed events are recorded alongside and never gate.
 *
 * **Example** (Inspect the recorded observation surface)
 *
 * ```ts
 * import { PatentCitationEvent } from "@beep/law-practice-domain"
 *
 * console.log(PatentCitationEvent.fields.grounding !== undefined) // true
 * console.log(PatentCitationEvent.fields.supersedes !== undefined) // true
 * ```
 *
 * @category entities
 * @since 0.0.0
 */
export class PatentCitationEvent extends BaseEntity.Class<PatentCitationEvent>($I`PatentCitationEvent`)(
  LawPractice.PatentCitationEventId,
  {
    fields: {
      actor: PatentCitationActor.annotateKey({
        description: "Party the observed source attributes the citation act to.",
      }),
      citingApplication: CitingApplicationIdentity.annotateKey({
        description: "Filing the reference is recorded as being cited against.",
      }),
      discovery: PatentCitationDiscovery.annotateKey({
        description: "Tagged provenance describing how this occurrence came to be recorded.",
      }),
      grounding: TextAnchorVerificationReceipt.annotateKey({
        description:
          "Persisted anchor and exact source identity from the observation's verification; re-verification is required before any current claim.",
      }),
      observedAt: EntitySchema.DateTimeFromMillis.annotateKey({
        description: "Time the occurrence was observed, recorded for audit and never used to establish currency.",
      }),
      possibleDuplicateOf: S.OptionFromNullOr(LawPractice.PatentCitationEventId)
        .pipe(SchemaUtils.withNoneDefault)
        .annotateKey({
          description: "Suspected duplicate of another event, recorded and never resolved; makes this event uncovered.",
        }),
      quarantine: S.OptionFromNullOr(PatentCitationQuarantine).pipe(SchemaUtils.withNoneDefault).annotateKey({
        description: "Explicit quarantine marker layered beside the evidence, never rewriting it.",
      }),
      reference: PatentReference.annotateKey({
        description: "Parsed patent document reference this occurrence names.",
      }),
      supersedes: S.OptionFromNullOr(ObservationVersionRef).pipe(SchemaUtils.withNoneDefault).annotateKey({
        description: "Declared reference to the exact prior observation version this observation replaces.",
      }),
    },
    persisted: {
      actor: EntitySchema.persist.literal({
        columnName: "actor",
      }),
      citingApplication: EntitySchema.persist.jsonb({
        columnName: "citing_application",
      }),
      discovery: EntitySchema.persist.jsonb({
        columnName: "discovery",
      }),
      grounding: EntitySchema.persist.jsonb({
        columnName: "grounding",
      }),
      observedAt: EntitySchema.persist.timestampMillis({
        columnName: "observed_at",
      }),
      possibleDuplicateOf: EntitySchema.persist.entityId({
        columnName: "possible_duplicate_of",
      }),
      quarantine: EntitySchema.persist.jsonb({
        columnName: "quarantine",
      }),
      reference: EntitySchema.persist.jsonb({
        columnName: "reference",
      }),
      supersedes: EntitySchema.persist.jsonb({
        columnName: "supersedes",
      }),
    },
  },
  $I.annote("PatentCitationEvent", {
    description: "One observed, source-versioned occurrence of a patent reference cited against a filing.",
  })
) {}
