import { NonNegativeInt } from "@beep/schema";
import {
  makeTikaError,
  TIKA_ENGINE_NAME,
  TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE,
  TikaError,
  TikaErrorOptions,
  TikaErrorReason,
  tikaOperationError,
} from "@beep/tika";
import { A } from "@beep/utils";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Order, Result } from "effect";
import * as S from "effect/Schema";
import { makeExtractOperationFixture } from "./fixtures.ts";
import type { FileProcessingOperationErrorReason } from "@beep/file-processing/Operation";

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const translationTable = [
  { expected: "engine-unavailable", reason: "config" },
  { expected: "engine-unavailable", reason: "engine-unavailable" },
  { expected: "engine-unavailable", reason: "transport" },
  { expected: "operation-timed-out", reason: "timeout" },
  { expected: "file-extraction-failed", reason: "response-decoding" },
  { expected: "file-extraction-failed", reason: "response-status" },
  { expected: "output-limit-exceeded", reason: "output-budget" },
] satisfies ReadonlyArray<{
  readonly expected: FileProcessingOperationErrorReason;
  readonly reason: TikaErrorReason;
}>;

describe("TikaErrorReason", () => {
  it("keeps the technical reason domain and encoded shapes stable", () => {
    expect(TikaErrorReason.Options).toEqual([
      "config",
      "engine-unavailable",
      "output-budget",
      "response-decoding",
      "response-status",
      "timeout",
      "transport",
    ]);
    expect(encode(TikaError, TikaError.fromReason("output-budget"))).toEqual({
      _tag: "TikaError",
      reason: "output-budget",
    });
    expect(
      encode(
        TikaError,
        TikaError.fromReason("response-status", TikaErrorOptions.make({ statusCode: NonNegativeInt.make(415) }))
      )
    ).toEqual({
      _tag: "TikaError",
      reason: "response-status",
      statusCode: 415,
    });
  });
});

describe("tikaOperationError", () => {
  it("covers every technical reason in the translation table", () => {
    expect(
      A.sort(
        A.map(translationTable, (row) => row.reason),
        Order.String
      )
    ).toEqual(A.sort(TikaErrorReason.Options, Order.String));
  });

  it.effect(
    "translates every technical reason to its operation reason",
    Effect.fnUntraced(function* () {
      const operation = yield* makeExtractOperationFixture("plain-text");

      for (const { expected, reason } of translationTable) {
        const error = tikaOperationError(operation, makeTikaError(reason));

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe(expected);
        expect(error.artifactId).toBe(operation.source.id);
        expect(error.operationId).toBe(operation.operationId);
        expect(error.engine).toBe(TIKA_ENGINE_NAME);
        expect(error.format).toBe(operation.format);
      }
    })
  );

  it.effect(
    "translates a 415 response status to unsupported-file-format",
    Effect.fnUntraced(function* () {
      const operation = yield* makeExtractOperationFixture("plain-text");
      const unsupported = tikaOperationError(
        operation,
        makeTikaError("response-status", { statusCode: NonNegativeInt.make(415) })
      );
      const failed = tikaOperationError(
        operation,
        makeTikaError("response-status", { statusCode: NonNegativeInt.make(500) })
      );

      expect(unsupported.reason).toBe("unsupported-file-format");
      expect(failed.reason).toBe("file-extraction-failed");
    })
  );

  it.effect(
    "carries the sanitized cause only on the file-extraction-failed arm",
    Effect.fnUntraced(function* () {
      const operation = yield* makeExtractOperationFixture("plain-text");
      const extractionFailed = tikaOperationError(operation, makeTikaError("response-decoding", { cause: "bad json" }));
      const budgetExceeded = tikaOperationError(operation, makeTikaError("output-budget", { cause: "9 bytes" }));

      expect(extractionFailed.details).toEqual({ cause: "bad json" });
      expect(budgetExceeded.details).toBeUndefined();
    })
  );

  it.effect(
    "lets the P1 scaffold keep its own engine-unavailable wording",
    Effect.fnUntraced(function* () {
      const operation = yield* makeExtractOperationFixture("plain-text");
      const runtime = tikaOperationError(operation, makeTikaError("engine-unavailable"));
      const scaffold = tikaOperationError(operation, makeTikaError("engine-unavailable"), {
        engineUnavailableMessage: TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE,
      });

      expect(runtime.message).toBe("The Tika runtime is not available on this host.");
      expect(scaffold.message).toBe(TIKA_SCAFFOLD_ENGINE_UNAVAILABLE_MESSAGE);
    })
  );
});
