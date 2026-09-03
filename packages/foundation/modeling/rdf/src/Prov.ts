/**
 * Minimal stable PROV core and early extension tier for `@beep/semantic-web`.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

import { $RdfId } from "@beep/identity/packages";
import { SchemaUtils } from "@beep/schema";
import { DateTime } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeSemanticSchemaMetadata } from "./SemanticSchemaMetadata/index.ts";

const $I = $RdfId.create("prov");

const iriRegExp = /^\w+:\/*([^:<>{}|\\^`"\s/]+[^<>{}|\\^`"\s]*(?::[^:<>{}|\\^`"\s]+)?)?$/;
const curieRegExp = /^[A-Za-z_][^\s:/]*:[^:<>{}|\\^`"\s]*(\?[^<>{}|\\^`" ]*)?(#[^<>{}|\\^`"\s]*)?$/;
const localPartRegExp = /^[^:<>{}|\\^`"\s]*(\?[^<>{}|\\^`"\s]*)?(#[^<>{}|\\^`"\s]*)?$/;
const dateTimeRegExp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/;

const provObjectRefChecks = S.makeFilterGroup(
  [
    S.makeFilter((value: string) => iriRegExp.test(value) || curieRegExp.test(value) || localPartRegExp.test(value), {
      identifier: $I`ProvObjectRefPatternCheck`,
      title: "PROV Object Reference Pattern",
      description: "A PROV object reference encoded as an IRI, CURIE, or local identifier.",
      message: "Object references must be valid IRIs, CURIEs, or local identifiers",
    }),
  ],
  {
    identifier: $I`ProvObjectRefChecks`,
    title: "PROV Object Reference",
    description: "Checks for PROV object references.",
  }
);

const provDateTimeChecks = S.makeFilterGroup(
  [
    S.isPattern(dateTimeRegExp, {
      identifier: $I`ProvDateTimePatternCheck`,
      title: "PROV Date Time Pattern",
      description: "An ISO 8601 date-time with optional fractional seconds and timezone offset.",
      message: "Expected an ISO 8601 date-time string",
    }),
    S.makeFilter((value: string) => O.isSome(DateTime.make(value)), {
      identifier: $I`ProvDateTimeParseableCheck`,
      title: "PROV Date Time Parseable",
      description: "A date-time string that can be parsed into an Effect DateTime value.",
      message: "Expected a parseable date-time string",
    }),
  ],
  {
    identifier: $I`ProvDateTimeChecks`,
    title: "PROV Date Time",
    description: "Checks for PROV timestamp fields.",
  }
);

/**
 * PROV object reference encoded as an IRI, CURIE, or local identifier.
 *
 * **Example** (Decode CURIE object ref)
 *
 * ```ts import.meta.vitest name="Decode CURIE object ref"
 * import * as S from "effect/Schema"
 * import { ObjectRef } from "@beep/rdf/Prov"
 *
 * const ref = S.decodeUnknownSync(ObjectRef)("prov:entity1")
 * ref // => "prov:entity1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ObjectRef = S.String.check(provObjectRefChecks).pipe(
  S.brand("ProvObjectRef"),
  SchemaUtils.withCodecStatics(["decodeResult"]),
  $I.annoteSchema("ObjectRef", {
    description: "PROV object reference encoded as an IRI, CURIE, or local identifier.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "ObjectRef",
      overview: "PROV object reference encoded as an IRI, CURIE, or local identifier.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Qualified Relations", disposition: "normative" }],
      equivalenceBasis: "Exact reference-string equality inside a bounded provenance bundle.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
);

/**
 * Type for {@link ObjectRef}.
 *
 * **Example** (Accept ObjectRef type)
 *
 * ```ts
 * import type { ObjectRef } from "@beep/rdf/Prov"
 *
 * const acceptObjectRef = (value: ObjectRef) => value
 * console.log(acceptObjectRef)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ObjectRef = typeof ObjectRef.Type;

/**
 * Encoded PROV timestamp string.
 *
 * **Example** (Decode encoded timestamp)
 *
 * ```ts import.meta.vitest name="Decode encoded timestamp"
 * import * as S from "effect/Schema"
 * import { ProvDateTimeEncoded } from "@beep/rdf/Prov"
 *
 * const encoded = S.decodeUnknownSync(ProvDateTimeEncoded)("2024-01-02T03:04:05Z")
 * encoded // => "2024-01-02T03:04:05Z"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProvDateTimeEncoded = S.String.check(provDateTimeChecks).pipe(
  S.brand("ProvDateTimeEncoded"),
  $I.annoteSchema("ProvDateTimeEncoded", {
    description: "Encoded PROV timestamp string.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "ProvDateTimeEncoded",
      overview: "Encoded PROV timestamp string.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Time", disposition: "normative" }],
      equivalenceBasis: "Canonical ISO string equality after decoding and re-encoding.",
      timeSemantics: "PROV activity and lifecycle timestamps remain distinct from domain lifecycle fields.",
    }),
  })
);

/**
 * Type for {@link ProvDateTimeEncoded}.
 *
 * **Example** (Accept encoded datetime type)
 *
 * ```ts
 * import type { ProvDateTimeEncoded } from "@beep/rdf/Prov"
 *
 * const acceptProvDateTimeEncoded = (value: ProvDateTimeEncoded) => value
 * console.log(acceptProvDateTimeEncoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProvDateTimeEncoded = typeof ProvDateTimeEncoded.Type;

/**
 * PROV timestamp decoded to `DateTime.Utc`.
 *
 * **Example** (Decode to DateTime.Utc)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ProvDateTime } from "@beep/rdf/Prov"
 *
 * const instant = S.decodeUnknownSync(ProvDateTime)("2024-01-02T03:04:05Z")
 * console.log(instant)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProvDateTime = ProvDateTimeEncoded.pipe(
  S.decodeTo(S.DateTimeUtcFromString),
  SchemaUtils.withCodecStatics(["decodeResult"]),
  $I.annoteSchema("ProvDateTime", {
    description: "PROV timestamp decoded to DateTime.Utc.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "ProvDateTime",
      overview: "PROV timestamp decoded to DateTime.Utc.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Time", disposition: "normative" }],
      equivalenceBasis: "UTC instant equality.",
      timeSemantics: "PROV timestamps express activity and influence time, not all domain lifecycle semantics.",
    }),
  })
);

/**
 * Type for {@link ProvDateTime}.
 *
 * **Example** (Accept ProvDateTime type)
 *
 * ```ts
 * import type { ProvDateTime } from "@beep/rdf/Prov"
 *
 * const acceptProvDateTime = (value: ProvDateTime) => value
 * console.log(acceptProvDateTime)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProvDateTime = typeof ProvDateTime.Type;

/**
 * Explicit lifecycle time fields retained outside plain PROV activity timestamps.
 *
 * **Example** (Decode observedAt option)
 *
 * ```ts import.meta.vitest name="Decode observedAt option"
 * import * as S from "effect/Schema"
 * import { LifecycleTimes } from "@beep/rdf/Prov"
 *
 * const times = S.decodeUnknownSync(LifecycleTimes)({
 *   observedAt: "2024-01-02T03:04:05Z"
 * })
 * times.observedAt._tag // => "Some"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LifecycleTimes extends S.Class<LifecycleTimes>($I`LifecycleTimes`)(
  {
    observedAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    publishedAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    ingestedAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    assertedAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    derivedAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    effectiveAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    supersededAt: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("LifecycleTimes", {
    description: "Explicit lifecycle time fields retained outside plain PROV activity timestamps.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "LifecycleTimes",
      overview: "Explicit lifecycle time fields retained outside plain PROV activity timestamps.",
      status: "stable",
      specifications: [{ name: "PROV-O", disposition: "informative" }],
      equivalenceBasis: "UTC instant equality per lifecycle field.",
      provenanceProfile: "minimal-core-v1",
      timeSemantics:
        "Lifecycle semantics remain explicit and are not collapsed into prov:startedAtTime or prov:endedAtTime.",
    }),
  })
) {}

/**
 * PROV entity.
 *
 * **Example** (Decode PROV entity)
 *
 * ```ts import.meta.vitest name="Decode PROV entity"
 * import * as S from "effect/Schema"
 * import { Entity } from "@beep/rdf/Prov"
 *
 * const entity = S.decodeUnknownSync(Entity)({
 *   provType: "Entity",
 *   id: "entity:artifact"
 * })
 * entity.provType // => "Entity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Entity extends S.Class<Entity>($I`Entity`)(
  {
    provType: S.tag("Entity"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    wasGeneratedBy: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    wasAttributedTo: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    hadPrimarySource: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    wasQuotedFrom: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    wasRevisionOf: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    wasDerivedFrom: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    generatedAtTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    invalidatedAtTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    value: S.OptionFromOptionalKey(S.Union([S.String, S.Finite, S.Boolean])).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Entity", {
    description: "PROV entity.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Entity",
      overview: "PROV entity.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Entity", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
) {}

/**
 * PROV activity.
 *
 * **Example** (Decode PROV activity)
 *
 * ```ts import.meta.vitest name="Decode PROV activity"
 * import * as S from "effect/Schema"
 * import { Activity } from "@beep/rdf/Prov"
 *
 * const activity = S.decodeUnknownSync(Activity)({
 *   provType: "Activity",
 *   id: "activity:build"
 * })
 * activity.provType // => "Activity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Activity extends S.Class<Activity>($I`Activity`)(
  {
    provType: S.tag("Activity"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    used: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    wasAssociatedWith: ObjectRef.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    startedAtTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
    endedAtTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Activity", {
    description: "PROV activity.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Activity",
      overview: "PROV activity.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Activity", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
) {}

/**
 * PROV agent.
 *
 * **Example** (Decode PROV agent)
 *
 * ```ts import.meta.vitest name="Decode PROV agent"
 * import * as S from "effect/Schema"
 * import { Agent } from "@beep/rdf/Prov"
 *
 * const agent = S.decodeUnknownSync(Agent)({
 *   provType: "Agent",
 *   name: "CI"
 * })
 * agent.provType // => "Agent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Agent extends S.Class<Agent>($I`Agent`)(
  {
    provType: S.tag("Agent"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Agent", {
    description: "PROV agent.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Agent",
      overview: "PROV agent.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Agent", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
) {}

/**
 * PROV software agent.
 *
 * **Example** (Decode software agent)
 *
 * ```ts import.meta.vitest name="Decode software agent"
 * import * as S from "effect/Schema"
 * import { SoftwareAgent } from "@beep/rdf/Prov"
 *
 * const agent = S.decodeUnknownSync(SoftwareAgent)({
 *   provType: "SoftwareAgent",
 *   id: "agent:ingest-worker",
 *   name: "ingest-worker"
 * })
 * agent.provType // => "SoftwareAgent"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SoftwareAgent extends S.Class<SoftwareAgent>($I`SoftwareAgent`)(
  {
    provType: S.tag("SoftwareAgent"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("SoftwareAgent", {
    description: "PROV software agent.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "SoftwareAgent",
      overview: "PROV software agent.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "SoftwareAgent", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
) {}

/**
 * PROV plan.
 *
 * **Example** (Decode PROV plan)
 *
 * ```ts import.meta.vitest name="Decode PROV plan"
 * import * as S from "effect/Schema"
 * import { Plan } from "@beep/rdf/Prov"
 *
 * const plan = S.decodeUnknownSync(Plan)({
 *   provType: "Plan",
 *   id: "plan:refresh",
 *   name: "Refresh dataset"
 * })
 * plan.provType // => "Plan"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Plan extends S.Class<Plan>($I`Plan`)(
  {
    provType: S.tag("Plan"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Plan", {
    description: "PROV plan in the early extension tier.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Plan",
      overview: "PROV plan in the early extension tier.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Plan", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "extension-tier-v1",
    }),
  })
) {}

/**
 * PROV collection.
 *
 * **Example** (Decode collection members)
 *
 * ```ts import.meta.vitest name="Decode collection members"
 * import * as S from "effect/Schema"
 * import { Collection } from "@beep/rdf/Prov"
 *
 * const collection = S.decodeUnknownSync(Collection)({
 *   provType: "Collection",
 *   id: "collection:bundle",
 *   hadMember: ["entity:source", "entity:derived"]
 * })
 * collection.hadMember.length // => 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Collection extends S.Class<Collection>($I`Collection`)(
  {
    provType: S.tag("Collection"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    hadMember: S.Array(ObjectRef),
  },
  $I.annote("Collection", {
    description: "PROV collection in the early extension tier.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Collection",
      overview: "PROV collection in the early extension tier.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Collection", disposition: "normative" }],
      equivalenceBasis: "Identifier and member equality within a bounded provenance bundle.",
      provenanceProfile: "extension-tier-v1",
    }),
  })
) {}

/**
 * PROV person.
 *
 * **Example** (Decode PROV person)
 *
 * ```ts import.meta.vitest name="Decode PROV person"
 * import * as S from "effect/Schema"
 * import { Person } from "@beep/rdf/Prov"
 *
 * const person = S.decodeUnknownSync(Person)({
 *   provType: "Person",
 *   id: "person:ada",
 *   name: "Ada"
 * })
 * person.provType // => "Person"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Person extends S.Class<Person>($I`Person`)(
  {
    provType: S.tag("Person"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Person", {
    description: "PROV person in the early extension tier.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Person",
      overview: "PROV person in the early extension tier.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Person", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "extension-tier-v1",
    }),
  })
) {}

/**
 * PROV organization.
 *
 * **Example** (Decode PROV organization)
 *
 * ```ts import.meta.vitest name="Decode PROV organization"
 * import * as S from "effect/Schema"
 * import { Organization } from "@beep/rdf/Prov"
 *
 * const organization = S.decodeUnknownSync(Organization)({
 *   provType: "Organization",
 *   id: "org:beep",
 *   name: "Beep"
 * })
 * organization.provType // => "Organization"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Organization extends S.Class<Organization>($I`Organization`)(
  {
    provType: S.tag("Organization"),
    id: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
    name: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Organization", {
    description: "PROV organization in the early extension tier.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "Organization",
      overview: "PROV organization in the early extension tier.",
      status: "stable",
      specifications: [{ name: "PROV-O", section: "Organization", disposition: "normative" }],
      equivalenceBasis: "Identifier and field equality within a bounded provenance bundle.",
      provenanceProfile: "extension-tier-v1",
    }),
  })
) {}

const relationMetadata = (canonicalName: string, overview: string, profile: "minimal-core-v1" | "extension-tier-v1") =>
  makeSemanticSchemaMetadata({
    kind: "provenanceConstruct",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "PROV-O", disposition: "normative" }],
    equivalenceBasis: "Field equality within a bounded provenance bundle.",
    provenanceProfile: profile,
  });

/**
 * PROV usage relation.
 *
 * **Example** (Decode usage relation)
 *
 * ```ts import.meta.vitest name="Decode usage relation"
 * import * as S from "effect/Schema"
 * import { Usage } from "@beep/rdf/Prov"
 *
 * const usage = S.decodeUnknownSync(Usage)({
 *   provType: "Usage",
 *   activity: "activity:build",
 *   entity: "entity:source"
 * })
 * usage.activity // => "activity:build"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Usage extends S.Class<Usage>($I`Usage`)(
  {
    provType: S.tag("Usage"),
    activity: ObjectRef,
    entity: ObjectRef,
    atTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Usage", {
    description: "PROV usage relation.",
    semanticSchemaMetadata: relationMetadata("Usage", "PROV usage relation.", "minimal-core-v1"),
  })
) {}

/**
 * PROV generation relation.
 *
 * **Example** (Decode generation relation)
 *
 * ```ts import.meta.vitest name="Decode generation relation"
 * import * as S from "effect/Schema"
 * import { Generation } from "@beep/rdf/Prov"
 *
 * const generation = S.decodeUnknownSync(Generation)({
 *   provType: "Generation",
 *   entity: "entity:artifact",
 *   activity: "activity:build"
 * })
 * generation.entity // => "entity:artifact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Generation extends S.Class<Generation>($I`Generation`)(
  {
    provType: S.tag("Generation"),
    entity: ObjectRef,
    activity: ObjectRef,
    atTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Generation", {
    description: "PROV generation relation.",
    semanticSchemaMetadata: relationMetadata("Generation", "PROV generation relation.", "minimal-core-v1"),
  })
) {}

/**
 * PROV association relation.
 *
 * **Example** (Decode association with plan)
 *
 * ```ts import.meta.vitest name="Decode association with plan"
 * import * as S from "effect/Schema"
 * import { Association } from "@beep/rdf/Prov"
 *
 * const association = S.decodeUnknownSync(Association)({
 *   provType: "Association",
 *   activity: "activity:build",
 *   agent: "agent:ci",
 *   hadPlan: "plan:refresh"
 * })
 * association.agent // => "agent:ci"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Association extends S.Class<Association>($I`Association`)(
  {
    provType: S.tag("Association"),
    activity: ObjectRef,
    agent: ObjectRef,
    hadPlan: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Association", {
    description: "PROV association relation.",
    semanticSchemaMetadata: relationMetadata("Association", "PROV association relation.", "minimal-core-v1"),
  })
) {}

/**
 * PROV attribution relation.
 *
 * **Example** (Decode attribution relation)
 *
 * ```ts import.meta.vitest name="Decode attribution relation"
 * import * as S from "effect/Schema"
 * import { Attribution } from "@beep/rdf/Prov"
 *
 * const attribution = S.decodeUnknownSync(Attribution)({
 *   provType: "Attribution",
 *   entity: "entity:artifact",
 *   agent: "agent:ci"
 * })
 * attribution.entity // => "entity:artifact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Attribution extends S.Class<Attribution>($I`Attribution`)(
  {
    provType: S.tag("Attribution"),
    entity: ObjectRef,
    agent: ObjectRef,
  },
  $I.annote("Attribution", {
    description: "PROV attribution relation.",
    semanticSchemaMetadata: relationMetadata("Attribution", "PROV attribution relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV delegation relation.
 *
 * **Example** (Decode delegation relation)
 *
 * ```ts import.meta.vitest name="Decode delegation relation"
 * import * as S from "effect/Schema"
 * import { Delegation } from "@beep/rdf/Prov"
 *
 * const delegation = S.decodeUnknownSync(Delegation)({
 *   provType: "Delegation",
 *   delegate: "agent:worker",
 *   responsible: "agent:service",
 *   activity: "activity:build"
 * })
 * delegation.delegate // => "agent:worker"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Delegation extends S.Class<Delegation>($I`Delegation`)(
  {
    provType: S.tag("Delegation"),
    delegate: ObjectRef,
    responsible: ObjectRef,
    activity: S.OptionFromOptionalKey(ObjectRef).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Delegation", {
    description: "PROV delegation relation.",
    semanticSchemaMetadata: relationMetadata("Delegation", "PROV delegation relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV derivation relation.
 *
 * **Example** (Decode derivation relation)
 *
 * ```ts import.meta.vitest name="Decode derivation relation"
 * import * as S from "effect/Schema"
 * import { Derivation } from "@beep/rdf/Prov"
 *
 * const derivation = S.decodeUnknownSync(Derivation)({
 *   provType: "Derivation",
 *   generatedEntity: "entity:derived",
 *   usedEntity: "entity:source"
 * })
 * derivation.usedEntity // => "entity:source"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Derivation extends S.Class<Derivation>($I`Derivation`)(
  {
    provType: S.tag("Derivation"),
    generatedEntity: ObjectRef,
    usedEntity: ObjectRef,
  },
  $I.annote("Derivation", {
    description: "PROV derivation relation.",
    semanticSchemaMetadata: relationMetadata("Derivation", "PROV derivation relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV primary-source relation.
 *
 * **Example** (Decode primary-source relation)
 *
 * ```ts import.meta.vitest name="Decode primary-source relation"
 * import * as S from "effect/Schema"
 * import { PrimarySource } from "@beep/rdf/Prov"
 *
 * const source = S.decodeUnknownSync(PrimarySource)({
 *   provType: "PrimarySource",
 *   entity: "entity:claim",
 *   source: "entity:record"
 * })
 * source.source // => "entity:record"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class PrimarySource extends S.Class<PrimarySource>($I`PrimarySource`)(
  {
    provType: S.tag("PrimarySource"),
    entity: ObjectRef,
    source: ObjectRef,
  },
  $I.annote("PrimarySource", {
    description: "PROV primary-source relation.",
    semanticSchemaMetadata: relationMetadata("PrimarySource", "PROV primary-source relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV quotation relation.
 *
 * **Example** (Decode quotation relation)
 *
 * ```ts import.meta.vitest name="Decode quotation relation"
 * import * as S from "effect/Schema"
 * import { Quotation } from "@beep/rdf/Prov"
 *
 * const quotation = S.decodeUnknownSync(Quotation)({
 *   provType: "Quotation",
 *   entity: "entity:quote",
 *   source: "entity:transcript"
 * })
 * quotation.entity // => "entity:quote"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Quotation extends S.Class<Quotation>($I`Quotation`)(
  {
    provType: S.tag("Quotation"),
    entity: ObjectRef,
    source: ObjectRef,
  },
  $I.annote("Quotation", {
    description: "PROV quotation relation.",
    semanticSchemaMetadata: relationMetadata("Quotation", "PROV quotation relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV revision relation.
 *
 * **Example** (Decode revision relation)
 *
 * ```ts import.meta.vitest name="Decode revision relation"
 * import * as S from "effect/Schema"
 * import { Revision } from "@beep/rdf/Prov"
 *
 * const revision = S.decodeUnknownSync(Revision)({
 *   provType: "Revision",
 *   entity: "entity:v2",
 *   source: "entity:v1"
 * })
 * revision.source // => "entity:v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Revision extends S.Class<Revision>($I`Revision`)(
  {
    provType: S.tag("Revision"),
    entity: ObjectRef,
    source: ObjectRef,
  },
  $I.annote("Revision", {
    description: "PROV revision relation.",
    semanticSchemaMetadata: relationMetadata("Revision", "PROV revision relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV start relation.
 *
 * **Example** (Decode start relation)
 *
 * ```ts import.meta.vitest name="Decode start relation"
 * import * as S from "effect/Schema"
 * import { Start } from "@beep/rdf/Prov"
 *
 * const start = S.decodeUnknownSync(Start)({
 *   provType: "Start",
 *   activity: "activity:build",
 *   trigger: "entity:commit",
 *   atTime: "2024-01-02T03:04:05Z"
 * })
 * start.activity // => "activity:build"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Start extends S.Class<Start>($I`Start`)(
  {
    provType: S.tag("Start"),
    activity: ObjectRef,
    trigger: ObjectRef,
    atTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("Start", {
    description: "PROV start relation.",
    semanticSchemaMetadata: relationMetadata("Start", "PROV start relation.", "extension-tier-v1"),
  })
) {}

/**
 * PROV end relation.
 *
 * **Example** (Decode end relation)
 *
 * ```ts import.meta.vitest name="Decode end relation"
 * import * as S from "effect/Schema"
 * import { End } from "@beep/rdf/Prov"
 *
 * const end = S.decodeUnknownSync(End)({
 *   provType: "End",
 *   activity: "activity:build",
 *   trigger: "entity:artifact",
 *   atTime: "2024-01-02T03:05:06Z"
 * })
 * end.trigger // => "entity:artifact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class End extends S.Class<End>($I`End`)(
  {
    provType: S.tag("End"),
    activity: ObjectRef,
    trigger: ObjectRef,
    atTime: S.OptionFromOptionalKey(ProvDateTime).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("End", {
    description: "PROV end relation.",
    semanticSchemaMetadata: relationMetadata("End", "PROV end relation.", "extension-tier-v1"),
  })
) {}

/**
 * Public PROV record union for the stable semantic-web surface.
 *
 * **Example** (Narrow ProvRecord union)
 *
 * ```ts import.meta.vitest name="Narrow ProvRecord union"
 * import * as S from "effect/Schema"
 * import { Agent, ProvRecord } from "@beep/rdf/Prov"
 *
 * const decoded = S.decodeUnknownSync(ProvRecord)({ provType: "Agent", name: "bob" })
 *
 * if (S.is(Agent)(decoded)) {
 *   decoded.provType // => "Agent"
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProvRecord = S.Union([
  Entity,
  Activity,
  Agent,
  SoftwareAgent,
  Plan,
  Collection,
  Person,
  Organization,
  Usage,
  Generation,
  Association,
  Attribution,
  Delegation,
  Derivation,
  PrimarySource,
  Quotation,
  Revision,
  Start,
  End,
]).pipe(
  S.toTaggedUnion("provType"),
  $I.annoteSchema("ProvRecord", {
    description: "Public PROV record union for the stable semantic-web surface.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "ProvRecord",
      overview: "Public PROV record union for the stable semantic-web surface.",
      status: "stable",
      specifications: [{ name: "PROV-O", disposition: "normative" }],
      equivalenceBasis: "Variant-aware field equality within a bounded provenance bundle.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
);

/**
 * Type for {@link ProvRecord}.
 *
 * **Example** (Accept ProvRecord type)
 *
 * ```ts
 * import type { ProvRecord } from "@beep/rdf/Prov"
 *
 * const acceptProvRecord = (value: ProvRecord) => value
 * console.log(acceptProvRecord)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProvRecord = typeof ProvRecord.Type;

/**
 * Bounded provenance bundle exported by the semantic-web surface.
 *
 * **Example** (Decode empty ProvBundle)
 *
 * ```ts import.meta.vitest name="Decode empty ProvBundle"
 * import * as S from "effect/Schema"
 * import { ProvBundle } from "@beep/rdf/Prov"
 *
 * const bundle = S.decodeUnknownSync(ProvBundle)({ records: [] })
 * bundle.records.length // => 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProvBundle extends S.Class<ProvBundle>($I`ProvBundle`)(
  {
    records: S.Array(ProvRecord),
    lifecycle: S.OptionFromOptionalKey(LifecycleTimes).pipe(SchemaUtils.withNoneDefault),
  },
  $I.annote("ProvBundle", {
    description: "Bounded provenance bundle exported by the semantic-web surface.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "ProvBundle",
      overview: "Bounded provenance bundle exported by the semantic-web surface.",
      status: "stable",
      specifications: [{ name: "PROV-O", disposition: "informative" }],
      equivalenceBasis: "Record collection equality plus lifecycle equality.",
      provenanceProfile: "minimal-core-v1",
      evidenceAnchoring: "Bundle exports are expected to be paired with explicit evidence anchors.",
      timeSemantics: "Lifecycle fields remain explicit adjuncts instead of being collapsed into activity timestamps.",
    }),
  })
) {
  static readonly decodeUnknownResult = S.decodeUnknownResult(this);

  static readonly is = S.is(ProvBundle);
}

/**
 * Public provenance entrypoint union.
 *
 * **Example** (Narrow ProvO to bundle)
 *
 * ```ts import.meta.vitest name="Narrow ProvO to bundle"
 * import * as S from "effect/Schema"
 * import { ProvBundle, ProvO } from "@beep/rdf/Prov"
 *
 * const provenance = S.decodeUnknownSync(ProvO)({ records: [] })
 * if (S.is(ProvBundle)(provenance)) {
 *   provenance.records.length // => 0
 * }
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProvO = S.Union([ProvBundle, ProvRecord]).pipe(
  $I.annoteSchema("ProvO", {
    description: "Public provenance entrypoint union.",
    semanticSchemaMetadata: makeSemanticSchemaMetadata({
      kind: "provenanceConstruct",
      canonicalName: "ProvO",
      overview: "Public provenance entrypoint union for bounded provenance values and bundles.",
      status: "stable",
      specifications: [{ name: "PROV-O", disposition: "normative" }],
      equivalenceBasis: "Variant-aware field equality within a bounded provenance export.",
      provenanceProfile: "minimal-core-v1",
    }),
  })
);

/**
 * Type for {@link ProvO}.
 *
 * **Example** (Accept ProvO type)
 *
 * ```ts
 * import type { ProvO } from "@beep/rdf/Prov"
 *
 * const acceptProvO = (value: ProvO) => value
 * console.log(acceptProvO)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type ProvO = typeof ProvO.Type;
