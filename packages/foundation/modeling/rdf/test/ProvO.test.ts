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
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertTrue } from "@effect/vitest/utils";
import { DateTime, Effect, Exit, pipe, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
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
const isProvDateTime = S.is(ProvDateTime);
const equivalentProvDateTime = S.toEquivalence(ProvDateTime);
const encodeProvDateTimeResult = S.encodeResult(ProvDateTime);
const decodeProvDateTimeResult = S.decodeResult(ProvDateTime);

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

      pipe("records" in decoded, assertTrue);
      if ("records" in decoded) {
        expect(decoded.records).toHaveLength(3);
        pipe(decoded.lifecycle, O.isSome, assertTrue);
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

      pipe(activity.startedAtTime, O.isSome, assertTrue);
      pipe(activity.endedAtTime, O.isSome, assertTrue);
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
      pipe(yield* Effect.exit(decodeProvO({ provType: "Bundle" })), Exit.isFailure, assertTrue);
      pipe(
        yield* Effect.exit(decodeCollection({ id: "collection:1", provType: "Collection" })),
        Exit.isFailure,
        assertTrue
      );
      pipe(
        yield* Effect.exit(decodeUsage({ provType: "Usage", activity: "activity:ingest" })),
        Exit.isFailure,
        assertTrue
      );
      pipe(yield* Effect.exit(decodeObjectRef("not valid whitespace ref")), Exit.isFailure, assertTrue);
    })
  );

  it.effect("accepts direct bundle decoding without going through the union entrypoint", () =>
    Effect.gen(function* () {
      const decoded = yield* decodeProvBundle(rawBundle);

      expect(decoded.records).toHaveLength(3);
      pipe(decoded.lifecycle, O.isSome, assertTrue);
    })
  );
});

it("bounds decoded PROV timestamps to the existing four-digit canonical year format", () => {
  for (const epoch of [-62167219200000, 253402300799999]) {
    const instant = DateTime.makeUnsafe(epoch);
    pipe(instant, isProvDateTime, assertTrue);
    pipe(encodeProvDateTimeResult(instant), Result.isSuccess, assertTrue);
  }
  for (const epoch of [-62167219200001, 253402300800000]) {
    const instant = DateTime.makeUnsafe(epoch);
    pipe(instant, isProvDateTime, assertFalse);
    pipe(encodeProvDateTimeResult(instant), Result.isFailure, assertTrue);
    expect(() =>
      Usage.make({
        activity: ObjectRef.make("activity:1"),
        entity: ObjectRef.make("entity:1"),
        atTime: O.some(instant),
      })
    ).toThrow();
  }
});

it("applies PROV timestamp boundaries after timezone normalization", () => {
  for (const input of ["0000-01-01T01:00:00+01:00", "9999-12-31T22:59:59.999-01:00"]) {
    const value = Result.getOrThrow(decodeProvDateTimeResult(input));
    pipe(encodeProvDateTimeResult(value), Result.isSuccess, assertTrue);
  }
  for (const input of ["0000-01-01T00:00:00+00:01", "9999-12-31T23:59:59.999-00:01"]) {
    pipe(decodeProvDateTimeResult(input), Result.isFailure, assertTrue);
  }
});

it.prop(
  "round-trips source-derived PROV timestamps through the canonical wire format",
  [Arbitrary.schema(ProvDateTime)],
  ([instant]) => {
    const encoded = Result.getOrThrow(encodeProvDateTimeResult(instant));
    const decoded = Result.getOrThrow(decodeProvDateTimeResult(encoded));
    pipe(equivalentProvDateTime(decoded, instant), assertTrue);
  },
  { arbitrary: fcRuns(100) }
);
