import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CheckDocument, CheckDocumentError, CheckDocumentStamp } from "../../effected/github-actions/CheckDocument.ts";
import { ManagedDocument } from "../../effected/github-actions/ManagedDocument.ts";

const withLayer = <ROut, EIn, RIn>(layer: Layer.Layer<ROut, EIn, RIn>) =>
  Effect.fn("CheckDocument.coverage.withLayer")(<A, E, R>(self: Effect.Effect<A, E, R>) =>
    Effect.scopedWith((scope) => Effect.flatMap(Layer.buildWithScope(layer, scope),
      (context) => Effect.provideContext(self, context))));

describe("CheckDocument gaps", () => {
  it.effect("each error names the failed document phase", () => Effect.sync(() => {
    assert.strictEqual(CheckDocumentError.make({ kind: "render" }).message, "The check document could not be regenerated from the reported state");
    assert.strictEqual(CheckDocumentError.make({ kind: "read" }).message, "Reading the check document's current text failed");
    assert.strictEqual(CheckDocumentError.make({ kind: "sink" }).message, "Writing the check document failed");
  }));
  it.effect("malformed persisted markers fail in the render phase", () => Effect.gen(function* () {
    const valid = yield* ManagedDocument.parse({ namespace: "ns", key: "doc", text: "" });
    const rendered = yield* valid.withRegions([["region", "body"]]);
    yield* Effect.gen(function* () {
      const error = yield* Effect.flip((yield* CheckDocument).flush);
      assert.strictEqual(error.kind, "render");
    }).pipe(withLayer(CheckDocument.layer({
      namespace: "ns", key: "doc", initial: rendered.text + rendered.text,
      render: () => [], sink: () => Effect.void,
    })));
  }));
  it.effect("the maximum persisted stamp ignores older later regions", () => Effect.gen(function* () {
    const document = yield* ManagedDocument.parse({ namespace: "ns", key: "doc", text: "" });
    const initial = yield* document.withRegions([
      ["new", "new body", { at: "2026-02-01", runId: "20" }],
      ["old", "old body", { at: "2026-01-01", runId: "10" }],
    ]);
    yield* Effect.gen(function* () {
      assert.strictEqual(yield* (yield* CheckDocument).flush, "stale");
    }).pipe(withLayer(CheckDocument.layer({
      namespace: "ns", key: "doc", initial: initial.text,
      stamp: CheckDocumentStamp.make({ at: "2026-01-15", runId: "15" }),
      render: () => [], sink: () => Effect.die("stale passes must not write"),
    })));
  }));
});
