import { fcRuns } from "@beep/fc-runs";
import { FileDiff } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertTrue } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import { pipe } from "effect/Function";
import * as S from "effect/Schema";

const decodeInfo = S.decodeUnknownEffect(FileDiff.Info);
const encodeInfo = S.encodeEffect(FileDiff.Info);
const InfoArbitrary = Arbitrary.schema(FileDiff.Info);

// The decoded side keeps admitting `undefined` for the optional fields.

describe("FileDiff.Info", () => {
  it.effect(
    "decodes added file summaries",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeInfo({
        status: "added",
        file: "src/new-file.ts",
        additions: 12,
        deletions: 0,
      });

      expect(decoded).toBeInstanceOf(FileDiff.Added);
      expect(decoded.status).toBe("added");
      expect(decoded.file).toBe("src/new-file.ts");
      expect(decoded.patch).toBeUndefined();
    })
  );

  it.effect(
    "encodes undefined optional fields by omitting the keys",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeInfo({
        status: "modified",
        file: "src/schema.ts",
        additions: 2,
        deletions: 1,
      });

      const encodedInfo = yield* encodeInfo(decoded);
      expect(encodedInfo).toEqual({
        status: "modified",
        file: "src/schema.ts",
        additions: 2,
        deletions: 1,
      });
    })
  );

  it.effect(
    "rejects unknown statuses",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.exit(
        decodeInfo({
          status: "renamed",
          file: "src/schema.ts",
          additions: 2,
          deletions: 1,
        })
      );

      pipe(decoded, Exit.isFailure, assertTrue);
    })
  );

  it.effect(
    "rejects negative and decimal line counts",
    Effect.fnUntraced(function* () {
      const negative = yield* Effect.exit(
        decodeInfo({
          status: "deleted",
          file: "src/old-file.ts",
          additions: 0,
          deletions: -1,
        })
      );
      const decimal = yield* Effect.exit(
        decodeInfo({
          status: "added",
          file: "src/new-file.ts",
          additions: 1.5,
          deletions: 0,
        })
      );

      pipe(negative, Exit.isFailure, assertTrue);
      pipe(decimal, Exit.isFailure, assertTrue);
    })
  );

  it.effect(
    "rejects an explicit undefined optional field on the wire",
    Effect.fnUntraced(function* () {
      const decoded = yield* Effect.exit(
        decodeInfo({
          status: "modified",
          file: undefined,
          additions: 1,
          deletions: 0,
        })
      );

      pipe(decoded, Exit.isFailure, assertTrue);
    })
  );

  it.effect.prop(
    "round-trips schema-derived summaries through their encoded form",
    [InfoArbitrary],
    Effect.fnUntraced(function* ([info]) {
      const encoded = yield* encodeInfo(info);
      const decodedInfo = yield* decodeInfo(encoded);
      const reencoded = yield* encodeInfo(decodedInfo);

      expect(reencoded).toEqual(encoded);
      return true;
    }),
    { arbitrary: fcRuns(50) }
  );
});
