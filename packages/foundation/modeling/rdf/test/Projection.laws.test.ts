import { Activity, Agent, Entity, ObjectRef, ProvBundle, SoftwareAgent } from "@beep/rdf/Prov";
import { datasetToProvBundle, provBundleToDataset } from "@beep/rdf/ProvRdf";
import { fromDataset, toDataset } from "@beep/rdf/SourceTextEntity";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { SourceTextIdentity } from "@beep/text/SourceTextIdentity";
import { expect } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { flow } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { checkPartialLens } from "./support/lensLaws.ts";
import type { ProvRecord } from "@beep/rdf/Prov";
import type { Dataset } from "@beep/rdf/Rdf";

const L62 = "L6-2 projection is deterministic and kept fields satisfy GetPut and PutGet";

const runs = { arbitrary: fcRuns(50) };

const identity = Arbitrary.schema(SourceTextIdentity);

const refPool = ["ref:a", "ref:b", "https://example.test/c", "urn:example:d"];

const poolIndex = Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 3 })));

const links = Arbitrary.map(
  Arbitrary.array(poolIndex, { maxLength: 3 }),
  flow(
    A.map((index) => ObjectRef.make(O.getOrElse(A.get(refPool, index), () => "ref:a"))),
    A.match({ onEmpty: O.none, onNonEmpty: O.some })
  )
);

const optional = <T>(item: Arbitrary.Arbitrary<T>): Arbitrary.Arbitrary<O.Option<T>> =>
  Arbitrary.map(Arbitrary.array(item, { maxLength: 1 }), A.head);

const instant = Arbitrary.map(
  Arbitrary.schema(S.Int.check(S.isBetween({ minimum: 0, maximum: 4_102_444_800_000 }))),
  (millis) => DateTime.makeUnsafe(millis)
);

const scalar = Arbitrary.schema(S.Union([S.String, S.Int, S.Boolean]));

const recordKind = Arbitrary.schema(S.Literals(["entity", "activity", "agent", "softwareAgent"]));

const drawnRecord = Arbitrary.all({
  kind: recordKind,
  links: Arbitrary.all([links, links, links, links, links, links]),
  times: Arbitrary.all([optional(instant), optional(instant)]),
  value: optional(scalar),
  name: optional(S.String.pipe(Arbitrary.schema)),
});

const withId = (drawn: typeof drawnRecord extends Arbitrary.Arbitrary<infer T> ? T : never, index: number) => {
  const id = ObjectRef.makeOption(`record:${index}`);
  const [first, second, third, fourth, fifth, sixth] = drawn.links;
  const [start, end] = drawn.times;
  const cases = {
    entity: (): ProvRecord =>
      Entity.make({
        id,
        wasGeneratedBy: first,
        wasAttributedTo: second,
        hadPrimarySource: third,
        wasQuotedFrom: fourth,
        wasRevisionOf: fifth,
        wasDerivedFrom: sixth,
        generatedAtTime: start,
        invalidatedAtTime: end,
        value: drawn.value,
      }),
    activity: (): ProvRecord =>
      Activity.make({ id, used: first, wasAssociatedWith: second, startedAtTime: start, endedAtTime: end }),
    agent: (): ProvRecord => Agent.make({ id, name: drawn.name }),
    softwareAgent: (): ProvRecord => SoftwareAgent.make({ id, name: drawn.name }),
  };
  return cases[drawn.kind]();
};

const bundle = Arbitrary.map(Arbitrary.array(drawnRecord, { maxLength: 5 }), (drawn) =>
  ProvBundle.make({ records: A.map(drawn, withId) })
);

const linkSet = (links: O.Option<ReadonlyArray<ObjectRef>>): O.Option<ReadonlyArray<ObjectRef>> =>
  O.flatMap(links, flow(A.dedupe, A.sort(Order.String), A.match({ onEmpty: O.none, onNonEmpty: O.some })));

const normalRecord = (record: ProvRecord): ProvRecord =>
  record.provType === "Entity"
    ? Entity.make({
        ...record,
        wasGeneratedBy: linkSet(record.wasGeneratedBy),
        wasAttributedTo: linkSet(record.wasAttributedTo),
        hadPrimarySource: linkSet(record.hadPrimarySource),
        wasQuotedFrom: linkSet(record.wasQuotedFrom),
        wasRevisionOf: linkSet(record.wasRevisionOf),
        wasDerivedFrom: linkSet(record.wasDerivedFrom),
      })
    : record.provType === "Activity"
      ? Activity.make({
          ...record,
          used: linkSet(record.used),
          wasAssociatedWith: linkSet(record.wasAssociatedWith),
        })
      : record;

const recordSet = (target: ProvBundle) => HashSet.fromIterable(A.map(target.records, normalRecord));

const sourceTextLens = {
  get: toDataset,
  put: fromDataset,
  omitted: (source: SourceTextIdentity) => source.scopeRef,
  quotient: Equal.equals,
};

const provBundleLens = {
  get: (source: ProvBundle) => Effect.fromResult(provBundleToDataset(source)),
  put: () => (view: Dataset) => Effect.fromResult(datasetToProvBundle(view)),
  omitted: () => undefined,
  quotient: (left: ProvBundle, right: ProvBundle) => Equal.equals(recordSet(left), recordSet(right)),
};

it.layer(Digest.layerWebCrypto, { timeout: "120 seconds" })(L62, (it) => {
  it.effect.prop(
    `${L62}: SourceTextEntity`,
    [identity, identity],
    ([source, other]) =>
      Effect.gen(function* () {
        const { accepted } = yield* checkPartialLens(sourceTextLens, source, other);
        expect(accepted).toBeGreaterThanOrEqual(1);
      }),
    runs
  );

  it.effect.prop(
    `${L62}: ProvBundle and Dataset`,
    [bundle, bundle],
    ([source, other]) =>
      Effect.gen(function* () {
        const { accepted } = yield* checkPartialLens(provBundleLens, source, other);
        expect(accepted).toBeGreaterThanOrEqual(1);
      }),
    runs
  );
});
