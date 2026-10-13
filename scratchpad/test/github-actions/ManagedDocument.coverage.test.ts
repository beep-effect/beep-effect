import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import { ManagedDocument, ManagedDocumentError } from "../../effected/github-actions/ManagedDocument.ts";

describe("ManagedDocument coverage", () => {
  it.effect("raw corrupt documents expose no regions and refuse writes with the structural error", () => Effect.gen(function* () {
    const doc = ManagedDocument.make({ namespace: "test", key: "body", text: "<!-- --- BEGIN test.body.header MANAGED REGION --- -->\nunclosed" });
    assert.deepStrictEqual(doc.regions, []);
    assertNone(doc.entry("header"));
    assertFailure(doc.withRegionsResult([["header", "replacement"]]), ManagedDocumentError.make({ kind: "unterminatedRegion", key: "test.body.header", line: 1 }));
    const error = yield* Effect.flip(doc.withRegions([["header", "replacement"]]));
    assert.strictEqual(error.message, 'Managed region is never closed for region "test.body.header" at line 1');
    assert.strictEqual(doc.text, "<!-- --- BEGIN test.body.header MANAGED REGION --- -->\nunclosed");
  }));
});
