import {
  Activity,
  Association,
  Attribution,
  Collection,
  Delegation,
  Derivation,
  End,
  Entity,
  Generation,
  ObjectRef,
  Organization,
  Person,
  Plan,
  PrimarySource,
  ProvBundle,
  ProvDateTime,
  ProvO,
  Quotation,
  Revision,
  SoftwareAgent,
  Start,
  Usage,
} from "@beep/rdf/Prov";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknown = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownEffect(schema);

const decodeActivity = decodeUnknown(Activity);
const decodeAssociation = decodeUnknown(Association);
const decodeAttribution = decodeUnknown(Attribution);
const decodeCollection = decodeUnknown(Collection);
const decodeDelegation = decodeUnknown(Delegation);
const decodeDerivation = decodeUnknown(Derivation);
const decodeEnd = decodeUnknown(End);
const decodeEntity = decodeUnknown(Entity);
const decodeGeneration = decodeUnknown(Generation);
const decodeObjectRef = decodeUnknown(ObjectRef);
const decodeOrganization = decodeUnknown(Organization);
const decodePerson = decodeUnknown(Person);
const decodePlan = decodeUnknown(Plan);
const decodePrimarySource = decodeUnknown(PrimarySource);
const decodeProvBundle = decodeUnknown(ProvBundle);
const decodeProvDateTime = decodeUnknown(ProvDateTime);
const decodeProvO = decodeUnknown(ProvO);
const decodeQuotation = decodeUnknown(Quotation);
const decodeRevision = decodeUnknown(Revision);
const decodeSoftwareAgent = decodeUnknown(SoftwareAgent);
const decodeStart = decodeUnknown(Start);
const decodeUsage = decodeUnknown(Usage);

const rawBundle = {
  lifecycle: {
    observedAt: "2026-03-08T12:00:00Z",
  },
  records: [
    {
      id: "thing:alice",
      provType: "Entity",
      value: "Alice",
    },
    {
      endedAtTime: "2026-03-08T12:00:00Z",
      id: "activity:ingest",
      provType: "Activity",
      startedAtTime: "2026-03-08T11:00:00Z",
      used: ["thing:alice"],
    },
    {
      id: "agent:semantic-web",
      name: "semantic-web",
      provType: "SoftwareAgent",
    },
  ],
} as const;

describe("ProvO", () => {
  it.effect("decodes bounded provenance bundles through the current public entrypoint", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeProvO(rawBundle);

      expect("records" in decoded).toBe(true);
      if ("records" in decoded) {
        expect(decoded.records).toHaveLength(3);
        expect(O.isSome(decoded.lifecycle)).toBe(true);
      }
    })
  );

  it.effect("decodes stable record variants and timestamp adjuncts", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeEntity({
          generatedAtTime: "2026-03-08T12:00:00Z",
          id: "thing:alice",
          provType: "Entity",
          wasGeneratedBy: ["activity:ingest"],
        })
      ).toBeDefined();

      const activity = yield* decodeActivity({
        endedAtTime: "2026-03-08T12:00:00Z",
        id: "activity:ingest",
        provType: "Activity",
        startedAtTime: "2026-03-08T11:00:00Z",
        used: ["thing:alice"],
      });

      expect(O.isSome(activity.startedAtTime)).toBe(true);
      expect(O.isSome(activity.endedAtTime)).toBe(true);
      expect(yield* decodeProvDateTime("2026-03-08T12:00:00Z")).toBeDefined();
    })
  );

  it.effect("decodes extension-tier records that remain on the public semantic-web surface", () =>
    Effect.gen(function* () {
      expect(yield* decodePlan({ id: "plan:1", name: "Normalize bundle", provType: "Plan" })).toBeDefined();
      expect(
        yield* decodeCollection({ hadMember: ["thing:alice"], id: "collection:1", provType: "Collection" })
      ).toBeDefined();
      expect(yield* decodePerson({ id: "person:ada", name: "Ada", provType: "Person" })).toBeDefined();
      expect(yield* decodeOrganization({ id: "org:beep", name: "Beep", provType: "Organization" })).toBeDefined();
      expect(yield* decodeSoftwareAgent({ id: "agent:bot", name: "Bot", provType: "SoftwareAgent" })).toBeDefined();
    })
  );

  it.effect("decodes stable and extension-tier relations with object references", () =>
    Effect.gen(function* () {
      expect(
        yield* decodeUsage({
          provType: "Usage",
          activity: "activity:ingest",
          atTime: "2026-03-08T11:30:00Z",
          entity: "thing:alice",
        })
      ).toBeDefined();

      expect(
        yield* decodeGeneration({
          provType: "Generation",
          activity: "activity:ingest",
          atTime: "2026-03-08T12:00:00Z",
          entity: "thing:alice",
        })
      ).toBeDefined();

      expect(
        yield* decodeAssociation({
          provType: "Association",
          activity: "activity:ingest",
          agent: "agent:semantic-web",
          hadPlan: "plan:1",
        })
      ).toBeDefined();

      expect(
        yield* decodeAttribution({ provType: "Attribution", agent: "agent:semantic-web", entity: "thing:alice" })
      ).toBeDefined();
      expect(
        yield* decodeDelegation({ provType: "Delegation", delegate: "agent:bot", responsible: "agent:semantic-web" })
      ).toBeDefined();
      expect(
        yield* decodeDerivation({
          provType: "Derivation",
          generatedEntity: "thing:alice:v2",
          usedEntity: "thing:alice:v1",
        })
      ).toBeDefined();
      expect(
        yield* decodePrimarySource({ provType: "PrimarySource", entity: "thing:alice", source: "source:1" })
      ).toBeDefined();
      expect(
        yield* decodeQuotation({ provType: "Quotation", entity: "thing:alice", source: "source:2" })
      ).toBeDefined();
      expect(
        yield* decodeRevision({ provType: "Revision", entity: "thing:alice:v2", source: "thing:alice:v1" })
      ).toBeDefined();
      expect(
        yield* decodeStart({ provType: "Start", activity: "activity:ingest", trigger: "trigger:start" })
      ).toBeDefined();
      expect(yield* decodeEnd({ provType: "End", activity: "activity:ingest", trigger: "trigger:end" })).toBeDefined();
    })
  );

  it.effect("rejects invalid provenance values for the current schema surface", () =>
    Effect.gen(function* () {
      expect(Exit.isFailure(yield* Effect.exit(decodeProvO({ provType: "Bundle" })))).toBe(true);
      expect(Exit.isFailure(yield* Effect.exit(decodeCollection({ id: "collection:1", provType: "Collection" })))).toBe(
        true
      );
      expect(Exit.isFailure(yield* Effect.exit(decodeUsage({ provType: "Usage", activity: "activity:ingest" })))).toBe(
        true
      );
      expect(Exit.isFailure(yield* Effect.exit(decodeObjectRef("not valid whitespace ref")))).toBe(true);
    })
  );

  it.effect("accepts direct bundle decoding without going through the union entrypoint", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeProvBundle(rawBundle);

      expect(decoded.records).toHaveLength(3);
      expect(O.isSome(decoded.lifecycle)).toBe(true);
    })
  );
});
