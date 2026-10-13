import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const runs = { arbitrary: fcRuns(100) };
const roundTrip = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decoding encoded values succeeds and preserves the value`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { LayerEdge, LayeringGraph, LayeringReport } from "../../effected/workspaces/WorkspaceLayering.ts";
describe("WorkspaceLayering property floor", () => {
  roundTrip("LayerEdge", LayerEdge);
  roundTrip("LayeringGraph", LayeringGraph);
  roundTrip("LayeringReport", LayeringReport);
});

it.effect.prop("edge labels faithfully render every field and survive codec normalization", [Arbitrary.schema(LayerEdge)], ([edge]) => Effect.gen(function* () {
  assert.strictEqual(edge.label, `${edge.from} -> ${edge.to} (${edge.field})`);
  const decoded = yield* S.decodeEffect(LayerEdge)(yield* S.encodeEffect(LayerEdge)(edge));
  const twice = yield* S.decodeEffect(LayerEdge)(yield* S.encodeEffect(LayerEdge)(decoded));
  assert.strictEqual(decoded.label, edge.label);
  assert.strictEqual(twice.label, decoded.label);
}), runs);

import * as A from "effect/Array";
import * as O from "effect/Option";
it.effect.prop("violation formatting is faithful and stable under repeated codec normalization", [Arbitrary.schema(LayeringReport)], ([report]) => Effect.gen(function* () {
  const decoded = yield* S.decodeEffect(LayeringReport)(yield* S.encodeEffect(LayeringReport)(report));
  const twice = yield* S.decodeEffect(LayeringReport)(yield* S.encodeEffect(LayeringReport)(decoded));
  assert.deepStrictEqual(twice.violations, decoded.violations);
  assert.deepStrictEqual(decoded.violations, report.violations);
  assert.deepStrictEqual(report.violations, [
    ...A.map(report.duplicates, (name) => `classified more than once: ${name}`),
    ...A.map(report.unclassified, (name) => `not classified by the policy: ${name}`),
    ...A.map(report.offenders, ({ edge, reason }) => `${reason}: ${edge.from} -> ${edge.to} (${edge.field})`),
    ...O.match(report.cycle, { onNone: () => [], onSome: (members) => [`dependency cycle among: ${members.join(", ")}`] }),
    ...A.map(report.missingDeclared, (name) => `declared but not in the workspace: ${name}`),
    ...A.map(report.missingRequiredEdges, (edge) => `required edge missing: ${edge}`),
    ...(report.edgeCount === 0 ? ["no workspace edges in the checked fields: the check is vacuous"] : []),
  ]);
}), runs);
