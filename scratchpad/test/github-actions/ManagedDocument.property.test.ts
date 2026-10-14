import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const JsonString = S.fromJsonString(S.String);
const runs = { arbitrary: fcRuns(100) };
const roundTrips = <A, I>(name: string, schema: S.Codec<A, I>): void => {
  it.effect.prop(`${name}: decode(encode(x)) equals x and never fails`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { RejectedRegionDialectError, ManagedDocumentError, ManagedDocument } from "../../effected/github-actions/ManagedDocument.ts";
describe("ManagedDocument schema property floor", () => {
  roundTrips("RejectedRegionDialectError", RejectedRegionDialectError);
  roundTrips("ManagedDocumentError", ManagedDocumentError);
  roundTrips("ManagedDocument", ManagedDocument);
});

import { assertSome } from "@effect/vitest/utils";
const Text = S.String.check(S.isPattern(/^[A-Za-z0-9 \t]*$/u));
it.effect.prop("managed regions are idempotent, reparse faithfully and preserve every unmanaged byte", [Arbitrary.schema(Text), Arbitrary.schema(Text), Arbitrary.schema(Text), Arbitrary.schema(Text)], ([before, after, content, stamp]) => Effect.gen(function* () {
  const meta = { runId: stamp };
  const seeded = yield* ManagedDocument.parse({ namespace: "property", key: "document" });
  const first = yield* seeded.withRegions([["body", content, meta]]);
  const text = `${before}\n${first.text}\n${after}`;
  const parsed = yield* ManagedDocument.parse({ namespace: "property", key: "document", text });
  const rendered = yield* parsed.withRegions([["body", content, meta]]);
  assert.strictEqual(rendered.text, text);
  assertSome(rendered.entry("body"), { content, meta });
  const reparsed = yield* ManagedDocument.parse({ namespace: "property", key: "document", text: rendered.text });
  assert.deepStrictEqual(reparsed.regions, parsed.regions);
  assert.strictEqual(reparsed.text, parsed.text);
  assert.strictEqual((yield* rendered.withRegions([["body", content, meta]])).text, rendered.text);
  const changed = yield* reparsed.withRegions([["body", `${content} updated`, meta]]);
  assert.isTrue(changed.text.startsWith(`${before}\n`));
  assert.isTrue(changed.text.endsWith(`\n${after}`));
  assertSome(changed.entry("body"), { content: `${content} updated`, meta });
}), runs);

it.effect.prop("adopting human text preserves its exact bytes and formatting twice is identical", [Arbitrary.schema(S.String)], ([human]) => Effect.gen(function* () {
  // A JSON string is one physical line and cannot contain an exact marker line.
  const text = yield* S.encodeEffect(JsonString)(human);
  const parsed = yield* ManagedDocument.parse({ namespace: "property", key: "adopt", text });
  const formatted = yield* parsed.withRegions([]);
  assert.strictEqual(formatted.text, `${text}\n${parsed.sentinel}\n`);
  assert.strictEqual((yield* formatted.withRegions([])).text, formatted.text);
  const reread = yield* ManagedDocument.parse({ namespace: "property", key: "adopt", text: formatted.text });
  assert.deepStrictEqual(reread.regions, []);
  assert.strictEqual(reread.text, formatted.text);
}), runs);
