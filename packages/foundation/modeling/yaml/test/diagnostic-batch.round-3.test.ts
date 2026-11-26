import { RawDiagnostic } from "@beep/yaml/internal/diagnostics";
import { Yaml } from "@beep/yaml/Yaml";
import { YamlDiagnostic } from "@beep/yaml/YamlDiagnostic";
import { YamlDocument } from "@beep/yaml/YamlDocument";
import { YamlFormat } from "@beep/yaml/YamlFormat";
import { YamlVisitor, YamlVisitorEvent } from "@beep/yaml/YamlVisitor";
import { assert, describe, it, vi } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

describe("indexed diagnostic batches", () => {
  it.effect("scans source only once for thousands of duplicate-key positions", () =>
    Effect.sync(() => {
      const count = 4096;
      const text = Str.repeat(count)("a: 1\n");
      const records = A.makeBy(count - 1, (i) =>
        RawDiagnostic.make({ code: "DuplicateKey", message: "Repeated key", offset: (i + 1) * 5, length: 1 })
      );
      const reads = vi.spyOn(RegExp.prototype, "exec");
      try {
        const index = YamlDiagnostic.positionIndex(text);
        assert.strictEqual(
          reads.mock.calls.length,
          count + 1,
          "the index scans with one global line-break RegExp: one exec per break plus the final miss"
        );
        const diagnostics = YamlDiagnostic.fromRawBatch(records, text, index);
        assert.strictEqual(diagnostics.length, count - 1);
        assert.deepStrictEqual(
          A.map(diagnostics, (d) => [d.offset, d.line, d.character]),
          A.map(records, (raw, i) => [raw.offset, i + 1, 0])
        );
        assert.strictEqual(reads.mock.calls.length, count + 1);
        YamlDiagnostic.fromRawBatch(records, text, index);
        assert.strictEqual(reads.mock.calls.length, count + 1);
      } finally {
        reads.mockRestore();
      }
    })
  );

  it.effect("shares one index across each parser, document stream, visitor and modification operation", () =>
    Effect.gen(function* () {
      const text = Str.repeat(128)("a: 1\n");
      const indexes = vi.spyOn(YamlDiagnostic, "positionIndex");
      try {
        const error = yield* Effect.matchEffect(Yaml.parse(text), { onFailure: Effect.succeed, onSuccess: Effect.die });
        assert.strictEqual(error.diagnostics.length, 127);
        assert.strictEqual(indexes.mock.calls.length, 1);
        indexes.mockClear();
        const streamError = yield* Effect.matchEffect(Yaml.parseAll(`${text}---\n${text}`), {
          onFailure: Effect.succeed,
          onSuccess: Effect.die,
        });
        assert.strictEqual(streamError.diagnostics.length, 254);
        assert.strictEqual(indexes.mock.calls.length, 1);
        indexes.mockClear();
        const document = yield* YamlDocument.parse(text);
        assert.strictEqual(document.warnings.length, 127);
        assert.strictEqual(indexes.mock.calls.length, 1);
        indexes.mockClear();
        const documents = yield* YamlDocument.parseAll(`${text}---\n${text}`);
        assert.deepStrictEqual(
          A.map(documents, (doc) => doc.warnings.length),
          [127, 127]
        );
        assert.strictEqual(indexes.mock.calls.length, 1);
        indexes.mockClear();
        const stream = YamlVisitor.visit(text);
        assert.strictEqual(indexes.mock.calls.length, 0);
        const events = yield* Stream.runCollect(stream);
        assert.strictEqual(A.filter(events, YamlVisitorEvent.$is("Error")).length, 127);
        assert.strictEqual(indexes.mock.calls.length, 1);
        indexes.mockClear();
        const malformed = Str.repeat(128)("a: *missing\n");
        const modification = yield* Effect.flip(YamlFormat.modify(malformed, ["a"], 2));
        assert.isAbove(modification.diagnostics.length, 1);
        assert.strictEqual(indexes.mock.calls.length, 1);
      } finally {
        indexes.mockRestore();
      }
    })
  );

  it.effect("retains all newline positions, CRLF interior offsets and emitted diagnostic order", () =>
    Effect.sync(() => {
      const text = "a\r\nb\rc\nd\u2028e\u2029f";
      const records = A.map([11, 2, 0, 3, 5, 7, 9, 1, 99], (offset) =>
        RawDiagnostic.make({ code: "UnexpectedToken", message: "position", offset, length: 1 })
      );
      const diagnostics = YamlDiagnostic.fromRawBatch(records, text);
      assert.deepStrictEqual(
        A.map(diagnostics, (d) => [d.offset, d.line, d.character]),
        [
          [11, 5, 0],
          [2, 1, 0],
          [0, 0, 0],
          [3, 1, 0],
          [5, 2, 0],
          [7, 3, 0],
          [9, 4, 0],
          [1, 0, 1],
          [99, 5, 88],
        ]
      );
      assert.deepStrictEqual(diagnostics, A.map(records, YamlDiagnostic.fromRaw(text)));
      const index = YamlDiagnostic.positionIndex(text);
      for (const offset of [-1, 0.5, 1.5, 2.5, 3.5, 99]) {
        const raw = { code: "UnexpectedToken", message: "fractional position", offset, length: 0 } as const;
        assert.deepStrictEqual(YamlDiagnostic.fromRaw(raw, text, index), YamlDiagnostic.fromRaw(raw, text));
      }
    })
  );
});
