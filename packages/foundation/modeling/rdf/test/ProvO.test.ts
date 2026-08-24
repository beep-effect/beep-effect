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
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUnknownSync = <Schema extends S.ConstraintDecoder<unknown, never>>(schema: Schema) =>
  S.decodeUnknownSync(schema);

const decodeActivity = decodeUnknownSync(Activity);
const decodeAssociation = decodeUnknownSync(Association);
const decodeAttribution = decodeUnknownSync(Attribution);
const decodeCollection = decodeUnknownSync(Collection);
const decodeDelegation = decodeUnknownSync(Delegation);
const decodeDerivation = decodeUnknownSync(Derivation);
const decodeEnd = decodeUnknownSync(End);
const decodeEntity = decodeUnknownSync(Entity);
const decodeGeneration = decodeUnknownSync(Generation);
const decodeObjectRef = decodeUnknownSync(ObjectRef);
const decodeOrganization = decodeUnknownSync(Organization);
const decodePerson = decodeUnknownSync(Person);
const decodePlan = decodeUnknownSync(Plan);
const decodePrimarySource = decodeUnknownSync(PrimarySource);
const decodeProvBundle = decodeUnknownSync(ProvBundle);
const decodeProvDateTime = decodeUnknownSync(ProvDateTime);
const decodeProvO = decodeUnknownSync(ProvO);
const decodeQuotation = decodeUnknownSync(Quotation);
const decodeRevision = decodeUnknownSync(Revision);
const decodeSoftwareAgent = decodeUnknownSync(SoftwareAgent);
const decodeStart = decodeUnknownSync(Start);
const decodeUsage = decodeUnknownSync(Usage);

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
  it("decodes bounded provenance bundles through the current public entrypoint", () => {
    const decoded = decodeProvO(rawBundle);

    expect("records" in decoded).toBe(true);
    if ("records" in decoded) {
      expect(decoded.records).toHaveLength(3);
      expect(O.isSome(decoded.lifecycle)).toBe(true);
    }
  });

  it("decodes stable record variants and timestamp adjuncts", () => {
    expect(
      decodeEntity({
        generatedAtTime: "2026-03-08T12:00:00Z",
        id: "thing:alice",
        provType: "Entity",
        wasGeneratedBy: ["activity:ingest"],
      })
    ).toBeDefined();

    const activity = decodeActivity({
      endedAtTime: "2026-03-08T12:00:00Z",
      id: "activity:ingest",
      provType: "Activity",
      startedAtTime: "2026-03-08T11:00:00Z",
      used: ["thing:alice"],
    });

    expect(O.isSome(activity.startedAtTime)).toBe(true);
    expect(O.isSome(activity.endedAtTime)).toBe(true);
    expect(() => decodeProvDateTime("2026-03-08T12:00:00Z")).not.toThrow();
  });

  it("decodes extension-tier records that remain on the public semantic-web surface", () => {
    expect(decodePlan({ id: "plan:1", name: "Normalize bundle", provType: "Plan" })).toBeDefined();
    expect(decodeCollection({ hadMember: ["thing:alice"], id: "collection:1", provType: "Collection" })).toBeDefined();
    expect(decodePerson({ id: "person:ada", name: "Ada", provType: "Person" })).toBeDefined();
    expect(decodeOrganization({ id: "org:beep", name: "Beep", provType: "Organization" })).toBeDefined();
    expect(decodeSoftwareAgent({ id: "agent:bot", name: "Bot", provType: "SoftwareAgent" })).toBeDefined();
  });

  it("decodes stable and extension-tier relations with object references", () => {
    expect(
      decodeUsage({
        provType: "Usage",
        activity: "activity:ingest",
        atTime: "2026-03-08T11:30:00Z",
        entity: "thing:alice",
      })
    ).toBeDefined();

    expect(
      decodeGeneration({
        provType: "Generation",
        activity: "activity:ingest",
        atTime: "2026-03-08T12:00:00Z",
        entity: "thing:alice",
      })
    ).toBeDefined();

    expect(
      decodeAssociation({
        provType: "Association",
        activity: "activity:ingest",
        agent: "agent:semantic-web",
        hadPlan: "plan:1",
      })
    ).toBeDefined();

    expect(
      decodeAttribution({ provType: "Attribution", agent: "agent:semantic-web", entity: "thing:alice" })
    ).toBeDefined();
    expect(
      decodeDelegation({ provType: "Delegation", delegate: "agent:bot", responsible: "agent:semantic-web" })
    ).toBeDefined();
    expect(
      decodeDerivation({ provType: "Derivation", generatedEntity: "thing:alice:v2", usedEntity: "thing:alice:v1" })
    ).toBeDefined();
    expect(decodePrimarySource({ provType: "PrimarySource", entity: "thing:alice", source: "source:1" })).toBeDefined();
    expect(decodeQuotation({ provType: "Quotation", entity: "thing:alice", source: "source:2" })).toBeDefined();
    expect(decodeRevision({ provType: "Revision", entity: "thing:alice:v2", source: "thing:alice:v1" })).toBeDefined();
    expect(decodeStart({ provType: "Start", activity: "activity:ingest", trigger: "trigger:start" })).toBeDefined();
    expect(decodeEnd({ provType: "End", activity: "activity:ingest", trigger: "trigger:end" })).toBeDefined();
  });

  it("rejects invalid provenance values for the current schema surface", () => {
    expect(() => decodeProvO({ provType: "Bundle" })).toThrow();
    expect(() => decodeCollection({ id: "collection:1", provType: "Collection" })).toThrow();
    expect(() => decodeUsage({ provType: "Usage", activity: "activity:ingest" })).toThrow();
    expect(() => decodeObjectRef("not valid whitespace ref")).toThrow();
  });

  it("accepts direct bundle decoding without going through the union entrypoint", () => {
    const decoded = decodeProvBundle(rawBundle);

    expect(decoded.records).toHaveLength(3);
    expect(O.isSome(decoded.lifecycle)).toBe(true);
  });
});
