import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Yaml } from "../../effected/yaml/Yaml.ts";
import { YamlDiagnostic } from "../../effected/yaml/YamlDiagnostic.ts";
import { YamlDocument } from "../../effected/yaml/YamlDocument.ts";
import { YamlFormat } from "../../effected/yaml/YamlFormat.ts";
import { YamlVisitor, YamlVisitorEvent } from "../../effected/yaml/YamlVisitor.ts";

describe("indexed diagnostic batches", () => {
  it.effect("scans source only once for thousands of duplicate-key positions", () => Effect.sync(() => {
    const count = 4096;
    const text = "a: 1\n".repeat(count);
    const records = A.makeBy(count - 1, (i) => ({ code: "DuplicateKey", message: "Repeated key", offset: (i + 1) * 5, length: 1 } as const));
    const reads = vi.spyOn(String.prototype, "charCodeAt");
    try {
      const index = YamlDiagnostic.positionIndex(text);
      assert.strictEqual(reads.mock.calls.length, text.length);
      const diagnostics = YamlDiagnostic.fromRawBatch(records, text, index);
      assert.strictEqual(diagnostics.length, count - 1);
      assert.deepStrictEqual(diagnostics.map((d) => [d.offset, d.line, d.character]), records.map((raw, i) => [raw.offset, i + 1, 0]));
      assert.strictEqual(reads.mock.calls.length, text.length);
      YamlDiagnostic.fromRawBatch(records, text, index);
      assert.strictEqual(reads.mock.calls.length, text.length);
    } finally {
      reads.mockRestore();
    }
  }));

  it.effect("shares one index across each parser, document stream, visitor and modification operation", () => Effect.gen(function* () {
    const text = "a: 1\n".repeat(128);
    const indexes = vi.spyOn(YamlDiagnostic, "positionIndex");
    try {
      const error = yield* Effect.matchEffect(Yaml.parse(text), { onFailure: Effect.succeed, onSuccess: Effect.die });
      assert.strictEqual(error.diagnostics.length, 127);
      assert.strictEqual(indexes.mock.calls.length, 1);
      indexes.mockClear();
      const streamError = yield* Effect.matchEffect(Yaml.parseAll(`${text}---\n${text}`), { onFailure: Effect.succeed, onSuccess: Effect.die });
      assert.strictEqual(streamError.diagnostics.length, 254);
      assert.strictEqual(indexes.mock.calls.length, 1);
      indexes.mockClear();
      const document = yield* YamlDocument.parse(text);
      assert.strictEqual(document.warnings.length, 127);
      assert.strictEqual(indexes.mock.calls.length, 1);
      indexes.mockClear();
      const documents = yield* YamlDocument.parseAll(`${text}---\n${text}`);
      assert.deepStrictEqual(documents.map((doc) => doc.warnings.length), [127, 127]);
      assert.strictEqual(indexes.mock.calls.length, 1);
      indexes.mockClear();
      const stream = YamlVisitor.visit(text);
      assert.strictEqual(indexes.mock.calls.length, 0);
      const events = yield* Stream.runCollect(stream);
      assert.strictEqual(events.filter(YamlVisitorEvent.$is("Error")).length, 127);
      assert.strictEqual(indexes.mock.calls.length, 1);
      indexes.mockClear();
      const malformed = "a: *missing\n".repeat(128);
      const modification = yield* Effect.flip(YamlFormat.modify(malformed, ["a"], 2));
      assert.isAbove(modification.diagnostics.length, 1);
      assert.strictEqual(indexes.mock.calls.length, 1);
    } finally {
      indexes.mockRestore();
    }
  }));

  it.effect("retains all newline positions, CRLF interior offsets and emitted diagnostic order", () => Effect.sync(() => {
    const text = "a\r\nb\rc\nd\u2028e\u2029f";
    const records = A.map([11, 2, 0, 3, 5, 7, 9, 1, 99], (offset) => ({ code: "UnexpectedToken", message: "position", offset, length: 1 } as const));
    const diagnostics = YamlDiagnostic.fromRawBatch(records, text);
    assert.deepStrictEqual(diagnostics.map((d) => [d.offset, d.line, d.character]), [
      [11, 5, 0], [2, 1, 0], [0, 0, 0], [3, 1, 0], [5, 2, 0], [7, 3, 0], [9, 4, 0], [1, 0, 1], [99, 5, 88],
    ]);
    assert.deepStrictEqual(diagnostics, records.map((raw) => YamlDiagnostic.fromRaw(raw, text)));
    const index = YamlDiagnostic.positionIndex(text);
    for (const offset of [-1, 0.5, 1.5, 2.5, 3.5, 99]) {
      const raw = { code: "UnexpectedToken", message: "fractional position", offset, length: 0 } as const;
      assert.deepStrictEqual(YamlDiagnostic.fromRaw(raw, text, index), YamlDiagnostic.fromRaw(raw, text));
    }
  }));
});
